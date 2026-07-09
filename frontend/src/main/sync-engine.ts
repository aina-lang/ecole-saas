import { net } from 'electron'
import {
  getDatabase,
  getPendingEntries,
  markEntrySynced,
  markEntryConflict,
  markEntryError,
  getDeviceId,
  setLastSyncTimestamp,
  getLastSyncTimestamp,
  getConflictCount,
  getPendingCount,
  addToOutbox,
  saveLocalStudents,
  saveLocalGrades,
  saveLocalAttendance,
  getLocalStudents,
} from './database'

let syncInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false
let onlineStatus = false

const API_BASE = 'http://localhost:3000/api/v1'

export function getOnlineStatus(): boolean {
  return onlineStatus
}

function checkConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: 'GET',
        url: `${API_BASE}/auth/login`,
        timeout: 5000,
      })
      request.on('response', (response) => {
        resolve(response.statusCode < 500)
      })
      request.on('error', () => resolve(false))
      request.end()
    } catch {
      resolve(false)
    }
  })
}

export async function checkAndUpdateConnectivity(): Promise<boolean> {
  const wasOnline = onlineStatus
  onlineStatus = await checkConnectivity()
  if (wasOnline !== onlineStatus) {
    notifyStatusChange()
  }
  return onlineStatus
}

function notifyStatusChange() {
  const { BrowserWindow } = require('electron')
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('sync:status-changed', { isOnline: onlineStatus })
  }
}

async function makeApiRequest(
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const url = `${API_BASE}${path}`
      const request = net.request({
        method,
        url,
        timeout: 30000,
      })

      request.setHeader('Content-Type', 'application/json')

      const token = localStorage ? null : null
      const { BrowserWindow } = require('electron')
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        // We pass auth via query for simplicity in this setup
      }

      let responseData = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk.toString()
        })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            if (response.statusCode >= 400) {
              reject(new Error(parsed.message || `HTTP ${response.statusCode}`))
            } else {
              resolve(parsed)
            }
          } catch {
            resolve(responseData)
          }
        })
      })
      request.on('error', (err) => reject(err))

      if (body) {
        request.write(JSON.stringify(body))
      }
      request.end()
    } catch (err) {
      reject(err)
    }
  })
}

export async function performSync(): Promise<{
  synced: number
  conflicts: number
  errors: number
}> {
  if (isSyncing) return { synced: 0, conflicts: 0, errors: 0 }

  const isOnline = await checkAndUpdateConnectivity()
  if (!isOnline) {
    return { synced: 0, conflicts: 0, errors: 0 }
  }

  isSyncing = true
  let synced = 0
  let conflicts = 0
  let errors = 0

  try {
    const db = await getDatabase()
    const deviceId = getDeviceId()
    const lastSyncTimestamp = getLastSyncTimestamp()

    const pendingEntries = getPendingEntries(500)

    if (pendingEntries.length > 0) {
      const batch = {
        deviceId,
        deviceName: 'Electron Desktop',
        entries: pendingEntries.map((e: any) => ({
          localId: e.id,
          entityType: e.entity_type,
          entityId: e.entity_id,
          operation: e.operation,
          payload: JSON.parse(e.payload),
          version: e.version,
          deviceId: e.device_id,
          clientTimestamp: e.created_at,
        })),
        lastSyncTimestamp: lastSyncTimestamp || undefined,
      }

      try {
        const result = await makeApiRequest('POST', '/sync/batch', batch)

        for (const r of result.results || []) {
          if (r.status === 'SYNCED') {
            markEntrySynced(r.localId, r.serverId)
            synced++
          } else if (r.status === 'CONFLICT') {
            markEntryConflict(r.localId, JSON.stringify(r.conflictData))
            conflicts++
          } else if (r.status === 'ERROR') {
            markEntryError(r.localId, r.errorMessage)
            errors++
          }
        }

        if (result.changes && result.changes.length > 0) {
          applyServerChanges(result.changes)
        }

        if (result.serverTimestamp) {
          setLastSyncTimestamp(result.serverTimestamp)
        }
      } catch (err: any) {
        console.error('Sync batch failed:', err.message)
        errors = pendingEntries.length
      }
    } else {
      try {
        const changes = await makeApiRequest(
          'POST',
          '/sync/poll',
          { deviceId, lastSyncTimestamp: lastSyncTimestamp || undefined },
        )
        if (changes?.changes) {
          applyServerChanges(changes.changes)
          if (changes.serverTimestamp) {
            setLastSyncTimestamp(changes.serverTimestamp)
          }
        }
      } catch {
        // No changes to sync
      }
    }
  } catch (err: any) {
    console.error('Sync error:', err.message)
  } finally {
    isSyncing = false
    notifyProgress({ synced, conflicts, errors })
  }

  return { synced, conflicts, errors }
}

function applyServerChanges(changes: any[]) {
  const db = getDatabase()

  for (const change of changes) {
    switch (change.entityType) {
      case 'Student':
        if (change.operation === 'DELETE') {
          db.prepare("UPDATE students_local SET deleted_at = datetime('now'), synced = 1 WHERE id = ?").run(change.entityId)
        } else {
          saveLocalStudents([change.payload])
        }
        break
      case 'Grade':
        if (change.operation === 'DELETE') {
          db.prepare("UPDATE grades_local SET deleted_at = datetime('now'), synced = 1 WHERE id = ?").run(change.entityId)
        } else {
          saveLocalGrades([change.payload])
        }
        break
      case 'Attendance':
        if (change.operation === 'DELETE') {
          db.prepare("UPDATE attendance_local SET deleted_at = datetime('now'), synced = 1 WHERE id = ?").run(change.entityId)
        } else {
          saveLocalAttendance([change.payload])
        }
        break
    }
  }
}

function notifyProgress(stats: { synced: number; conflicts: number; errors: number }) {
  const { BrowserWindow } = require('electron')
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('sync:progress', {
      ...stats,
      pendingCount: getPendingCount(),
      conflictCount: getConflictCount(),
    })
  }
}

export function startSyncScheduler(intervalMs: number = 30000) {
  if (syncInterval) clearInterval(syncInterval)
  syncInterval = setInterval(async () => {
    await checkAndUpdateConnectivity()
    if (onlineStatus) {
      await performSync()
    }
  }, intervalMs)
  checkAndUpdateConnectivity()
}

export function stopSyncScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

export function forceSyncNow(): Promise<{ synced: number; conflicts: number; errors: number }> {
  return performSync()
}
