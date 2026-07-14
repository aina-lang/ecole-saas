import { create } from 'zustand'
import client, { UNAUTHORIZED_EVENT } from '../api/client'

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
  subdomain: string
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
