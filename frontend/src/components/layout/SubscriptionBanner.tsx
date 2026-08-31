import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '@/api/client'
import { cacheBillingStatus, isReadOnly, type CachedBillingStatus } from '@/lib/billing-status'
import { clockSkewMs } from '@/lib/trusted-clock'
import { SUPPORT } from '@/lib/support'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'

interface LicenseStatusResponse {
  status: CachedBillingStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

// Partage la clé de requête ['license-status'] avec LicensePage.tsx.
//
// Tant que ce composant est monté (en permanence dans AppLayout) et que l'app
// est en ligne, il tient à jour le cache local (statut + date d'expiration)
// lu par pouchdb-compat.ts pour bloquer les écritures même hors ligne — voir
// lib/billing-status.ts.
export function SubscriptionBanner() {
  const { data: status } = useQuery({
    queryKey: ['license-status'],
    queryFn: async () => {
      const { data } = await client.get<LicenseStatusResponse>('/license/status')
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

  const [readOnly, setReadOnly] = useState(() => isReadOnly())
  useEffect(() => {
    setReadOnly(isReadOnly())
    const interval = setInterval(() => setReadOnly(isReadOnly()), 60_000)
    return () => clearInterval(interval)
  }, [status])

  // Horloge du PC très décalée par rapport au serveur : l'app corrige d'elle-
  // même ses tampons, mais on prévient l'utilisateur (dates affichées,
  // impressions, appels…) au-delà de 10 minutes d'écart.
  const [skew, setSkew] = useState<number | null>(() => clockSkewMs())
  useEffect(() => {
    setSkew(clockSkewMs())
    const interval = setInterval(() => setSkew(clockSkewMs()), 60_000)
    return () => clearInterval(interval)
  }, [status])
  const skewMinutes = skew == null ? 0 : Math.round(Math.abs(skew) / 60_000)
  const showSkew = skewMinutes >= 10

  if (!readOnly && !showSkew) return null

  return (
    <>
      {readOnly && (
        <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          <span>
            Essai ou licence expiré — application en lecture seule. Abonnement : {SUPPORT.phoneDisplay} (tél. / WhatsApp) ou {SUPPORT.email}.
          </span>
          <Link to="/administration/license" className="font-medium underline underline-offset-2">
            Saisir un code de licence
          </Link>
        </div>
      )}
      {showSkew && (
        <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          <span>
            L'horloge de cet ordinateur est {skew! > 0 ? 'en retard' : 'en avance'} de {formatSkew(skewMinutes)} par rapport au serveur — corrigez la date et l'heure du système.
          </span>
        </div>
      )}
    </>
  )
}

function formatSkew(minutes: number): string {
  if (minutes < 120) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} jours`
}
