import { create } from 'zustand'

interface Tenant {
  name: string
  logoUrl: string
}

interface UIState {
  sidebarOpen: boolean
  currentTheme: string
  tenant: Tenant
  toggleSidebar: () => void
  setTheme: (theme: string) => void
  setTenant: (tenant: Tenant) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  currentTheme: 'light',
  tenant: {
    name: 'Sekoliko',
    logoUrl: ''
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setTheme: (theme: string) => set({ currentTheme: theme }),

  setTenant: (tenant: Tenant) => set({ tenant })
}))
