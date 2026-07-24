import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import client, { extractErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ReloadIcon } from '@radix-ui/react-icons'

type Status = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED'

interface BillingStatus {
  status: Status
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  limits: { maxStudents: number; maxTeachers: number; maxStorageMb: number }
  hasStripeCustomer: boolean
  usage: { students: number; teachers: number }
}

const STATUS_BADGE: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: 'Licence active', variant: 'default' },
  TRIAL: { label: 'Essai en cours', variant: 'secondary' },
  PAST_DUE: { label: 'Lecture seule — paiement requis', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendu', variant: 'destructive' },
  CANCELLED: { label: 'Annulé', variant: 'destructive' },
}

// Abonnement = une licence unique (pas de paliers) : soit vous l'avez, soit non.
export function BillingPage() {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const { data } = await client.get<BillingStatus>('/billing/status')
      return data
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post<{ url: string }>('/billing/checkout')
      return data.url
    },
    onSuccess: (url) => {
      window.open(url, '_blank')
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Impossible de démarrer le paiement")),
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post<{ url: string }>('/billing/portal')
      return data.url
    },
    onSuccess: (url) => {
      window.open(url, '_blank')
    },
    onError: (err) => toast.error(extractErrorMessage(err, "Impossible d'ouvrir le portail de facturation")),
  })

  if (isLoading || !status) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Abonnement</h2>
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const badge = STATUS_BADGE[status.status]
  const isLicensed = status.status === 'ACTIVE'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Abonnement</h2>
          <p className="text-muted-foreground">Licence de l'établissement et usage</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <ReloadIcon className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Licence</CardTitle>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <CardDescription>
            {status.status === 'TRIAL' && status.trialEndsAt && (
              <>Essai gratuit jusqu'au {new Date(status.trialEndsAt).toLocaleDateString('fr-FR')}</>
            )}
            {status.status === 'ACTIVE' && status.currentPeriodEnd && (
              <>Renouvellement le {new Date(status.currentPeriodEnd).toLocaleDateString('fr-FR')}</>
            )}
            {status.status === 'PAST_DUE' && (
              <>Votre essai ou votre paiement a expiré. L'application est en lecture seule (consultation possible, plus de création/modification) jusqu'à régularisation.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Élèves</p>
              <p className="font-medium">{status.usage.students} / {status.limits.maxStudents}</p>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <p className="text-muted-foreground">Enseignants</p>
              <p className="font-medium">{status.usage.teachers} / {status.limits.maxTeachers}</p>
            </div>
          </div>

          <Separator />

          {isLicensed ? (
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? 'Ouverture...' : 'Gérer mon abonnement (Stripe)'}
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? 'Ouverture...' : 'Activer la licence'}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Le paiement s'effectue via Stripe, dans votre navigateur. Vous revenez ensuite ici automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
