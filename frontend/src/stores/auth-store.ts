import { create } from 'zustand'
import client, { UNAUTHORIZED_EVENT } from '../api/client'
import { setCurrentTenant } from '../lib/db/pouchdb'
import { stopAllSyncs } from '../lib/db/sync-manager'
import { saveSession, getSession, clearSession } from '../lib/db/pouchdb-auth'
import { setTokens, clearTokens as clearTokenCache, setTenantId } from '../lib/db/token-cache'

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
  hydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  setUser: (user: User) => void
  completeOnboarding: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  tenantId: null,
  isAuthenticated: false,
  onboardingCompleted: localStorage.getItem('onboardingCompleted') === 'true',
  hydrated: false,

  hydrate: async () => {
    const session = await getSession()
    if (session) {
      setTokens(session.accessToken, session.refreshToken)
      setTenantId(session.tenantId)
      setCurrentTenant(session.tenantId)
      set({
        user: {
          id: session.userId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          role: session.role,
          tenantId: session.tenantId,
          isActive: true,
        },
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        tenantId: session.tenantId,
        isAuthenticated: true,
        hydrated: true,
      })
    } else {
      set({ hydrated: true })
    }
  },

  login: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    try {
      const { data } = await client.post('/auth/login', {
        email: normalizedEmail,
        password
      })

      if (!data?.accessToken) {
        throw new Error('Réponse du serveur invalide')
      }

      const { user, accessToken, refreshToken, tenantId } = data
      const resolvedTenantId = tenantId ?? user?.tenantId

      setCurrentTenant(resolvedTenantId)
      setTenantId(resolvedTenantId)
      setTokens(accessToken, refreshToken)

      await saveSession({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: resolvedTenantId,
        accessToken,
        refreshToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      set({
        user,
        accessToken,
        refreshToken,
        tenantId: resolvedTenantId,
        isAuthenticated: true,
      })

      if (typeof window !== 'undefined' && window.api?.auth?.setToken) {
        window.api.auth.setToken(accessToken).catch(() => {})
      }
      if (typeof window !== 'undefined' && window.api?.sync?.hydrate) {
        window.api.sync.hydrate().catch(() => {})
      }
    } catch (err: any) {
      if (!navigator.onLine || err?.code === 'ERR_NETWORK') {
        const session = await getSession()
        if (!session || session.email !== normalizedEmail) {
          throw new Error('Aucune session locale trouvée. Connectez-vous en ligne d\'abord.')
        }
        setCurrentTenant(session.tenantId)
        setTenantId(session.tenantId)
        setTokens(session.accessToken, session.refreshToken)
        set({
          user: {
            id: session.userId,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            role: session.role,
            tenantId: session.tenantId,
            isActive: true,
          },
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          tenantId: session.tenantId,
          isAuthenticated: true,
        })
        return
      }
      throw err
    }
  },

  logout: () => {
    stopAllSyncs()
    clearTokenCache()
    clearSession()
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      isAuthenticated: false,
    })
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
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
      return
    }

    try {
      const { data } = await client.post('/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken, user } = data

      if (user?.tenantId) {
        setCurrentTenant(user.tenantId)
        setTenantId(user.tenantId)
      }

      setTokens(accessToken, newRefreshToken)

      const session = await getSession()
      if (session) {
        await saveSession({ ...session, accessToken, refreshToken: newRefreshToken, updatedAt: new Date().toISOString() })
      }

      set({
        user,
        accessToken,
        refreshToken: newRefreshToken,
        isAuthenticated: true,
      })

      if (typeof window !== 'undefined' && window.api?.auth?.setToken) {
        window.api.auth.setToken(accessToken).catch(() => {})
      }
      if (typeof window !== 'undefined' && window.api?.sync?.hydrate) {
        window.api.sync.hydrate().catch(() => {})
      }
    } catch {
      // Échec du refresh — ne pas déconnecter, les tokens seront réessayés
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
