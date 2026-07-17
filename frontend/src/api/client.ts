import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../lib/db/token-cache'

const API_BASE = 'http://localhost:3000'

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    'Content-Type': 'application/json'
  }
})

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

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
        const { data } = await axios.post('http://localhost:3000/api/v1/auth/refresh', {
          refreshToken: refreshTok
        })
        const { accessToken, refreshToken: newRefreshToken } = data
        setTokens(accessToken, newRefreshToken)
        client.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        processQueue(null)
        return client(originalRequest)
      } catch (refreshError: any) {
        processQueue(error)
        // Ne pas invalider la session si le serveur est injoignable (offline).
        // On garde les tokens existants — ils fonctionneront à la reconnexion.
        if (!refreshError?.response && !navigator.onLine) {
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
