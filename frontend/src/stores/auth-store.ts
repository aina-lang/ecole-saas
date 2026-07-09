import { create } from 'zustand'
import client from '../api/client'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  isActive: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  tenantId: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  tenantId: localStorage.getItem('tenantId'),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: async (email: string, password: string) => {
    const { data } = await client.post('/auth/login', { email, password })
    const { user, accessToken, refreshToken, tenantId } = data.data

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('tenantId', tenantId)

    set({
      user,
      accessToken,
      refreshToken,
      tenantId,
      isAuthenticated: true
    })
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

    window.location.href = '/login'
  },

  refreshAuth: async () => {
    const { refreshToken } = get()
    if (!refreshToken) {
      get().logout()
      return
    }

    try {
      const { data } = await client.post('/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken, user } = data.data

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', newRefreshToken)

      set({
        user,
        accessToken,
        refreshToken: newRefreshToken,
        isAuthenticated: true
      })
    } catch {
      get().logout()
    }
  },

  setUser: (user: User) => {
    set({ user })
  }
}))