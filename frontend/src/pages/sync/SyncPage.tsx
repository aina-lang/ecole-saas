import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RefreshCw, Wifi, WifiOff, CloudUpload, AlertTriangle, CheckCircle2, Clock, Database, Info } from 'lucide-react'
import { getSyncStatus, performSync } from '@/lib/db/sync-manager'
import { getCouchDBInfo } from '@/lib/db/pouchdb'
import { hideServerAddress } from '@/lib/redact'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/page'
import { cn } from '@/lib/utils'

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  pendingCount: number
  pendingDetails: Array<{ entityType: string; count: number; error?: string | null; inactive?: boolean }>
  conflictCount: number
}

const ENTITY_LABELS: Record<string, string> = {
  Student: 'Élèves', User: 'Utilisateurs', Teacher: 'Enseignants', Class: 'Classes', Level: 'Niveaux',
  Subject: 'Matières', Grade: 'Notes', Attendance: 'Présences', Payment: 'Paiements', FeeStructure: 'Frais',
  TimetableSlot: 'Emploi du temps', Message: 'Messages', AcademicYear: 'Années scolaires', Period: 'Périodes',
  StudentEnrollment: 'Inscriptions', Promotion: 'Promotions', TenantSetting: 'Paramètres', GradeConfig: 'Barèmes',
  StudentDocument: 'Documents', Holiday: 'Vacances', TeacherAttendance: 'Présences enseignants',
  TeacherContract: 'Contrats', TeacherPayment: 'Paie', Parent: 'Parents',
}
const entityLabel = (t: string) => ENTITY_LABELS[t] ?? t

export function SyncPage() {
  const queryClient = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => (await getSyncStatus()) as SyncStatus,
    refetchInterval: 5000,
  })

  const forceSyncMutation = useMutation({
    mutationFn: async () => { await performSync() },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      toast.success('Synchronisation terminée')
    },
    onError: () => toast.error('Erreur lors de la synchronisation'),
  })

  const online = !!status?.isOnline
  const syncing = forceSyncMutation.isPending || !!status?.isSyncing
  const pending = status?.pendingCount ?? 0
  const conflicts = status?.conflictCount ?? 0
  const errors = (status?.pendingDetails ?? []).filter((p) => p.error)
  const details = [...(status?.pendingDetails ?? [])].sort((a, b) => Number(!!b.error) - Number(!!a.error) || b.count - a.count || entityLabel(a.entityType).localeCompare(entityLabel(b.entityType)))

  // État global : rouge si erreurs/conflits, ambre si en attente ou hors ligne, vert sinon.
  const state = errors.length || conflicts
    ? { tone: 'red', title: errors.length ? 'Des erreurs bloquent la synchronisation' : 'Conflits à résoudre', hint: errors.length ? `${errors.length} type${errors.length > 1 ? 's' : ''} de données en erreur — voir ci-dessous.` : `${conflicts} conflit${conflicts > 1 ? 's' : ''} entre le poste et le serveur.` }
    : !online
      ? { tone: 'amber', title: 'Hors ligne', hint: pending ? `${pending} modification${pending > 1 ? 's' : ''} seront envoyées au retour du réseau.` : 'Vous pouvez continuer à travailler ; tout sera envoyé au retour du réseau.' }
      : pending
        ? { tone: 'amber', title: 'Envoi en cours', hint: `${pending} modification${pending > 1 ? 's' : ''} en attente d'envoi vers le serveur.` }
        : { tone: 'emerald', title: 'Tout est synchronisé', hint: 'Ce poste et le serveur ont les mêmes données.' }

  const toneClasses: Record<string, { ring: string; icon: string; bg: string }> = {
    emerald: { ring: 'border-emerald-200 dark:border-emerald-900/60', icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', bg: '' },
    amber: { ring: 'border-amber-200 dark:border-amber-900/60', icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', bg: '' },
    red: { ring: 'border-red-200 dark:border-red-900/60', icon: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', bg: '' },
  }
  const tone = toneClasses[state.tone]
  const StateIcon = state.tone === 'emerald' ? CheckCircle2 : state.tone === 'amber' ? (online ? CloudUpload : WifiOff) : AlertTriangle

  return (
    <div className="space-y-5">
      <PageHeader
        title="Synchronisation"
        description="Échange des données entre ce poste et le serveur de l'établissement."
        actions={
          <Button onClick={() => (online ? forceSyncMutation.mutate() : toast.error('Impossible de synchroniser hors ligne'))} disabled={syncing || !online}>
            <RefreshCw className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </Button>
        }
      />

      {/* Bandeau d'état */}
      <Card className={cn('border-2', tone.ring)}>
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', tone.icon)}>
            <StateIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{state.title}</p>
            <p className="text-sm text-muted-foreground">{state.hint}</p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Réseau</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium">
                {online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
                {online ? 'En ligne' : 'Hors ligne'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dernière synchro</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium" title={status?.lastSyncAt ? format(new Date(status.lastSyncAt), 'dd/MM/yyyy HH:mm:ss', { locale: fr }) : undefined}>
                <Clock className="h-4 w-4 text-muted-foreground" />
                {status?.lastSyncAt ? formatDistanceToNow(new Date(status.lastSyncAt), { locale: fr, addSuffix: true }) : 'Jamais'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En attente</p>
              <p className={cn('mt-0.5 font-semibold tabular-nums', pending ? 'text-amber-600 dark:text-amber-400' : '')}>{pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Détail par type de données */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-muted-foreground" /> État par type de données
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {details.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Aucune information de réplication pour le moment.</p>
            ) : (
              <ul className="divide-y">
                {details.map((p) => {
                  const st = p.error ? 'error' : p.inactive ? 'inactive' : p.count > 0 ? 'pending' : 'ok'
                  return (
                    <li key={p.entityType} className="flex items-start gap-3 px-5 py-2.5">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', st === 'ok' && 'bg-emerald-500', st === 'pending' && 'bg-amber-500', st === 'inactive' && 'bg-slate-400', st === 'error' && 'bg-red-500')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{entityLabel(p.entityType)}</span>
                          <Badge variant="outline" className={cn('border-transparent text-xs',
                            st === 'ok' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                            st === 'pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                            st === 'inactive' && 'bg-muted text-muted-foreground',
                            st === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300')}>
                            {st === 'ok' ? 'À jour' : st === 'pending' ? `${p.count} en attente` : st === 'inactive' ? 'Réplication inactive' : 'Erreur'}
                          </Badge>
                        </div>
                        {p.error && <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-400" title={hideServerAddress(p.error)}>{hideServerAddress(p.error)}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className={cn(conflicts > 0 && 'border-red-200 dark:border-red-900/60')}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', conflicts ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-muted text-muted-foreground')}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conflits</p>
                <p className={cn('text-2xl font-semibold tabular-nums', conflicts && 'text-red-600 dark:text-red-400')}>{conflicts}</p>
                <p className="text-xs text-muted-foreground">{conflicts ? 'La version la plus récente est conservée automatiquement.' : 'Aucun conflit détecté.'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-muted-foreground" /> Comment ça marche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {(() => { const i = getCouchDBInfo(); return (
                // Ni l'adresse du serveur ni l'identifiant CouchDB : l'infrastructure
                // n'a pas à apparaître dans l'application.
                <p className={cn('rounded-md border px-2.5 py-1.5 text-xs', i.user ? 'bg-muted/40' : 'border-red-200 bg-red-50 text-red-700')}>
                  {i.user
                    ? 'Connecté au service de synchronisation.'
                    : `Service de synchronisation injoignable${i.error ? ` (${hideServerAddress(i.error)})` : ''} — aucune réplication possible.`}
                </p>
              ) })()}
              <p>Toutes vos saisies sont enregistrées <strong className="text-foreground">sur ce poste</strong> d'abord — l'application fonctionne sans Internet.</p>
              <p>Dès que le réseau est disponible, les modifications sont envoyées au serveur et celles des autres postes sont récupérées, <strong className="text-foreground">en continu</strong>.</p>
              <p>« Synchroniser maintenant » force un échange immédiat ; ce n'est pas nécessaire en usage normal.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
