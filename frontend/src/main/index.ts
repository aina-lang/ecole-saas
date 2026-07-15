import { app, shell, BrowserWindow, ipcMain, protocol, session } from 'electron'
import { join, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync, existsSync } from 'fs'
import { getSetting, setSetting, getAllSettings } from './settings'
import { saveFileLocally, getFileUploadCount, getFileUploadByEntity } from './files'
import { setAuthToken, getAuthToken } from './auth'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { roundedCorners: true } : {}),
    title: 'Ecole SaaS - Gestion Scolaire',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const LOCAL_PROTOCOL = 'local-asset'

function registerLocalProtocol() {
  protocol.handle(LOCAL_PROTOCOL, (request) => {
    const filePath = decodeURIComponent(request.url.slice(`${LOCAL_PROTOCOL}://`.length))
    if (existsSync(filePath)) {
      const ext = extname(filePath).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf', '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      return new Response(readFileSync(filePath), {
        headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' },
      })
    }
    return new Response('Not found', { status: 404 })
  })
}

function setupIPC() {
  ipcMain.handle('local:get-setting', async (_event, key) => {
    return getSetting(key)
  })

  ipcMain.handle('local:set-setting', async (_event, key, value) => {
    setSetting(key, value)
    return { success: true }
  })

  ipcMain.handle('local:get-all-settings', async () => {
    return getAllSettings()
  })

  ipcMain.handle('sync:status', async () => {
    return {
      isOnline: navigator.onLine,
      pendingCount: 0,
      conflictCount: 0,
      deviceId: 'desktop',
    }
  })

  ipcMain.handle('sync:force', async () => {
    return { synced: 0, conflicts: 0, errors: 0 }
  })

  ipcMain.handle('db:sync', async (_event, entityType, remoteUrl) => {
    // Sync is handled in the renderer process with PouchDB
    return { ok: true, entityType, remoteUrl }
  })

  ipcMain.handle('sync:get-couchdb-config', async () => {
    const url = getSetting('couchdb_url') || 'http://localhost:5984'
    return { url }
  })

  ipcMain.handle('auth:set-token', async (_event, token) => {
    setAuthToken(token)
    return { success: true }
  })

  ipcMain.handle('auth:get-token', async () => {
    return getAuthToken()
  })

  ipcMain.handle('file:save', async (_event, { buffer, entityType, entityId, fieldName, originalName, mimeType }) => {
    return saveFileLocally(Buffer.from(buffer), entityType, entityId, fieldName, originalName, mimeType)
  })

  ipcMain.handle('file:get-url', async (_event, localPath) => {
    if (!localPath || !existsSync(localPath)) return null
    return `${LOCAL_PROTOCOL}://${localPath}`
  })

  ipcMain.handle('file:get-pending-count', async () => {
    return getFileUploadCount()
  })

  ipcMain.handle('file:get-entity-photo', async (_event, entityType, entityId) => {
    const entry = getFileUploadByEntity(entityType, entityId, 'photo_url')
    if (entry?.local_path && existsSync(entry.local_path)) {
      return `${LOCAL_PROTOCOL}://${entry.local_path}`
    }
    return null
  })

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ecole-saas')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIPC()
  registerLocalProtocol()

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspHeader = details.responseHeaders?.['content-security-policy']
    const csp = Array.isArray(cspHeader) ? cspHeader[0] : cspHeader
    if (csp && !csp.includes('local-asset:')) {
      const fixed = csp.replace(/img-src[^;]*/, '$& local-asset: http://localhost:3000')
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'content-security-policy': [fixed],
        },
      })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
