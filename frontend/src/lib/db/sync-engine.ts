import PouchDB from 'pouchdb'
import { useSyncStore } from '@/stores/sync-store'
import { createDatabase, createRemoteDatabase, createSync, type EntityType } from './pouchdb'

const SYNC_META_DB = 'ecole_saas_sync_meta'
const SYNC_DEVICE_ID_KEY = 'sync_device_id'

export interface SyncResult {
  entityType: EntityType
  ok: boolean
  synced: number
  errors: number
  conflicts: number
  error?: string
}

const SYNC_ENTITY_TYPES: EntityType[] = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
]

const activeSyncs = new Map<string, PouchDB.Replication.Sync>()

function getDeviceId(): string {
  let id = localStorage.getItem(SYNC_DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SYNC_DEVICE_ID_KEY, id)
  }
  return id
}

function getMetaDb(): PouchDB.Database {
  return new PouchDB(SYNC_META_DB, { adapter: 'idb' })
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

export async function startEntitySync(entityType: EntityType): Promise<PouchDB.Replication.Sync> {
  const key = `${entityType}`
  if (activeSyncs.has(key)) {
    return activeSyncs.get(key)!
  }

  const sync = createSync(entityType, {
    live: true,
    retry: true,
    back_off_function: (delay: number) => Math.min(delay * 2, 60000),
  })

  const store = useSyncStore.getState()

  sync.on('change', (change) => {
    if (change.direction === 'push' && change.change?.docs_written) {
      store.setEntityStatus(entityType, { syncing: false })
    }
    if (change.direction === 'pull' && change.change?.docs_read) {
      store.setLastSync(new Date().toISOString())
    }
  })

  sync.on('paused', () => {
    store.setSyncing(false)
  })

  sync.on('active', () => {
    store.setSyncing(true)
  })

  sync.on('complete', () => {
    activeSyncs.delete(key)
  })

  sync.on('error', (err) => {
    console.error(`[Sync] ${entityType} replication error:`, err)
    activeSyncs.delete(key)
  })

  activeSyncs.set(key, sync)
  return sync
}

export function stopEntitySync(entityType: EntityType): void {
  const key = `${entityType}`
  const sync = activeSyncs.get(key)
  if (sync) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

export function stopAllSyncs(): void {
  for (const [key, sync] of activeSyncs) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

export async function startAllSyncs(): Promise<void> {
  const results = await Promise.allSettled(
    SYNC_ENTITY_TYPES.map((type) => startEntitySync(type)),
  )
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      console.error(`[Sync] Failed to start sync for ${SYNC_ENTITY_TYPES[i]}:`, results[i])
    }
  }
}

export async function syncEntityNow(entityType: EntityType): Promise<{
  docsRead: number
  docsWritten: number
  docsFailed: number
}> {
  const local = createDatabase(entityType)
  const remote = createRemoteDatabase(entityType)

  try {
    const pushResult = await local.replicate.to(remote, { batch_size: 100 })
    const pullResult = await local.replicate.from(remote, { batch_size: 100 })

    const timestamp = new Date().toISOString()
    await setLastSyncTimestamp(entityType, timestamp)
    useSyncStore.getState().setLastSync(timestamp)

    return {
      docsRead: pullResult.docs_read,
      docsWritten: pushResult.docs_written,
      docsFailed: (pushResult.docs_failed || 0) + (pullResult.docs_failed || 0),
    }
  } finally {
    local.close()
    remote.close()
  }
}

export async function syncAllNow(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  store.setSyncing(true)
  store.setError(null)

  const results: SyncResult[] = []

  for (const entityType of SYNC_ENTITY_TYPES) {
    try {
      const result = await syncEntityNow(entityType)
      results.push({
        entityType,
        ok: result.docsFailed === 0,
        synced: result.docsWritten,
        errors: result.docsFailed,
        conflicts: 0,
      })
    } catch (err: any) {
      results.push({
        entityType,
        ok: false,
        synced: 0,
        errors: 1,
        conflicts: 0,
        error: err.message,
      })
    }
  }

  const hasErrors = results.some((r) => !r.ok)
  if (hasErrors) {
    store.setError('Certaines entités n\'ont pas pu être synchronisées')
  }

  store.setSyncing(false)
  store.setLastSync(new Date().toISOString())

  return results
}

export async function getPendingOperations(): Promise<any[]> {
  const replicating = Array.from(activeSyncs.keys())
  return replicating.map((key) => ({ entityType: key, status: 'replicating' }))
}
