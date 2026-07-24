import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '@/api/client'
import { cacheBillingStatus, isReadOnly, type CachedBillingStatus } from '@/lib/billing-status'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'

interface BillingStatusResponse {
  status: CachedBillingStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

// Partage la clé de requête ['billing-status'] avec BillingPage.tsx : pas de
// requête dupliquée quand l'utilisateur navigue ensuite vers Abonnement.
//
// Tant que ce composant est monté (il l'est en permanence dans AppLayout) et
// que l'app est en ligne, il tient à jour le cache local (statut + date
// d'expiration) lu par pouchdb-compat.ts pour bloquer les écritures même hors
// ligne, y compris au-delà de la date d'expiration sans jamais se reconnecter
// — voir lib/billing-status.ts pour le détail.
export function SubscriptionBanner() {
  const { data: status } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const { data } = await client.get<BillingStatusResponse>('/billing/status')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!status) return
    const expiresAt = status.status === 'ACTIVE'
      ? status.currentPeriodEnd
      : status.status === 'TRIAL'
        ? status.trialEndsAt
        : null
    cacheBillingStatus(status.status, expiresAt)
  }, [status])

  // Réévalué périodiquement (pas seulement à chaque réponse serveur) : si
  // l'app reste ouverte hors ligne et franchit la date d'expiration mise en
  // cache, le bandeau doit apparaître sans attendre un redémarrage.
  const [readOnly, setReadOnly] = useState(() => isReadOnly())
  useEffect(() => {
    setReadOnly(isReadOnly())
    const interval = setInterval(() => setReadOnly(isReadOnly()), 60_000)
    return () => clearInterval(interval)
  }, [status])

  if (!readOnly) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
      <span>
        Essai ou paiement expiré — application en lecture seule.
      </span>
      <Link to="/administration/billing" className="font-medium underline underline-offset-2">
        Régulariser mon abonnement
      </Link>
    </div>
  )
}
