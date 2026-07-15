import {
  startAllSyncs,
  stopAllSyncs,
  syncAllNow,
  getPendingOperations,
} from './sync-engine'
import { fetchCouchDBConfig, configureCouchDB } from './pouchdb'
import { useSyncStore } from '@/stores/sync-store'

export interface SyncResult {
  entityType: string
  ok: boolean
  synced: number
  errors: number
  conflicts: number
  error?: string
}

let onlineListener: (() => void) | null = null
let offlineListener: (() => void) | null = null
let isInitialized = false

export async function initSyncEngine(): Promise<void> {
  if (isInitialized) return
  isInitialized = true

  const store = useSyncStore.getState()
  console.log('[Sync] Initializing PouchDB-CouchDB sync engine, online:', navigator.onLine)

  await fetchCouchDBConfig()

  onlineListener = () => {
    store.setOnline(true)
    startAllSyncs()
  }

  offlineListener = () => {
    store.setOnline(false)
  }

  window.addEventListener('online', onlineListener)
  window.addEventListener('offline', offlineListener)

  if (navigator.onLine) {
    console.log('[Sync] Online on init, starting live sync')
    await startAllSyncs()
  }

  console.log('[Sync] Sync engine initialized')
}

export async function performSync(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync')
    return [{ entityType: '_all', ok: false, synced: 0, errors: 0, conflicts: 0, error: 'Hors ligne' }]
  }

  store.setSyncing(true)
  store.setError(null)

  try {
    console.log('[Sync] Performing one-shot sync...')
    const results = await syncAllNow()
    return results.map((r) => ({
      entityType: r.entityType,
      ok: r.ok,
      synced: r.synced,
      errors: r.errors,
      conflicts: r.conflicts,
      error: r.error,
    }))
  } catch (err: any) {
    console.error('[Sync] Error during sync:', err)
    store.setError(err.message)
    return [
      {
        entityType: '_all',
        ok: false,
        synced: 0,
        errors: 1,
        conflicts: 0,
        error: err.message,
      },
    ]
  } finally {
    store.setSyncing(false)
  }
}

export async function getSyncStatus(): Promise<{
  isOnline: boolean
  pendingCount: number
  lastSyncAt: string | null
  isSyncing: boolean
  conflictCount: number
  serverStatus: any
}> {
  const store = useSyncStore.getState()
  const pending = await getPendingOperations()

  return {
    isOnline: navigator.onLine,
    pendingCount: pending.length,
    lastSyncAt: store.lastSyncAt,
    isSyncing: store.isSyncing,
    conflictCount: store.conflictCount,
    serverStatus: null,
  }
}

export function destroySyncEngine(): void {
  stopAllSyncs()

  if (onlineListener) {
    window.removeEventListener('online', onlineListener)
    onlineListener = null
  }
  if (offlineListener) {
    window.removeEventListener('offline', offlineListener)
    offlineListener = null
  }

  isInitialized = false
}
