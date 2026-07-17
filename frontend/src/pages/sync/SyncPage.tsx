import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  ReloadIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  TimerIcon,
  ExclamationTriangleIcon,
  CaretSortIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

interface SyncDevice {
  id: string
  deviceName: string
  deviceType: string
  lastSyncAt: string | null
  isOnline: boolean
}

interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  clientVersion: Record<string, unknown>
  serverVersion: Record<string, unknown>
  conflictingFields: string[]
  createdAt: string
}

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  pendingCount: number
  conflictCount: number
}

const mergeSchema = z.object({
  mergedValues: z.string().min(1, 'Les valeurs fusionnées sont requises')
})

type MergeValues = z.infer<typeof mergeSchema>

export function SyncPage() {
  const queryClient = useQueryClient()
  const [syncFilter, setSyncFilter] = useState<string>('all')
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null)
  const [mergeConflictId, setMergeConflictId] = useState<string | null>(null)

  const mergeForm = useForm<MergeValues>({
    resolver: zodResolver(mergeSchema),
    defaultValues: { mergedValues: '' }
  })

  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const s = await window.api.sync.getStatus() as SyncStatus
      return s
    },
    refetchInterval: 5000
  })

  const { data: devices } = useQuery({
    queryKey: ['sync-devices'],
    queryFn: async () => {
      const devices = await window.api.sync.getDevices() as SyncDevice[]
      return devices
    },
    refetchInterval: 10000
  })

  const { data: conflicts } = useQuery({
    queryKey: ['sync-conflicts'],
    queryFn: async () => {
      const allConflicts = await window.api.sync.getConflicts() as SyncConflict[]
      if (syncFilter !== 'all') {
        return allConflicts.filter(c => c.entityType === syncFilter)
      }
      return allConflicts
    },
    refetchInterval: 5000
  })

  const { data: pendingEntries } = useQuery({
    queryKey: ['sync-pending-entries'],
    queryFn: async () => {
      const entries = await window.api.sync.getPendingEntries()
      return entries
    },
    refetchInterval: 5000
  })

  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      await window.api.sync.forceSync()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] })
      queryClient.invalidateQueries({ queryKey: ['sync-pending-entries'] })
      toast.success('Synchronisation terminée avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la synchronisation')
    }
  })

  const keepServerMutation = useMutation({
    mutationFn: async (conflictId: string) => {
      await window.api.sync.resolveConflict(conflictId, 'server')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] })
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      toast.success('Version serveur conservée')
    },
    onError: () => {
      toast.error('Erreur lors de la résolution')
    }
  })

  const keepClientMutation = useMutation({
    mutationFn: async (conflictId: string) => {
      await window.api.sync.resolveConflict(conflictId, 'client')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] })
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      toast.success('Version client conservée')
    },
    onError: () => {
      toast.error('Erreur lors de la résolution')
    }
  })

  const mergeMutation = useMutation({
    mutationFn: async ({ conflictId, mergedValues }: { conflictId: string; mergedValues: string }) => {
      const payload = JSON.parse(mergedValues)
      await window.api.sync.resolveConflict(conflictId, 'merge', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] })
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      setMergeConflictId(null)
      mergeForm.reset()
      toast.success('Fusion effectuée avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la fusion')
    }
  })

  async function handleForceSync() {
    if (!status?.isOnline) {
      toast.error('Impossible de synchroniser : mode hors ligne')
      return
    }
    forceSyncMutation.mutate()
  }

  function openMerge(conflict: SyncConflict) {
    setMergeConflictId(conflict.id)
    mergeForm.setValue('mergedValues', JSON.stringify(conflict.serverVersion, null, 2))
    setExpandedConflict(conflict.id)
  }

  const entityTypeLabels: Record<string, string> = {
    STUDENT: 'Élève',
    CLASS: 'Classe',
    GRADE: 'Note',
    ATTENDANCE: 'Présence',
    PAYMENT: 'Paiement',
    USER: 'Utilisateur',
    SUBJECT: 'Matière'
  }

  const operationLabels: Record<string, string> = {
    create: 'Création',
    update: 'Modification',
    delete: 'Suppression'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries()}
          >
            <ReloadIcon className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Synchronisation</h2>
            <p className="text-muted-foreground">
              Gérez la synchronisation des données entre l'application locale et le serveur
            </p>
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Modifications en attente</CardTitle>
          <CardDescription>Opérations en attente de synchronisation</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type d'entité</TableHead>
                <TableHead>ID Entité</TableHead>
                <TableHead>Opération</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!pendingEntries?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucune modification en attente
                  </TableCell>
                </TableRow>
              ) : (
                pendingEntries.map((entry) => (
                  <TableRow key={entry.localId}>
                    <TableCell className="font-medium">
                      {entityTypeLabels[entry.entityType] || entry.entityType}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.entityId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{operationLabels[entry.operation] || entry.operation}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        entry.status === 'synced' ? 'default' :
                        entry.status === 'pending' ? 'secondary' :
                        entry.status === 'conflict' ? 'destructive' : 'outline'
                      }>
                        {entry.status === 'synced' && 'Synchronisé'}
                        {entry.status === 'pending' && 'En attente'}
                        {entry.status === 'conflict' && 'Conflit'}
                        {entry.status === 'failed' && 'Échec'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Appareils connectés</CardTitle>
              <CardDescription>Liste des appareils utilisant cette instance</CardDescription>
            </div>
            <Combobox
              options={[
                { value: 'all', label: 'Tous les types' },
                { value: 'DESKTOP', label: 'Desktop' },
                { value: 'MOBILE', label: 'Mobile' },
                { value: 'TABLET', label: 'Tablette' },
                { value: 'WEB', label: 'Web' }
              ]}
              value={syncFilter}
              onValueChange={setSyncFilter}
              placeholder="Filtrer"
              className="w-[160px]"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Appareil</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière synchronisation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!devices?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Aucun appareil connecté
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.deviceName}</TableCell>
                    <TableCell className="text-muted-foreground">{device.deviceType}</TableCell>
                    <TableCell>
                      {device.isOnline ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircledIcon className="h-4 w-4" /> En ligne
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <CrossCircledIcon className="h-4 w-4" /> Hors ligne
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {device.lastSyncAt
                        ? format(new Date(device.lastSyncAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                        : 'Jamais'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résolution des conflits</CardTitle>
          <CardDescription>
            {conflicts?.length
              ? `${conflicts.length} conflit(s) nécessitent votre attention`
              : 'Aucun conflit détecté'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!conflicts?.length ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              <CheckCircledIcon className="mr-2 h-5 w-5 text-green-500" />
              Toutes les données sont synchronisées
            </div>
          ) : (
            conflicts.map((conflict) => (
              <Collapsible
                key={conflict.id}
                open={expandedConflict === conflict.id}
                onOpenChange={(open) => {
                  setExpandedConflict(open ? conflict.id : null)
                  if (!open) setMergeConflictId(null)
                }}
              >
                <Card className="border-destructive/50">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                          <div>
                            <CardTitle className="text-base">
                              {entityTypeLabels[conflict.entityType] || conflict.entityType}
                            </CardTitle>
                            <CardDescription className="font-mono text-xs">
                              ID: {conflict.entityId}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">
                            {conflict.conflictingFields.length} champ(s) en conflit
                          </Badge>
                          <CaretSortIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 border-t pt-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Version client
                            </Badge>
                          </div>
                          <pre className="text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                            {JSON.stringify(conflict.clientVersion, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Version serveur
                            </Badge>
                          </div>
                          <pre className="text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                            {JSON.stringify(conflict.serverVersion, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {conflict.conflictingFields.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-1">Champs en conflit :</p>
                          <div className="flex flex-wrap gap-1">
                            {conflict.conflictingFields.map((field) => (
                              <Badge key={field} variant="outline" className="text-xs border-destructive/50">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {mergeConflictId === conflict.id && (
                        <Form {...mergeForm}>
                          <form
                            onSubmit={mergeForm.handleSubmit((values) =>
                              mergeMutation.mutate({ conflictId: conflict.id, mergedValues: values.mergedValues })
                            )}
                            className="space-y-3"
                          >
                            <FormField
                              control={mergeForm.control}
                              name="mergedValues"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Valeurs fusionnées (JSON)</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      className="font-mono text-xs min-h-[150px]"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMergeConflictId(null)}
                              >
                                Annuler
                              </Button>
                              <Button type="submit" size="sm" disabled={mergeMutation.isPending}>
                                {mergeMutation.isPending ? 'Fusion...' : 'Appliquer la fusion'}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => keepServerMutation.mutate(conflict.id)}
                          disabled={keepServerMutation.isPending}
                        >
                          Garder version serveur
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => keepClientMutation.mutate(conflict.id)}
                          disabled={keepClientMutation.isPending}
                        >
                          Garder version client
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openMerge(conflict)}
                          disabled={mergeConflictId === conflict.id}
                        >
                          Fusionner
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
