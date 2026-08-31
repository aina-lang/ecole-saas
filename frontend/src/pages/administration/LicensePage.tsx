import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client, { extractErrorMessage } from '@/api/client'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page'
import { getCachedBilling } from '@/lib/billing-status'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SupportContact } from '@/components/support-contact'
import { LifeBuoy } from 'lucide-react'
import { ReloadIcon } from '@radix-ui/react-icons'
import { KeyRound, ShieldCheck, WifiOff } from 'lucide-react'

type Status = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED'

interface LicenseStatus {
  tenantId: string
  status: Status
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  limits: { maxStudents: number; maxTeachers: number; maxStorageMb: number; unlimited: boolean }
  usage: { students: number; teachers: number }
  license: { code: string; email: string; issuedAt: string; expiresAt: string; activatedAt: string | null } | null
}

const STATUS_BADGE: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: 'Licence active', variant: 'default' },
  TRIAL: { label: 'Essai en cours', variant: 'secondary' },
  PAST_DUE: { label: 'Lecture seule — licence requise', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendu', variant: 'destructive' },
  CANCELLED: { label: 'Résilié', variant: 'destructive' },
}

const CODE_LENGTH = 16
/** Majuscules, alphabet sans 0/O/1/I, groupes de 4 séparés par des tirets. */
function formatCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/[OI01]/g, '').slice(0, CODE_LENGTH)
  return clean.match(/.{1,4}/g)?.join('-') ?? ''
}

export function LicensePage() {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const { data: status, isLoading, isError, refetch } = useQuery<LicenseStatus>({
    queryKey: ['license-status'],
    queryFn: async () => {
      const { data } = await client.get<LicenseStatus>('/license/status')
      return data
    },
    retry: false,
  })

  // Hors ligne : on affiche ce que l'app sait localement.
  const cached = getCachedBilling()

  const activateMutation = useMutation({
    mutationFn: async (raw: string) => {
      const { data } = await client.post<LicenseStatus>('/license/activate', { code: raw.replace(/-/g, '') })
      return data
    },
    onSuccess: () => {
      setCode('')
      queryClient.invalidateQueries({ queryKey: ['license-status'] })
      toast.success('Licence activée — valable un an')
    },
    onError: (err: any) => toast.error(extractErrorMessage(err) || "Impossible d'activer ce code"),
  })

  const effectiveStatus: Status | undefined = status?.status ?? cached?.status
  const expiresAt = status
    ? (status.status === 'TRIAL' ? status.trialEndsAt : status.currentPeriodEnd)
    : cached?.expiresAt ?? null
  const badge = effectiveStatus ? STATUS_BADGE[effectiveStatus] : null
  const codeComplete = code.replace(/-/g, '').length === CODE_LENGTH

  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000) : null
  const tone =
    effectiveStatus === 'ACTIVE' || effectiveStatus === 'TRIAL'
      ? daysLeft != null && daysLeft <= 30
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Licence"
        description="Activation et suivi de la licence annuelle de votre établissement."
        actions={
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} aria-label="Rafraîchir">
            <ReloadIcon className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Statut */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Statut
              </CardTitle>
              {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {isError && !cached && <p className="text-sm text-muted-foreground">Serveur injoignable — statut inconnu pour le moment.</p>}
              {isError && cached && (
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><WifiOff className="h-3.5 w-3.5" /> Hors ligne — dernier statut connu.</p>
              )}
              {(effectiveStatus === 'ACTIVE' || effectiveStatus === 'TRIAL') && expiresAt && (
                <>
                  <p className={cn('text-3xl font-semibold tabular-nums', tone)}>
                    {daysLeft != null && daysLeft >= 0 ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : 'Expiré'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {effectiveStatus === 'TRIAL' ? 'Essai gratuit' : 'Licence annuelle'} jusqu'au {formatDate(expiresAt)}
                    {effectiveStatus === 'ACTIVE' && ' · élèves et enseignants illimités'}
                  </p>
                </>
              )}
              {effectiveStatus === 'PAST_DUE' && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Votre essai ou votre licence a expiré : l'application est en lecture seule jusqu'à l'activation d'un code valide.
                </p>
              )}
              {(effectiveStatus === 'SUSPENDED' || effectiveStatus === 'CANCELLED') && (
                <p className="text-sm text-red-600 dark:text-red-400">Compte {badge?.label.toLowerCase()} — contactez-nous pour le réactiver.</p>
              )}
            </div>

            {status && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Élèves</p>
                  <p className="font-medium tabular-nums">
                    {status.usage.students}
                    <span className="font-normal text-muted-foreground">{status.limits.unlimited ? ' · illimité' : ` / ${status.limits.maxStudents}`}</span>
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Enseignants</p>
                  <p className="font-medium tabular-nums">
                    {status.usage.teachers}
                    <span className="font-normal text-muted-foreground">{status.limits.unlimited ? ' · illimité' : ` / ${status.limits.maxTeachers}`}</span>
                  </p>
                </div>
              </div>
            )}

            {status?.license && (
              <dl className="space-y-1 rounded-lg border p-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Code</dt><dd className="font-mono">{status.license.code}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Émis pour</dt><dd className="truncate">{status.license.email}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Émis le</dt><dd>{formatDate(status.license.issuedAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expire le</dt><dd>{formatDate(status.license.expiresAt)}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Activation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" /> Activer un code de licence
            </CardTitle>
            <CardDescription>
              Code de 16 caractères remis par votre fournisseur pour l'e-mail de l'administrateur — un an, sans
              limite. L'activation nécessite Internet ; l'application fonctionne ensuite hors ligne.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="license-code">Code de licence</Label>
              <div className="flex gap-2">
                <Input
                  id="license-code"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(formatCodeInput(e.target.value))}
                  className="h-11 font-mono text-base uppercase tracking-[0.2em]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  className="h-11 shrink-0"
                  onClick={() => activateMutation.mutate(code)}
                  disabled={!codeComplete || !online || activateMutation.isPending}
                >
                  {activateMutation.isPending ? 'Activation…' : 'Activer'}
                </Button>
              </div>
              {!online && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <WifiOff className="h-3.5 w-3.5" /> Vous êtes hors ligne : reconnectez-vous pour activer le code.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <LifeBuoy className="h-4 w-4 text-primary" /> Abonnement et assistance
              </p>
              <p className="text-xs text-muted-foreground">
                Souscription, renouvellement, code de licence ou toute autre question :
              </p>
              <SupportContact stacked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
