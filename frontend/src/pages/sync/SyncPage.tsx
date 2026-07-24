import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getSyncStatus, performSync } from '@/lib/db/sync-manager'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ReloadIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  TimerIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons'

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  pendingCount: number
  conflictCount: number
}

export function SyncPage() {
  const queryClient = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const s = await getSyncStatus()
      return s as SyncStatus
    },
    refetchInterval: 5000
  })

  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      await performSync()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      toast.success('Synchronisation terminée avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la synchronisation')
    }
  })

  async function handleForceSync() {
    if (!status?.isOnline) {
      toast.error('Impossible de synchroniser : mode hors ligne')
      return
    }
    forceSyncMutation.mutate()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Synchronisation</h2>
          <p className="text-muted-foreground">
            Gérez la synchronisation des données entre l'application locale et le serveur
          </p>
        </div>
        <Button
          onClick={handleForceSync}
          disabled={forceSyncMutation.isPending || status?.isSyncing || !status?.isOnline}
        >
          {forceSyncMutation.isPending || status?.isSyncing ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Synchronisation...
            </>
          ) : (
            <>
              <ReloadIcon className="mr-2 h-4 w-4" />
              Synchroniser maintenant
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Statut</CardTitle>
            <span className={`h-3 w-3 rounded-full ${status?.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-lg font-bold">
              {status?.isOnline ? (
                <><CheckCircledIcon className="h-5 w-5 text-green-600" /> En ligne</>
              ) : (
                <><CrossCircledIcon className="h-5 w-5 text-red-600" /> Hors ligne</>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dernière synchro</CardTitle>
            <TimerIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {status?.lastSyncAt
                ? format(new Date(status.lastSyncAt), 'HH:mm:ss', { locale: fr })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.lastSyncAt
                ? format(new Date(status.lastSyncAt), 'dd/MM/yyyy', { locale: fr })
                : 'Jamais synchronisé'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            <TimerIcon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{status?.pendingCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">opérations à synchroniser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conflits</CardTitle>
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{status?.conflictCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">conflits à résoudre</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
