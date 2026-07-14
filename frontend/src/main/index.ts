import { app, shell, BrowserWindow, ipcMain, protocol, session } from 'electron'
import { join, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync, existsSync } from 'fs'
import {
  getDatabase, closeDatabase, getPendingCount, getConflictCount, getDeviceId,
  addToOutbox, getLocalStudents, saveLocalStudents, saveLocalGrades,
  saveLocalAttendance, getConflicts, saveFileLocally, getFileUploadCount,
  getFileUploadByEntity, saveEntity, queryEntities, getEntityById,
  softDeleteEntity, markEntitySynced, getLocalTableConfig,
  getSetting, setSetting, getAllSettings,
  saveAuditLog, getAuditLogs,
  getPendingEntries, getLastSyncTimestamp,
} from './database'
import { startSyncScheduler, stopSyncScheduler, performSync, getOnlineStatus, checkAndUpdateConnectivity } from './sync-engine'

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
  ipcMain.handle('db:get-students', async (_event, filters) => {
    return getLocalStudents(filters)
  })

  ipcMain.handle('db:save-students', async (_event, students) => {
    saveLocalStudents(students)
    for (const s of students) {
      addToOutbox('Student', s.id || s.localId, 'CREATE', s)
    }
    return { success: true }
  })

  ipcMain.handle('db:save-grades', async (_event, grades) => {
    saveLocalGrades(grades)
    for (const g of grades) {
      addToOutbox('Grade', g.id || g.localId, 'CREATE', g)
    }
    return { success: true }
  })

  ipcMain.handle('db:save-attendance', async (_event, records) => {
    saveLocalAttendance(records)
    for (const r of records) {
      addToOutbox('Attendance', r.id || r.localId, 'CREATE', r)
    }
    return { success: true }
  })

  ipcMain.handle('sync:status', async () => {
    return {
      isOnline: getOnlineStatus(),
      pendingCount: getPendingCount(),
      conflictCount: getConflictCount(),
      deviceId: getDeviceId(),
    }
  })

  ipcMain.handle('sync:force', async () => {
    return performSync()
  })

  ipcMain.handle('sync:conflicts', async () => {
    return getConflicts()
  })

  ipcMain.handle('sync:add-to-outbox', async (_event, entry) => {
    return addToOutbox(entry.entityType, entry.entityId, entry.operation, entry.payload, entry.version)
  })

  ipcMain.handle('db:add-to-outbox', async (_event, entry) => {
    addToOutbox(entry.entityType, entry.entityId, entry.operation, entry.payload, entry.version || 1)
    return { success: true }
  })

  ipcMain.handle('local:save', async (_event, entityType, data) => {
    const ok = saveEntity(entityType, data)
    if (ok) {
      addToOutbox(entityType, data.id, data.id ? 'UPDATE' : 'CREATE', data)
    }
    return { success: ok }
  })

  ipcMain.handle('local:query', async (_event, entityType, filters) => {
    return queryEntities(entityType, filters)
  })

  ipcMain.handle('local:get-by-id', async (_event, entityType, id) => {
    return getEntityById(entityType, id)
  })

  ipcMain.handle('local:delete', async (_event, entityType, id) => {
    const ok = softDeleteEntity(entityType, id)
    if (ok) {
      addToOutbox(entityType, id, 'DELETE', { id })
    }
    return { success: ok }
  })

  ipcMain.handle('local:mark-synced', async (_event, entityType, id) => {
    markEntitySynced(entityType, id)
    return { success: true }
  })

  ipcMain.handle('local:get-config', async (_event, entityType) => {
    return getLocalTableConfig(entityType)
  })

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

  ipcMain.handle('local:save-audit-log', async (_event, entry) => {
    saveAuditLog(entry)
    return { success: true }
  })

  ipcMain.handle('local:get-audit-logs', async (_event, filters) => {
    return getAuditLogs(filters)
  })

  ipcMain.handle('sync:get-pending-entries', async () => {
    return getPendingEntries()
  })

  ipcMain.handle('sync:get-devices', async () => {
    const deviceId = getDeviceId()
    return [{ id: deviceId, deviceName: 'Electron Desktop', deviceType: 'desktop', lastSyncAt: getLastSyncTimestamp(), isOnline: getOnlineStatus() }]
  })

  ipcMain.handle('sync:resolve-conflict', async (_event, conflictId, resolution, mergedValues) => {
    import('./sync-engine').then(({ performSync }) => {
      markEntrySynced(conflictId)
      performSync()
    })
    return { success: true }
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

  await getDatabase()
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
  startSyncScheduler(30000)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopSyncScheduler()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
