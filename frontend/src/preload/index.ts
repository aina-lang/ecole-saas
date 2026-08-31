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
    getDataUrl: (localPath: string) => ipcRenderer.invoke('file:get-data-url', localPath),
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
  clock: {
    load: () => ipcRenderer.invoke('clock:load'),
    save: (state: unknown) => ipcRenderer.invoke('clock:save', state),
  },
  documents: {
    print: (html: string, defaultName: string) =>
      ipcRenderer.invoke('documents:print', { html, defaultName }),
    saveFile: (buffer: ArrayBuffer, defaultName: string, filterName: string, extension: string) =>
      ipcRenderer.invoke('documents:save-file', { buffer, defaultName, filterName, extension }),
  },
  updates: {
    getState: () => ipcRenderer.invoke('updates:get-state'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    // Renvoie la fonction de désabonnement : sans elle, chaque remontage d'un
    // composant React empilerait un écouteur de plus sur le même canal.
    onState: (callback: (state: unknown) => void) => {
      const listener = (_event: unknown, state: unknown) => callback(state)
      ipcRenderer.on('updates:state', listener as never)
      return () => ipcRenderer.removeListener('updates:state', listener as never)
    },
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
