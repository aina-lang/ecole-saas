import {
  syncAll,
  fetchSnapshot,
  applySnapshot,
  processQueue,
  pollAllChanges,
  registerDevice,
  getSyncStatusFromServer,
} from './sync-engine'
import { useSyncStore } from '@/stores/sync-store'
import { flushQueue, getQueueStats } from './offline-queue'

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
let syncInterval: ReturnType<typeof setInterval> | null = null
let isInitialized = false

export async function initSyncEngine(): Promise<void> {
  if (isInitialized) return
  isInitialized = true

  const store = useSyncStore.getState()
  console.log('[Sync] Initializing sync engine, online:', navigator.onLine)

  onlineListener = () => {
    store.setOnline(true)
    scheduleSync()
  }

  offlineListener = () => {
    store.setOnline(false)
  }

  window.addEventListener('online', onlineListener)
  window.addEventListener('offline', offlineListener)

  await registerDevice()
  console.log('[Sync] Device registered')

  const queueStats = await getQueueStats()
  store.setPendingCount(queueStats.total)
  console.log('[Sync] Pending count:', queueStats.total)

  startPeriodicSync()
  console.log('[Sync] Periodic sync started')

  if (navigator.onLine) {
    console.log('[Sync] Online on init, triggering sync')
    scheduleSync()
  }
}

export function startPeriodicSync(intervalMs = 60000): void {
  if (syncInterval) clearInterval(syncInterval)
  syncInterval = setInterval(async () => {
    if (navigator.onLine) {
      await performSync()
    }
  }, intervalMs)
}

export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

let syncInProgress = false

export async function performSync(): Promise<SyncResult[]> {
  console.log('[Sync] performSync called, online:', navigator.onLine)
  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync')
    return [{ entityType: '_all', ok: false, synced: 0, errors: 0, conflicts: 0, error: 'Hors ligne' }]
  }

  if (syncInProgress) {
    console.log('[Sync] Sync already in progress, skipping')
    return []
  }

  syncInProgress = true
  const store = useSyncStore.getState()
  store.setSyncing(true)
  store.setError(null)

  try {
    console.log('[Sync] Fetching snapshot...')
    const snapshot = await fetchSnapshot()
    if (snapshot) {
      console.log('[Sync] Snapshot fetched, applying...')
      await applySnapshot(snapshot)
      store.setLastSync(snapshot.serverTimestamp)
      console.log('[Sync] Snapshot applied, last sync:', snapshot.serverTimestamp)
    } else {
      console.log('[Sync] No snapshot received')
    }

    console.log('[Sync] Processing queue...')
    const queueResult = await processQueue()

    console.log('[Sync] Polling changes...')
    await pollAllChanges()

    const queueStats = await getQueueStats()
    store.setPendingCount(queueStats.total)
    console.log('[Sync] Queue stats:', queueStats)

    const results: SyncResult[] = [
      {
        entityType: '_all',
        ok: queueResult.errors === 0,
        synced: queueResult.synced,
        errors: queueResult.errors,
        conflicts: queueResult.conflicts,
      },
    ]

    return results
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
    syncInProgress = false
  }
}

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null

export function scheduleSync(): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
  }
  scheduledTimeout = setTimeout(
    () => {
      performSync()
    },
    2000,
  )
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
  let serverStatus = null
  try {
    serverStatus = await getSyncStatusFromServer()
  } catch {
  }

  return {
    isOnline: navigator.onLine,
    pendingCount: store.pendingCount,
    lastSyncAt: store.lastSyncAt,
    isSyncing: store.isSyncing,
    conflictCount: store.conflictCount,
    serverStatus,
  }
}

export function destroySyncEngine(): void {
  stopPeriodicSync()

  if (onlineListener) {
    window.removeEventListener('online', onlineListener)
    onlineListener = null
  }
  if (offlineListener) {
    window.removeEventListener('offline', offlineListener)
    offlineListener = null
  }

  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }

  syncInProgress = false
  isInitialized = false
}
