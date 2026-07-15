import { useState, useCallback } from 'react'
import { performSync, getSyncStatus, type SyncResult } from './sync-manager'
import { useSyncStore } from '@/stores/sync-store'

export function useSync() {
  const [results, setResults] = useState<SyncResult[]>([])

  const store = useSyncStore()

  const sync = useCallback(async () => {
    store.setSyncing(true)
    store.setError(null)

    try {
      const syncResults = await performSync()
      setResults(syncResults)

      const hasErrors = syncResults.some((r) => !r.ok)
      if (hasErrors) {
        store.setError('Certaines entités n\'ont pas pu être synchronisées')
      }
    } catch (err: any) {
      store.setError(err.message)
    } finally {
      store.setSyncing(false)
    }
  }, [store])

  return {
    sync,
    syncing: store.isSyncing,
    lastSync: store.lastSyncAt ? new Date(store.lastSyncAt) : null,
    results,
    error: store.error,
    isOnline: store.isOnline,
    pendingCount: store.pendingCount,
    conflictCount: store.conflictCount,
  }
}
