import { net } from 'electron'
import { readFileSync } from 'fs'
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
  getPendingFileUploads,
  markFileSynced,
  markFileError,
  getFileUploadByEntity,
  saveFileLocally,
  saveEntity,
  softDeleteEntity,
} from './database'

let syncInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false
let onlineStatus = false
let authToken: string | null = null

const API_BASE = 'http://localhost:3000/api/v1'

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

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

function reconcileLocalIds(localId: string, serverId: string, entityType: string) {
  if (!entityType || localId === serverId) return

  const db = getDatabase()
  const tableMap: Record<string, { table: string; fk: string }> = {
    Student: { table: 'grades_local', fk: 'student_id' },
    Class: { table: 'grades_local', fk: 'class_id' },
    Subject: { table: 'grades_local', fk: 'subject_id' },
    Teacher: { table: 'grades_local', fk: 'teacher_id' },
  }

  db.run('UPDATE sync_outbox SET entity_id = ? WHERE entity_id = ? AND entity_type = ?', [serverId, localId, entityType])

  const mapping = tableMap[entityType]
  if (mapping) {
    db.run(`UPDATE ${mapping.table} SET ${mapping.fk} = ? WHERE ${mapping.fk} = ?`, [serverId, localId])
  }

  db.run(
    'INSERT OR REPLACE INTO id_mappings (local_id, server_id, entity_type) VALUES (?, ?, ?)',
    [localId, serverId, entityType],
  )
  saveDatabase()
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

      if (authToken) {
        request.setHeader('Authorization', `Bearer ${authToken}`)
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

function uploadFileToServer(fileEntry: any, serverId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const filePath = fileEntry.local_path
      const fileBuffer = readFileSync(filePath)
      const boundary = `----FormBoundary${Date.now()}`
      const entityType = fileEntry.entity_type
      const fieldName = fileEntry.field_name || 'file'

      let endpoint = ''
      if (entityType === 'Student') endpoint = `/students/${serverId}/photo`
      else if (entityType === 'User') endpoint = `/users/${serverId}/photo`
      else reject(new Error(`Unsupported entity type: ${entityType}`))

      const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileEntry.original_name || 'upload'}"\r\nContent-Type: ${fileEntry.mime_type || 'application/octet-stream'}\r\n\r\n`
      const footer = `\r\n--${boundary}--\r\n`
      const body = Buffer.concat([
        Buffer.from(header, 'utf-8'),
        fileBuffer,
        Buffer.from(footer, 'utf-8'),
      ])

      const request = net.request({
        method: 'POST',
        url: `${API_BASE}${endpoint}`,
        timeout: 60000,
      })

      request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`)
      request.setHeader('Content-Length', body.length.toString())

      let responseData = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            const result = parsed.data ?? parsed
            const remoteUrl = result.photoUrl ?? result.url ?? result.photo_url
            if (remoteUrl) resolve(remoteUrl)
            else reject(new Error('No URL in response'))
          } catch {
            reject(new Error('Failed to parse upload response'))
          }
        })
      })
      request.on('error', (err) => reject(err))
      request.write(body)
      request.end()
    } catch (err) {
      reject(err)
    }
  })
}

async function processFileUploads(): Promise<{ synced: number; errors: number }> {
  const pending = getPendingFileUploads()
  let synced = 0, errors = 0

  for (const fileEntry of pending) {
    try {
      const mappingStmt = getDatabase().exec(
        'SELECT server_id FROM id_mappings WHERE local_id = ? AND entity_type = ?',
        [fileEntry.entity_id, fileEntry.entity_type],
      )
      let serverId = fileEntry.entity_id
      if (mappingStmt.length > 0 && mappingStmt[0].values.length > 0) {
        serverId = mappingStmt[0].values[0][0] as string
      }

      const remoteUrl = await uploadFileToServer(fileEntry, serverId)
      markFileSynced(fileEntry.id, remoteUrl)

      addToOutbox(fileEntry.entity_type, serverId, 'UPDATE', {
        id: serverId,
        [fileEntry.field_name === 'photo_url' ? 'photoUrl' : fileEntry.field_name]: remoteUrl,
      }, 1)

      try {
        const db = getDatabase()
        if (fileEntry.entity_type === 'Student') {
          const existing = getLocalStudents()
          const student = existing.find((s: any) => s.id === fileEntry.entity_id)
          if (student) {
            saveLocalStudents([{ ...student, photoUrl: remoteUrl }])
          }
        }
      } catch { /* ignore local update errors */ }

      synced++
    } catch (err: any) {
      console.error(`File sync failed for ${fileEntry.id}:`, err.message)
      markFileError(fileEntry.id)
      errors++
    }
  }
  return { synced, errors }
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
  let fileSynced = 0
  let fileErrors = 0

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
            if (r.serverId && r.serverId !== r.localId) {
              reconcileLocalIds(r.localId, r.serverId, r.entityType || pendingEntries.find(e => e.id === r.localId)?.entity_type)
            }
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

    const fileResult = await processFileUploads()
    fileSynced = fileResult.synced
    fileErrors = fileResult.errors
  } catch (err: any) {
    console.error('Sync error:', err.message)
  } finally {
    isSyncing = false
    notifyProgress({ synced, conflicts, errors, fileSynced, fileErrors })
  }

  return { synced: synced + fileSynced, conflicts, errors: errors + fileErrors }
}

async function cacheRemoteFile(url: string, entityType: string, entityId: string, fieldName: string): Promise<string | null> {
  try {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const request = net.request({ method: 'GET', url, timeout: 30000 })
      const chunks: Buffer[] = []
      request.on('response', (response) => {
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
      })
      request.on('error', reject)
      request.end()
    })
    const mimeType = 'image/jpeg'
    const ext = 'jpg'
    const originalName = `${fieldName}.${ext}`
    const result = saveFileLocally(buffer, entityType, entityId, fieldName, originalName, mimeType)
    markFileSynced(result.id, url)
    return result.localPath
  } catch {
    return null
  }
}

function applyServerChanges(changes: any[]) {
  const db = getDatabase()

  for (const change of changes) {
    const { entityType, operation, entityId, payload } = change

    if (operation === 'DELETE') {
      softDeleteEntity(entityType, entityId)
      continue
    }

    const saved = saveEntity(entityType, payload)
    if (saved && payload?.photoUrl) {
      cacheRemoteFile(payload.photoUrl, entityType, entityId, 'photo_url')
        .catch(() => {})
    }
  }
}

function notifyProgress(stats: { synced: number; conflicts: number; errors: number; fileSynced?: number; fileErrors?: number }) {
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
