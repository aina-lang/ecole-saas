import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, saveTokens, loadTokens, clearTokens, setOnSessionLost, loadApiUrl, isOffline } from './api'
import type { SessionUser } from './types'
import { saveVerifier, verifyOffline, clearVerifier } from './offline-auth'
import { preloadTeacherData } from './preload'

const USER_KEY = 'ecoleprof.user'
const LOCKED_KEY = 'ecoleprof.lockedEmail'

interface AuthState {
  user: SessionUser | null
  ready: boolean
  /** Compte mémorisé sur cet appareil (session verrouillée) : e-mail pré-rempli. */
  lockedEmail: string | null
  /** true si la dernière connexion s'est faite hors ligne (données en cache). */
  offlineSession: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<'online' | 'offline'>
  logout: () => Promise<void>
  /** Efface tout ce que l'app a mémorisé sur cet appareil (jetons, empreinte, cache). */
  wipeDevice: () => Promise<void>
  setUser: (u: SessionUser) => void
  preload: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  lockedEmail: null,
  offlineSession: false,

  init: async () => {
    await loadApiUrl()
    const [tokens, raw, locked] = await Promise.all([loadTokens(), AsyncStorage.getItem(USER_KEY), AsyncStorage.getItem(LOCKED_KEY)])
    const user = raw ? (JSON.parse(raw) as SessionUser) : null
    // Session perdue côté serveur (jeton révoqué) : on verrouille, sans effacer
    // le cache — le mot de passe redonnera accès hors ligne.
    setOnSessionLost(() => { get().logout().catch(() => {}) })
    set({ user: tokens && user ? user : null, lockedEmail: locked ?? user?.email ?? null, ready: true })
  },

  login: async (rawEmail, password) => {
    const email = rawEmail.trim().toLowerCase()
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (!data?.accessToken) throw new Error('Réponse du serveur invalide')
      if (data.user?.role !== 'TEACHER' && data.user?.role !== 'ADMIN' && data.user?.role !== 'SUPER_ADMIN') {
        throw new Error('Cette application est réservée aux enseignants.')
      }
      await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))
      await AsyncStorage.setItem(LOCKED_KEY, email)
      await saveVerifier(email, password)
      set({ user: data.user, lockedEmail: email, offlineSession: false })
      // Précharger tout ce qu'il faut pour travailler sans réseau (en arrière-plan).
      get().preload().catch(() => {})
      return 'online'
    } catch (err) {
      if (!isOffline(err)) throw err
      // Hors ligne : déverrouillage avec l'empreinte locale du mot de passe.
      const raw = await AsyncStorage.getItem(USER_KEY)
      const user = raw ? (JSON.parse(raw) as SessionUser) : null
      if (!user || user.email.toLowerCase() !== email) {
        throw new Error('Hors ligne : ce compte ne s’est jamais connecté sur cet appareil. Connectez-vous une première fois avec Internet.')
      }
      const ok = await verifyOffline(email, password)
      if (!ok) throw new Error('Mot de passe incorrect.')
      set({ user, lockedEmail: email, offlineSession: true })
      return 'offline'
    }
  },

  /** Verrouille la session : l'app redemande le mot de passe, mais garde
   * jetons, empreinte et cache pour pouvoir rouvrir hors ligne. */
  logout: async () => {
    set({ user: null, offlineSession: false })
  },

  wipeDevice: async () => {
    await clearTokens()
    await clearVerifier()
    await AsyncStorage.multiRemove([USER_KEY, LOCKED_KEY])
    set({ user: null, lockedEmail: null, offlineSession: false })
  },

  preload: async () => {
    if (!get().user) return
    await preloadTeacherData()
  },

  setUser: (user) => {
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {})
    set({ user })
  },
}))
