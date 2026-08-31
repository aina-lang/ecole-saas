import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../lib/db/token-cache'
import { learnServerTime } from '../lib/trusted-clock'

// Serveur API : celui déployé sur le VPS (pm2 « ecole-api », redéployé à
// chaque push). Pour viser une API locale en développement :
//   VITE_API_URL=http://localhost:3000 npm run dev
const API_BASE: string = (import.meta as any).env?.VITE_API_URL ?? 'http://51.178.50.63:3000'

// Aucune requête ne doit pouvoir suspendre l'interface indéfiniment : sans
// cette valeur, axios attend sans limite (défaut 0), et un serveur joignable
// mais muet — portail captif, perte de paquets, VPS saturé — laisse l'écran
// figé pour toujours au lieu de basculer sur le mode hors ligne. 15 s est
// large pour les charges utiles de l'API (du JSON) sur une liaison lente ;
// les transferts volumineux (photos, pièces jointes) ne passent pas par ici
// mais par IPC et par la réplication PouchDB.
const REQUEST_TIMEOUT_MS = 15000

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Le serveur n'a jamais répondu — coupure réseau, DNS, ou délai dépassé.
 * À distinguer d'une vraie réponse HTTP : tant qu'on n'a rien reçu, on ne
 * peut RIEN conclure sur la validité d'une session ou d'un identifiant.
 *
 * `navigator.onLine` ne suffit pas : il ne détecte que l'absence de lien
 * physique, et vaut « true » derrière un portail captif ou face à un serveur
 * qui ne répond plus.
 */
export function isOfflineError(error: unknown): boolean {
  if (!navigator.onLine) return true
  if (!axios.isAxiosError(error)) return false
  if (error.response) return false
  return (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ERR_CANCELED'
  )
}

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(undefined)
    }
  })
  failedQueue = []
}

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

export const UNAUTHORIZED_EVENT = 'auth:unauthorized'

export function extractErrorMessage(
  error: unknown,
  fallback = 'Une erreur est survenue'
): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined

    if (data) {
      if (typeof data.message === 'string') return data.message
      if (Array.isArray(data.message) && data.message.length) {
        return data.message.join(', ')
      }
      if (typeof data.error === 'string') return data.error
    }

    if (status && status >= 500) {
      return "Erreur du serveur. Veuillez réessayer plus tard."
    }
    if (!error.response) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion.'
    }
    if (status === 401) {
      return 'Identifiant ou mot de passe incorrect'
    }
    return `Erreur ${status}. Veuillez réessayer.`
  }

  if (error instanceof Error) return error.message
  return fallback
}

// Chaque réponse du serveur (succès ou erreur) porte X-Server-Time : c'est
// l'ancre de l'horloge de confiance (voir lib/trusted-clock.ts).
function learnFromHeaders(headers: unknown): void {
  const h = headers as Record<string, unknown> | undefined
  const raw = h?.['x-server-time']
  const ms = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (Number.isFinite(ms)) learnServerTime(ms)
}

client.interceptors.response.use(
  (response) => {
    learnFromHeaders(response.headers)
    return response
  },
  async (error: AxiosError) => {
    if (error.response) learnFromHeaders(error.response.headers)
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    const url = originalRequest.url ?? ''
    const isAuthEndpoint = url.startsWith('/auth/')

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => client(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshTok = getRefreshToken()
      if (!refreshTok) {
        isRefreshing = false
        clearTokens()
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        return Promise.reject(error)
      }

      try {
        // axios.post « nu » (et non `client`) pour éviter de repasser par cet
        // intercepteur — mais il faut lui redonner le timeout, qu'il n'hérite
        // pas de l'instance.
        const { data } = await axios.post(
          `${API_BASE}/api/v1/auth/refresh`,
          { refreshToken: refreshTok },
          { timeout: REQUEST_TIMEOUT_MS }
        )
        const { accessToken, refreshToken: newRefreshToken } = data
        setTokens(accessToken, newRefreshToken)
        client.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        processQueue(null)
        return client(originalRequest)
      } catch (refreshError: any) {
        processQueue(error)
        // Ne pas invalider la session tant qu'on n'a pas REÇU de réponse.
        // Une absence de réponse (coupure, délai dépassé) ne dit rien sur la
        // validité du jeton — elle dit seulement qu'on n'a pas pu demander.
        // Le test portait aussi sur navigator.onLine, qui vaut « true »
        // derrière un portail captif ou face à un serveur muet : l'utilisateur
        // se retrouvait déconnecté de force par une simple panne réseau, et
        // depuis l'ajout du timeout ce cas serait devenu fréquent.
        if (!refreshError?.response) {
          return Promise.reject(error)
        }
        // Si le refresh échoue avec une réponse 401/500, le token est invalide
        // ou le serveur a rejeté la requête : on peut déconnecter.
        clearTokens()
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default client

export function getPhotoUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('local-asset://') || path.startsWith('data:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
