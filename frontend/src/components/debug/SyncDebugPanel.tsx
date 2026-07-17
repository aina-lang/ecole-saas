import { useQuery } from '@tanstack/react-query'
import { getSyncStatus, performSync } from '@/lib/db/sync-manager'

export function SyncDebugPanel() {
  const { data: status, refetch } = useQuery({
    queryKey: ['sync-debug-status'],
    queryFn: async () => {
      const result = await getSyncStatus()
      console.log('[SyncDebug] status', result)
      return result
    },
    refetchInterval: 5000,
  })

  async function handleManualSync() {
    console.log('[SyncDebug] manual sync triggered')
    await performSync()
    await refetch()
  }

  async function handleResetLocal() {
    console.log('[SyncDebug] reset local DB triggered')
    try {
      const api = (window as any).api
      if (api?.db?.reset) {
        const result = await api.db.reset()
        console.log('[SyncDebug] reset local DB result', result)
        alert(result.success ? 'Base locale nettoyée' : 'Erreur: ' + result.error)
      } else {
        alert('API de reset non disponible')
      }
    } catch (error) {
      console.error('[SyncDebug] reset local DB failed', error)
      alert('Erreur lors du reset local')
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sync Debug</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs underline"
            onClick={handleManualSync}
          >
            Sync now
          </button>
          <button
            type="button"
            className="text-xs underline text-red-500"
            onClick={handleResetLocal}
          >
            Reset local
          </button>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        <div>online: {status?.isOnline ? 'yes' : 'no'}</div>
        <div>syncing: {status?.isSyncing ? 'yes' : 'no'}</div>
        <div>pending: {status?.pendingCount ?? '-'}</div>
        <div>lastSync: {status?.lastSyncAt ?? 'never'}</div>
        <div>conflicts: {status?.conflictCount ?? '-'}</div>
      </div>
    </div>
  )
}
