import { ElectronAPI } from '@electron-toolkit/preload'

// Doit rester aligné sur UpdateState dans src/main/updater.ts.
export type UpdateState =
  | { status: 'idle' }
  | { status: 'unsupported'; reason: string }
  | { status: 'checking' }
  | { status: 'up-to-date'; checkedAt: number }
  | { status: 'available'; version: string; releaseDate?: string }
  | {
      status: 'downloading'
      version: string
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

interface Api {
  db: {
    sync: (entityType: string, remoteUrl?: string) => Promise<{ ok: boolean; error?: string }>
    reset: () => Promise<{ success: boolean; error?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<{ success: boolean }>
    getAll: () => Promise<Record<string, string>>
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
    }) => Promise<{
      id: string
      entity_type: string
      entity_id: string
      field_name: string
      local_path: string
      original_name: string
      mime_type: string
    }>
    getUrl: (localPath: string) => Promise<string | null>
    getDataUrl: (localPath: string) => Promise<string | null>
    getPendingCount: () => Promise<number>
    getEntityPhoto: (entityType: string, entityId: string) => Promise<string | null>
  }
  clock: {
    load: () => Promise<Record<string, unknown> | null>
    save: (state: unknown) => Promise<{ success: boolean }>
  }
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  updates: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    install: () => Promise<{ success: boolean }>
    onState: (callback: (state: UpdateState) => void) => () => void
  }
  documents: {
    print: (html: string, defaultName: string) => Promise<{ canceled: boolean; filePath?: string }>
    saveFile: (
      buffer: ArrayBuffer,
      defaultName: string,
      filterName: string,
      extension: string
    ) => Promise<{ canceled: boolean; filePath?: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

export {}
