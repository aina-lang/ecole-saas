import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  db: {
    getStudents: (filters?: any) => Promise<any[]>
    saveStudents: (students: any[]) => Promise<{ success: boolean }>
    saveGrades: (grades: any[]) => Promise<{ success: boolean }>
    saveAttendance: (records: any[]) => Promise<{ success: boolean }>
    addToOutbox: (entry: any) => Promise<string>
  }
  sync: {
    getStatus: () => Promise<{ isOnline: boolean; pendingCount: number; conflictCount: number; deviceId: string }>
    forceSync: () => Promise<{ synced: number; conflicts: number; errors: number }>
    getConflicts: () => Promise<any[]>
    addToOutbox: (entry: any) => Promise<string>
    onStatusChanged: (callback: (status: any) => void) => () => void
    onProgress: (callback: (progress: any) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
