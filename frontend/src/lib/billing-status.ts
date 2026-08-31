import { getTenantId } from './db/token-cache'
import { bumpRatchet, getDurable, setDurable, trustedNow } from './trusted-clock'

// Aucun serveur ne peut bloquer une action réellement hors ligne au moment où
// elle se produit. Le contrôle est donc local, et repose sur :
//
// 1. Le DERNIER statut connu, mis en cache à chaque vérification en ligne
//    (SubscriptionBanner.tsx) et relu avant toute écriture locale.
// 2. La DATE DE FIN mise en cache elle aussi (fin d'essai ou de licence),
//    comparée au « maintenant » de confiance à chaque écriture — rester hors
//    ligne indéfiniment ne contourne donc pas l'expiration annuelle.
// 3. Un « maintenant » de confiance (lib/trusted-clock.ts) : heure corrigée
//    du décalage serveur + cliquet monotone. Reculer ou figer l'horloge, avant
//    ou après la première utilisation, ne rend pas de temps.
// 4. Un stockage DURABLE : le cache et le cliquet vivent dans localStorage et
//    dans deux fichiers hors du profil (processus principal). Vider le cache
//    du navigateur ne remet pas les compteurs à zéro.

export type CachedBillingStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'

interface CachedBilling {
  status: CachedBillingStatus
  /** Fin d'essai (si TRIAL) ou fin de période payée (si ACTIVE) — ISO ou null. */
  expiresAt: string | null
}

function cacheKey(): string {
  const tenantId = getTenantId() || localStorage.getItem('tenantId') || 'default'
  return `billing_${tenantId}`
}

/** Conservé pour compatibilité : fait avancer le cliquet de confiance. */
export function bumpTimeRatchet(): void {
  bumpRatchet()
}

export function cacheBillingStatus(status: CachedBillingStatus, expiresAt: string | null): void {
  const payload: CachedBilling = { status, expiresAt }
  setDurable(cacheKey(), payload)
  bumpRatchet()
}

export function getCachedBilling(): CachedBilling | null {
  const v = getDurable<CachedBilling>(cacheKey())
  if (v && typeof v === 'object' && 'status' in v) return v
  // Migration : ancien cache localStorage des versions précédentes.
  try {
    const tenantId = getTenantId() || localStorage.getItem('tenantId') || 'default'
    const raw = localStorage.getItem(`billing_status_cache_${tenantId}`)
    if (raw) {
      const legacy = JSON.parse(raw) as CachedBilling
      setDurable(cacheKey(), legacy)
      localStorage.removeItem(`billing_status_cache_${tenantId}`)
      return legacy
    }
  } catch { /* ignoré */ }
  return null
}

/** Pas de cache = jamais vérifié en ligne (install neuve) → on n'invente pas
 * un blocage : le serveur tranchera dès le premier appel en ligne. */
export function isReadOnly(): boolean {
  bumpRatchet()

  const cached = getCachedBilling()
  if (!cached) return false

  if (cached.status === 'PAST_DUE' || cached.status === 'SUSPENDED' || cached.status === 'CANCELLED') {
    return true
  }
  if (cached.expiresAt && new Date(cached.expiresAt).getTime() < trustedNow()) {
    return true
  }
  return false
}
