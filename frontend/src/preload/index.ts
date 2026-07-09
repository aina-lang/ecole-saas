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
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:status'),
    forceSync: () => ipcRenderer.invoke('sync:force'),
    getConflicts: () => ipcRenderer.invoke('sync:conflicts'),
    addToOutbox: (entry: any) => ipcRenderer.invoke('sync:add-to-outbox', entry),
    onStatusChanged: (callback: (status: any) => void) => {
      ipcRenderer.on('sync:status-changed', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('sync:status-changed')
    },
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('sync:progress', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('sync:progress')
    },
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
