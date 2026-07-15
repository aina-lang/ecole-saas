import { create } from 'zustand'
import client, { UNAUTHORIZED_EVENT } from '../api/client'
import { setCurrentTenant, destroyAllDatabases, scheduleTenantCleanup } from '../lib/db/pouchdb'
import { stopAllSyncs, performSync } from '../lib/db/sync-manager'

declare global {
  interface Window {
    api?: {
      auth?: {
        setToken: (token: string) => Promise<{ success: boolean }>
        getToken: () => Promise<string | null>
      }
      sync?: {
        hydrate: () => Promise<{ success: boolean; counts?: Record<string, number> }>
        onStatusChanged: (callback: (status: any) => void) => () => void
        onProgress: (callback: (progress: any) => void) => () => void
      }
    }
  }
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  isActive: boolean
  photoUrl?: string | null
}

interface RegisterPayload {
  schoolName: string
  adminEmail: string
  adminFirstName: string
  adminLastName: string
  adminPassword: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  tenantId: string | null
  isAuthenticated: boolean
  onboardingCompleted: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  setUser: (user: User) => void
  completeOnboarding: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  tenantId: localStorage.getItem('tenantId'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  onboardingCompleted: localStorage.getItem('onboardingCompleted') === 'true',

  login: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    console.log('[FRONTEND] login request', { email: normalizedEmail })
    const { data } = await client.post('/auth/login', {
      email: normalizedEmail,
      password
    })
    console.log('[FRONTEND] login response', {
      hasUser: !!data?.user,
      email: data?.user?.email,
      hasAccessToken: !!data?.accessToken,
      tenantId: data?.tenantId ?? data?.user?.tenantId
    })
    const { user, accessToken, refreshToken, tenantId } = data
    const resolvedTenantId = tenantId ?? user?.tenantId

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('tenantId', resolvedTenantId)

    // Basculer les bases PouchDB vers le contexte du nouveau tenant
    // AVANT la hydration pour garantir que les bons buckets sont utilisés
    setCurrentTenant(resolvedTenantId)

    set({
      user,
      accessToken,
      refreshToken,
      tenantId,
      isAuthenticated: true
    })

    if (typeof window !== 'undefined' && window.api?.auth?.setToken) {
      window.api.auth.setToken(accessToken).catch(() => {})
    }

    if (typeof window !== 'undefined' && window.api?.sync?.hydrate) {
      window.api.sync.hydrate().catch(() => {})
    }
  },

  logout: () => {
    // Capturer le tenantId AVANT de le supprimer du state
    const tenantId = localStorage.getItem('tenantId') || 'default'

    // 1. Arrêter les syncs en cours
    stopAllSyncs()

    // Finalise le logout : purge localStorage + state + event, UNIQUEMENT
    // une fois que la sync finale a eu la chance de s'exécuter (cf. #3).
    const finalizeLogout = () => {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('tenantId')

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        tenantId: null,
        isAuthenticated: false
      })

      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }

    if (navigator.onLine) {
      // ─── ONLINE : sync rapide puis destruction immédiate ───────────────────
      // IMPORTANT (#3) : la sync finale a besoin du accessToken (fetchCouchDBConfig
      // appelle GET /sync/couchdb-config avec le JWT). On NE supprime le token
      // QUE dans le .finally, après que la sync a pu s'exécuter. Sinon la sync
      // échoue en 401 et les données non envoyées sont perdues à la destruction.
      performSync()
        .then(() => destroyAllDatabases(tenantId))
        .catch(() => destroyAllDatabases(tenantId)) // détruire même si la sync échoue
        .catch((err) => console.warn('[Logout] Purge locale échouée :', err))
        .finally(finalizeLogout)
    } else {
      // ─── OFFLINE : cleanup DIFFÉRÉ ─────────────────────────────────────────
      // On ne peut pas synchroniser maintenant — on NE DÉTRUIT PAS les bases.
      // Elles seront syncées puis détruites automatiquement à la prochaine
      // connexion réseau (processPendingCleanups dans sync-manager.ts).
      scheduleTenantCleanup(tenantId)
      console.log("[Logout] Hors ligne — données locales préservées jusqu'à la prochaine connexion")
      finalizeLogout()
    }
  },

  register: async (payload: RegisterPayload) => {
    await client.post('/auth/register', {
      ...payload,
      adminEmail: payload.adminEmail.trim().toLowerCase()
    })
  },

  refreshAuth: async () => {
    const { refreshToken } = get()
    if (!refreshToken) {
      get().logout()
      return
    }

    try {
      const { data } = await client.post('/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken, user } = data

      // (#6) Re-basculer le contexte PouchDB sur le bon tenant. En cas de
      // cold start l'app a pu recharger avec un tenantId différent en mémoire ;
      // on s'assure que les bases actives correspondent au user rafraîchi.
      if (user?.tenantId) setCurrentTenant(user.tenantId)

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', newRefreshToken)

      set({
        user,
        accessToken,
        refreshToken: newRefreshToken,
        isAuthenticated: true
      })

      if (typeof window !== 'undefined' && window.api?.auth?.setToken) {
        window.api.auth.setToken(accessToken).catch(() => {})
      }

      if (typeof window !== 'undefined' && window.api?.sync?.hydrate) {
        window.api.sync.hydrate().catch(() => {})
      }
    } catch {
      get().logout()
    }
  },

  setUser: (user: User) => {
    set({ user })
  },

  completeOnboarding: () => {
    localStorage.setItem('onboardingCompleted', 'true')
    set({ onboardingCompleted: true })
  }
}))
