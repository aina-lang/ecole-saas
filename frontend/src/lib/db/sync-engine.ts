import PouchDB from 'pouchdb'
import client from '@/api/client'
import { useSyncStore } from '@/stores/sync-store'
import {
  createDatabase,
  bulkCreateDocuments,
  deleteDocument,
  type EntityType,
} from './pouchdb'

const SYNC_QUEUE_DB = 'ecole_saas_sync_queue'
const SYNC_META_DB = 'ecole_saas_sync_meta'
const SYNC_DEVICE_ID_KEY = 'sync_device_id'

function getDeviceId(): string {
  let id = localStorage.getItem(SYNC_DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SYNC_DEVICE_ID_KEY, id)
  }
  return id
}

function getQueueDb(): PouchDB.Database {
  return new PouchDB(SYNC_QUEUE_DB, { adapter: 'idb' })
}

function getMetaDb(): PouchDB.Database {
  return new PouchDB(SYNC_META_DB, { adapter: 'idb' })
}

export interface QueuedOperation {
  _id: string
  entityType: EntityType
  entityId: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>
  version: number
  deviceId: string
  createdAt: string
  retryCount: number
}

export interface SyncResult {
  entityType: EntityType
  ok: boolean
  synced: number
  errors: number
  conflicts: number
  error?: string
}

export interface SyncSnapshot {
  students: Record<string, unknown>[]
  grades: Record<string, unknown>[]
  attendance: Record<string, unknown>[]
  classes: Record<string, unknown>[]
  subjects: Record<string, unknown>[]
  teachers: Record<string, unknown>[]
  serverTimestamp: string
}

const QUEUE_ENTITY_TYPES: EntityType[] = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject',
]

export async function enqueueOperation(
  entityType: EntityType,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getQueueDb()
  try {
    const doc: QueuedOperation = {
      _id: `${entityType}_${entityId}_${Date.now()}`,
      entityType,
      entityId,
      operation,
      payload,
      version: Date.now(),
      deviceId: getDeviceId(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }
    await db.put(doc)
    useSyncStore.getState().incrementPending()
  } finally {
    db.close()
  }
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = getQueueDb()
  try {
    const result = await db.allDocs({ include_docs: true })
    return result.rows
      .map((r: any) => r.doc as QueuedOperation)
      .filter(Boolean)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } finally {
    db.close()
  }
}

export async function removeOperation(id: string): Promise<void> {
  const db = getQueueDb()
  try {
    const doc = await db.get(id)
    await db.remove(doc)
    useSyncStore.getState().decrementPending()
  } catch {
  } finally {
    db.close()
  }
}

export async function incrementRetry(operation: QueuedOperation): Promise<void> {
  if (operation.retryCount >= 5) {
    await removeOperation(operation._id)
    return
  }
  const db = getQueueDb()
  try {
    const doc = await db.get(operation._id)
    await db.put({ ...doc, retryCount: doc.retryCount + 1 })
  } catch {
  } finally {
    db.close()
  }
}

async function getLastSyncTimestamp(entityType: string): Promise<string | null> {
  const db = getMetaDb()
  try {
    try {
      const doc = await db.get(`last_sync_${entityType}`)
      return (doc as any).timestamp || null
    } catch {
      return null
    }
  } finally {
    db.close()
  }
}

async function setLastSyncTimestamp(entityType: string, timestamp: string): Promise<void> {
  const db = getMetaDb()
  try {
    const id = `last_sync_${entityType}`
    try {
      const existing = await db.get(id)
      await db.put({ ...existing, timestamp })
    } catch {
      await db.put({ _id: id, timestamp })
    }
  } finally {
    db.close()
  }
}

async function mapEntityToDoc(entityType: EntityType, entity: any): Promise<any> {
  const doc = { ...entity }
  const rawId = entity.id ?? entity._id
  if (rawId == null) {
    console.warn(`[Sync] ${entityType} entity missing id:`, entity)
    doc._id = `${entityType.toLowerCase()}-${crypto.randomUUID()}`
  } else {
    doc._id = String(rawId)
  }
  delete doc.id
  delete doc.tenantId
  if (entityType === 'Class') {
    doc.entityType = 'class'
  }
  return doc
}

async function storeSnapshotEntity(entityType: EntityType, entities: any[]): Promise<void> {
  if (!entities.length) return
  try {
    const docs = entities.map((e) => {
      try {
        return mapEntityToDoc(entityType, e)
      } catch (err) {
        console.error(`[Sync] mapEntityToDoc error for ${entityType}:`, err, e)
        return null
      }
    }).filter(Boolean) as any[]
    if (!docs.length) return
    const validDocs = docs.filter((d) => {
      const hasId = d._id && String(d._id).trim()
      if (!hasId) console.warn(`[Sync] ${entityType} doc missing _id:`, JSON.stringify(d))
      return hasId
    })
    if (!validDocs.length) return
    const db = createDatabase(entityType)
    try {
      const existing = await db.allDocs({ include_docs: false })
      const existingIds = new Set(existing.rows.map((r: any) => r.id))
      const toDelete = existingIds
      for (const doc of validDocs) {
        toDelete.delete(doc._id)
        try {
          const existingDoc = await db.get(doc._id)
          await db.put({ ...doc, _rev: existingDoc._rev })
        } catch (putErr) {
          try {
            await db.put(doc)
          } catch (createErr) {
            console.error(`[Sync] Failed to put ${entityType} doc:`, { _id: doc._id, error: createErr.message })
          }
        }
      }
      for (const id of toDelete) {
        try {
          const doc = await db.get(id)
          await db.remove(doc)
        } catch {
        }
      }
    } finally {
      db.close()
    }
  } catch (err) {
    console.error(`[Sync] Unexpected error storing ${entityType}:`, err)
  }
}

export async function fetchSnapshot(): Promise<SyncSnapshot | null> {
  try {
    console.log('[Sync] GET /sync/snapshot')
    const { data } = await client.get('/sync/snapshot')
    console.log('[Sync] snapshot response', data)
    return data as SyncSnapshot
  } catch (err) {
    console.error('[Sync] snapshot error', err)
    return null
  }
}

export async function applySnapshot(snapshot: SyncSnapshot): Promise<void> {
  console.log('[Sync] Applying snapshot with timestamp:', snapshot.serverTimestamp)
  const entityMap: [EntityType, any[]][] = [
    ['Class', snapshot.classes ?? []],
    ['Subject', snapshot.subjects ?? []],
    ['Teacher', snapshot.teachers ?? []],
    ['Student', snapshot.students ?? []],
    ['Grade', snapshot.grades ?? []],
    ['Attendance', snapshot.attendance ?? []],
  ]

  await Promise.all(
    entityMap.map(([type, entities]) =>
      storeSnapshotEntity(type, entities).catch((err) => {
        console.error(`[Sync] Error storing ${type} entities:`, err)
      }),
    ),
  )

  for (const [type] of entityMap) {
    await setLastSyncTimestamp(type, snapshot.serverTimestamp)
  }
  console.log('[Sync] Snapshot applied successfully')
}

export async function processQueue(): Promise<{
  synced: number
  conflicts: number
  errors: number
}> {
  const operations = await getPendingOperations()
  if (!operations.length) return { synced: 0, conflicts: 0, errors: 0 }

  const store = useSyncStore.getState()
  store.setSyncing(true)

  let synced = 0
  let conflicts = 0
  let errors = 0

  try {
    const batchSize = 50
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize)
      const entries = batch.map((op) => ({
        localId: op._id,
        entityType: op.entityType,
        entityId: op.entityId,
        operation: op.operation,
        payload: op.payload,
        version: op.version,
        deviceId: op.deviceId,
      }))

      try {
        const lastSync = await getLastSyncTimestamp(op.entityType)
        const { data } = await client.post('/sync/batch', {
          deviceId: getDeviceId(),
          deviceName: 'Electron Desktop',
          entries,
          lastSyncTimestamp: lastSync || undefined,
        })

        for (const result of data.results || []) {
          if (result.status === 'SYNCED') {
            await removeOperation(result.localId)
            synced++
          } else if (result.status === 'CONFLICT') {
            conflicts++
          } else {
            const op = batch.find((o) => o.localId === result.localId)
            if (op) {
              const qOp = await findOperation(op.localId)
              if (qOp) await incrementRetry(qOp)
            }
            errors++
          }
        }

        if (data.changes?.length) {
          await applyChanges(data.changes)
        }

        if (data.serverTimestamp) {
          await setLastSyncTimestamp('_all', data.serverTimestamp)
        }
      } catch {
        for (const op of batch) {
          const qOp = await findOperation(op.localId)
          if (qOp) await incrementRetry(qOp)
        }
        errors += batch.length
      }
    }
  } finally {
    store.setSyncing(false)
  }

  return { synced, conflicts, errors }
}

async function findOperation(localId: string): Promise<QueuedOperation | null> {
  const db = getQueueDb()
  try {
    try {
      const doc = await db.get(localId)
      return doc as QueuedOperation
    } catch {
      return null
    }
  } finally {
    db.close()
  }
}

async function applyChanges(changes: any[]): Promise<void> {
  const groups: Record<string, { entityType: EntityType; entities: any[] }> = {}

  for (const change of changes) {
    const et = change.entityType as EntityType
    if (!groups[et]) groups[et] = { entityType: et, entities: [] }

    if (change.operation === 'DELETE') {
      try {
        const db = createDatabase(et)
        try {
          const doc = await db.get(change.entityId)
          await db.remove(doc)
        } catch {
        } finally {
          db.close()
        }
      } catch {
      }
      continue
    }

    const doc = { ...change.payload, _id: change.entityId, _rev: undefined }
    groups[et].entities.push(doc)
  }

  for (const { entityType, entities } of Object.values(groups)) {
    if (!entities.length) continue
    const db = createDatabase(entityType)
    try {
      const merged = await Promise.all(
        entities.map(async (doc: any) => {
          try {
            const existing = await db.get(doc._id)
            return { ...doc, _rev: existing._rev }
          } catch {
            return doc
          }
        }),
      )
      await db.bulkDocs(merged)
    } catch {
    } finally {
      db.close()
    }
  }
}

export async function pollChanges(entityType: EntityType): Promise<void> {
  const lastSync = await getLastSyncTimestamp(entityType)
  try {
    const { data } = await client.post('/sync/poll', {
      deviceId: getDeviceId(),
      lastSyncTimestamp: lastSync || undefined,
    })
    if (data.changes?.length) {
      await applyChanges(data.changes)
    }
    if (data.serverTimestamp) {
      await setLastSyncTimestamp(entityType, data.serverTimestamp)
    }
  } catch {
  }
}

export async function pollAllChanges(): Promise<void> {
  const types: EntityType[] = ['Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher']
  await Promise.allSettled(types.map(pollChanges))
}

export async function syncAll(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  store.setSyncing(true)

  const results: SyncResult[] = []

  try {
    const snapshot = await fetchSnapshot()
    if (snapshot) {
      await applySnapshot(snapshot)
    }

    const queueResult = await processQueue()

    results.push({
      entityType: 'Student',
      ok: true,
      synced: queueResult.synced,
      errors: queueResult.errors,
      conflicts: queueResult.conflicts,
    })
  } catch (err: any) {
    results.push({
      entityType: 'Student',
      ok: false,
      synced: 0,
      errors: 1,
      conflicts: 0,
      error: err.message,
    })
  } finally {
    store.setSyncing(false)
    store.setLastSync(new Date().toISOString())
  }

  return results
}

export async function registerDevice(): Promise<void> {
  try {
    await client.post('/sync/device', {
      deviceId: getDeviceId(),
      deviceName: 'Electron Desktop',
    })
  } catch {
  }
}

export async function getSyncStatusFromServer(): Promise<{
  deviceCount: number
  pendingJobs: number
  unresolvedConflicts: number
  devices: { deviceId: string; deviceName: string; lastSyncAt: string | null }[]
  recentSyncs: any[]
}> {
  try {
    const { data } = await client.get('/sync/status')
    return data
  } catch {
    return { deviceCount: 0, pendingJobs: 0, unresolvedConflicts: 0, devices: [], recentSyncs: [] }
  }
}
