import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  db: {
    sync: (entityType: string, remoteUrl?: string) => Promise<{ ok: boolean; error?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<{ success: boolean }>
    getAll: () => Promise<Record<string, string>>
  }
  sync: {
    getStatus: () => Promise<{
      isOnline: boolean
      pendingCount: number
      conflictCount: number
      lastSyncAt: string | null
      isSyncing: boolean
    }>
    forceSync: () => Promise<{ synced: number; conflicts: number; errors: number }>
    getCouchDBConfig: () => Promise<{ url: string }>
    onStatusChanged: (callback: (status: any) => void) => () => void
    onProgress: (callback: (progress: any) => void) => () => void
  }
  auth: {
    setToken: (token: string) => Promise<{ success: boolean }>
    getToken: () => Promise<string | null>
  }
  file: {
    save: (data: {
      buffer: ArrayBuffer
      entityType: string
      entityId: string
      fieldName: string
      originalName: string
      mimeType: string
    }) => Promise<{ id: string; localPath: string }>
    getUrl: (localPath: string) => Promise<string | null>
    getPendingCount: () => Promise<number>
    getEntityPhoto: (entityType: string, entityId: string) => Promise<string | null>
  }
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

export {}
