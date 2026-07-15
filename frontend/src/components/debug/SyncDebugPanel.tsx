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

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sync Debug</h3>
        <button
          type="button"
          className="text-xs underline"
          onClick={handleManualSync}
        >
          Sync now
        </button>
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
