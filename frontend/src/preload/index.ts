import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  db: {
    getStudents: (filters?: any) => ipcRenderer.invoke('db:get-students', filters),
    saveStudents: (students: any[]) => ipcRenderer.invoke('db:save-students', students),
    saveGrades: (grades: any[]) => ipcRenderer.invoke('db:save-grades', grades),
    saveAttendance: (records: any[]) => ipcRenderer.invoke('db:save-attendance', records),
    addToOutbox: (entry: any) => ipcRenderer.invoke('db:add-to-outbox', entry),
  },
  local: {
    save: (entityType: string, data: any) => ipcRenderer.invoke('local:save', entityType, data),
    query: (entityType: string, filters?: any) => ipcRenderer.invoke('local:query', entityType, filters),
    getById: (entityType: string, id: string) => ipcRenderer.invoke('local:get-by-id', entityType, id),
    delete: (entityType: string, id: string) => ipcRenderer.invoke('local:delete', entityType, id),
    markSynced: (entityType: string, id: string) => ipcRenderer.invoke('local:mark-synced', entityType, id),
    getConfig: (entityType: string) => ipcRenderer.invoke('local:get-config', entityType),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('local:get-setting', key),
    set: (key: string, value: string) => ipcRenderer.invoke('local:set-setting', key, value),
    getAll: () => ipcRenderer.invoke('local:get-all-settings'),
  },
  audit: {
    save: (entry: any) => ipcRenderer.invoke('local:save-audit-log', entry),
    query: (filters?: any) => ipcRenderer.invoke('local:get-audit-logs', filters),
  },
  file: {
    save: (data: { buffer: ArrayBuffer; entityType: string; entityId: string; fieldName: string; originalName: string; mimeType: string }) =>
      ipcRenderer.invoke('file:save', data),
    getUrl: (localPath: string) => ipcRenderer.invoke('file:get-url', localPath),
    getPendingCount: () => ipcRenderer.invoke('file:get-pending-count'),
    getEntityPhoto: (entityType: string, entityId: string) => ipcRenderer.invoke('file:get-entity-photo', entityType, entityId),
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:status'),
    forceSync: () => ipcRenderer.invoke('sync:force'),
    getConflicts: () => ipcRenderer.invoke('sync:conflicts'),
    addToOutbox: (entry: any) => ipcRenderer.invoke('sync:add-to-outbox', entry),
    getPendingEntries: () => ipcRenderer.invoke('sync:get-pending-entries'),
    getDevices: () => ipcRenderer.invoke('sync:get-devices'),
    resolveConflict: (conflictId: string, resolution: string, mergedValues?: string) =>
      ipcRenderer.invoke('sync:resolve-conflict', conflictId, resolution, mergedValues),
    onStatusChanged: (callback: (status: any) => void) => {
      ipcRenderer.on('sync:status-changed', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('sync:status-changed')
    },
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('sync:progress', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('sync:progress')
    },
  },
  auth: {
    setToken: (token: string) => ipcRenderer.invoke('auth:set-token', token),
    getToken: () => ipcRenderer.invoke('auth:get-token'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as any).electron = electronAPI
  ;(window as any).api = api
}
