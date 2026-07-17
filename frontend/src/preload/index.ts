import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  db: {
    sync: (entityType: string, remoteUrl?: string) =>
      ipcRenderer.invoke('db:sync', entityType, remoteUrl),
    reset: () => ipcRenderer.invoke('db:reset'),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('local:get-setting', key),
    set: (key: string, value: string) =>
      ipcRenderer.invoke('local:set-setting', key, value),
    getAll: () => ipcRenderer.invoke('local:get-all-settings'),
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:status'),
    forceSync: () => ipcRenderer.invoke('sync:force'),
    getCouchDBConfig: () => ipcRenderer.invoke('sync:get-couchdb-config'),
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
  file: {
    save: (data: {
      buffer: ArrayBuffer
      entityType: string
      entityId: string
      fieldName: string
      originalName: string
      mimeType: string
    }) => ipcRenderer.invoke('file:save', data),
    getUrl: (localPath: string) => ipcRenderer.invoke('file:get-url', localPath),
    getPendingCount: () => ipcRenderer.invoke('file:get-pending-count'),
    getEntityPhoto: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('file:get-entity-photo', entityType, entityId),
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
