import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDatabase, closeDatabase, getPendingCount, getConflictCount, getDeviceId, addToOutbox, getLocalStudents, saveLocalStudents, saveLocalGrades, saveLocalAttendance, getConflicts } from './database'
import { startSyncScheduler, stopSyncScheduler, performSync, getOnlineStatus, checkAndUpdateConnectivity } from './sync-engine'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
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
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ecole-saas')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await getDatabase()
  setupIPC()
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
