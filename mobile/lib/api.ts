import axios, { AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

// Client HTTP vers l'API Sekoliko (NestJS). L'URL du serveur est FIXÉE
// dans app.json (extra.apiUrl) : l'utilisateur ne peut pas la modifier.
// NB : « localhost » ne joint jamais un PC depuis un téléphone — il faut l'IP
// LAN du poste (ex. http://192.168.1.10:3000/api/v1) ou un serveur public.

const DEFAULT_URL: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3000/api/v1'
const URL_KEY = 'ecoleprof.apiUrl'
const TOKENS_KEY = 'ecoleprof.tokens'

export const api = axios.create({ baseURL: DEFAULT_URL, timeout: 20_000 })

export async function loadApiUrl(): Promise<string> {
  // Nettoyage d'une éventuelle URL mémorisée par une ancienne version.
  await AsyncStorage.removeItem(URL_KEY).catch(() => {})
  api.defaults.baseURL = DEFAULT_URL
  return DEFAULT_URL
}

export function getApiUrl(): string {
  return api.defaults.baseURL ?? DEFAULT_URL
}

// --- Jetons -----------------------------------------------------------------
interface Tokens { accessToken: string; refreshToken: string }
let tokens: Tokens | null = null
let onSessionLost: (() => void) | null = null

export function setOnSessionLost(cb: () => void) { onSessionLost = cb }

export async function saveTokens(next: Tokens) {
  tokens = next
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(next))
}
export async function loadTokens(): Promise<Tokens | null> {
  if (tokens) return tokens
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY)
    tokens = raw ? (JSON.parse(raw) as Tokens) : null
  } catch { tokens = null }
  return tokens
}
export async function clearTokens() {
  tokens = null
  await SecureStore.deleteItemAsync(TOKENS_KEY)
}

api.interceptors.request.use((config) => {
  if (tokens && !config.headers.Authorization) config.headers.Authorization = `Bearer ${tokens.accessToken}`
  return config
})

let refreshing: Promise<Tokens | null> | null = null
async function refresh(): Promise<Tokens | null> {
  if (!tokens?.refreshToken) return null
  if (!refreshing) {
    refreshing = axios
      .post(`${getApiUrl()}/auth/refresh`, { refreshToken: tokens.refreshToken }, { timeout: 15_000 })
      .then(async ({ data }) => {
        const next = { accessToken: data.accessToken, refreshToken: data.refreshToken }
        await saveTokens(next)
        return next
      })
      .catch(async (err: AxiosError) => {
        // Serveur injoignable : on garde les jetons, ils resserviront en ligne.
        if (!err.response) return null
        await clearTokens()
        onSessionLost?.()
        return null
      })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

// --- Horloge de confiance : décalage serveur − téléphone, appris à chaque
// réponse (en-tête X-Server-Time). Sert à horodater les saisies hors ligne
// de façon fiable même si l'heure du téléphone est fausse.
let serverOffsetMs: number | null = null
const OFFSET_KEY = 'ecoleprof.serverOffset'
AsyncStorage.getItem(OFFSET_KEY).then((v) => { if (v && serverOffsetMs === null) serverOffsetMs = Number(v) }).catch(() => {})
function learnServerTime(headers: unknown) {
  const raw = (headers as Record<string, unknown> | undefined)?.['x-server-time']
  const ms = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (Number.isFinite(ms) && ms > 1_600_000_000_000) {
    serverOffsetMs = ms - Date.now()
    AsyncStorage.setItem(OFFSET_KEY, String(serverOffsetMs)).catch(() => {})
  }
}
/** Heure actuelle alignée sur le serveur (ms). */
export function trustedNow(): number { return Date.now() + (serverOffsetMs ?? 0) }
export function trustedNowIso(): string { return new Date(trustedNow()).toISOString() }

api.interceptors.response.use(
  (r) => { learnServerTime(r.headers); return r },
  async (error: AxiosError) => {
    if (error.response) learnServerTime(error.response.headers)
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined
    const url = original?.url ?? ''
    if (error.response?.status === 401 && original && !original._retry && !url.startsWith('/auth/')) {
      original._retry = true
      const next = await refresh()
      if (next) {
        original.headers.Authorization = `Bearer ${next.accessToken}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    if (typeof data?.message === 'string') return data.message
    if (Array.isArray(data?.message) && data.message.length) return data.message.join(', ')
    if (!err.response) return 'Serveur injoignable — vérifiez la connexion et l’adresse du serveur.'
    if (err.response.status === 401) return 'Identifiant ou mot de passe incorrect'
    return `Erreur ${err.response.status}`
  }
  return err instanceof Error ? err.message : fallback
}

export function isOffline(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response
}
