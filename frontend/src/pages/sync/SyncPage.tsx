import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSyncStore } from '@/stores/sync-store'

export function SyncPage() {
  const isOnline = useSyncStore((s) => s.isOnline)
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const conflictCount = useSyncStore((s) => s.conflictCount)
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Synchronisation</h2>
        <p className="text-muted-foreground">
          Gérez la synchronisation des données entre l'application locale et le serveur.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-lg font-bold">
              <span
                className={`h-3 w-3 rounded-full ${
                  isOnline ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">opérations à synchroniser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Conflits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conflictCount}</div>
            <p className="text-xs text-muted-foreground">conflits à résoudre</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button disabled={isSyncing || !isOnline}>
            {isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
          </Button>
          <Button variant="outline" disabled>
            Forcer la synchronisation
          </Button>
        </CardContent>
      </Card>

      {lastSyncAt && (
        <p className="text-sm text-muted-foreground">
          Dernière synchronisation : {lastSyncAt}
        </p>
      )}
    </div>
  )
}