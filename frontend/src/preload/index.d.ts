import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  db: {
    getStudents: (filters?: any) => Promise<any[]>
    saveStudents: (students: any[]) => Promise<{ success: boolean }>
    saveGrades: (grades: any[]) => Promise<{ success: boolean }>
    saveAttendance: (records: any[]) => Promise<{ success: boolean }>
    addToOutbox: (entry: any) => Promise<string>
  }
  local: {
    save: (entityType: string, data: any) => Promise<{ success: boolean }>
    query: (entityType: string, filters?: any) => Promise<any[]>
    count: (entityType: string, filters?: any) => Promise<number>
    getById: (entityType: string, id: string) => Promise<any | null>
    delete: (entityType: string, id: string) => Promise<{ success: boolean }>
    markSynced: (entityType: string, id: string) => Promise<{ success: boolean }>
    getConfig: (entityType: string) => Promise<{ table: string; columns: string[] } | null>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<{ success: boolean }>
    getAll: () => Promise<Record<string, string>>
  }
  audit: {
    save: (entry: any) => Promise<{ success: boolean }>
    query: (filters?: any) => Promise<any[]>
  }
  file: {
    save: (data: { buffer: ArrayBuffer; entityType: string; entityId: string; fieldName: string; originalName: string; mimeType: string }) => Promise<{ id: string; localPath: string }>
    getUrl: (localPath: string) => Promise<string | null>
    getPendingCount: () => Promise<number>
    getEntityPhoto: (entityType: string, entityId: string) => Promise<string | null>
  }
  sync: {
    getStatus: () => Promise<{ isOnline: boolean; pendingCount: number; conflictCount: number; deviceId: string }>
    forceSync: () => Promise<{ synced: number; conflicts: number; errors: number }>
    hydrate: () => Promise<{ success: boolean; counts?: Record<string, number> }>
    getConflicts: () => Promise<any[]>
    addToOutbox: (entry: any) => Promise<string>
    getPendingEntries: () => Promise<any[]>
    getDevices: () => Promise<any[]>
    resolveConflict: (conflictId: string, resolution: string, mergedValues?: string) => Promise<{ success: boolean }>
    onStatusChanged: (callback: (status: any) => void) => () => void
    onProgress: (callback: (progress: any) => void) => () => void
  }
  auth: {
    setToken: (token: string) => Promise<{ success: boolean }>
    getToken: () => Promise<string | null>
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
