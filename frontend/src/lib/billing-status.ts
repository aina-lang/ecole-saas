import { getTenantId } from './db/token-cache'

// Aucun serveur ne peut bloquer une action réellement hors ligne au moment où
// elle se produit. Trois niveaux de protection :
//
// 1. On met en cache le DERNIER statut connu à chaque vérification en ligne
//    (voir SubscriptionBanner.tsx) et on le relit avant toute écriture locale.
// 2. Comme l'abonnement est annuel, rester hors ligne indéfiniment ne doit pas
//    suffire à contourner l'expiration : on met aussi en cache la date de fin
//    (fin d'essai ou fin de période payée) et on la compare à l'heure courante
//    à chaque écriture — pas seulement au dernier statut connu.
// 3. L'heure courante utilisée n'est PAS Date.now() brut : c'est un cliquet
//    (ratchet) qui ne peut qu'avancer. Reculer l'horloge système après usage
//    ne redonne donc pas de temps — l'app se souvient du dernier instant
//    légitimement observé (à chaque écriture ET à chaque contact serveur) et
//    n'accepte jamais de "maintenant" antérieur à ça.
//    Limite assumée : quelqu'un qui recule son horloge AVANT toute première
//    utilisation, et ne la laisse plus jamais avancer, contourne quand même ce
//    contrôle précis — mais reste alors bloqué de toute synchronisation avec
//    le serveur (qui, lui, a sa propre horloge) tant qu'il ne se reconnecte
//    pas avec une horloge plausible. Vider le cache local (localStorage)
//    réinitialise aussi le cliquet — mais le garde-fou serveur referme la
//    boucle dans les deux cas dès la reconnexion.

export type CachedBillingStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'

interface CachedBilling {
  status: CachedBillingStatus
  /** Fin d'essai (si TRIAL) ou fin de période payée (si ACTIVE) — ISO ou null. */
  expiresAt: string | null
}

function cacheKey(): string {
  const tenantId = getTenantId() || localStorage.getItem('tenantId') || 'default'
  return `billing_status_cache_${tenantId}`
}

function ratchetKey(): string {
  const tenantId = getTenantId() || localStorage.getItem('tenantId') || 'default'
  return `billing_time_ratchet_${tenantId}`
}

/** Fait avancer le cliquet temporel jusqu'à `Date.now()` si besoin — jamais en arrière. */
export function bumpTimeRatchet(): void {
  const key = ratchetKey()
  const stored = parseInt(localStorage.getItem(key) || '0', 10)
  const now = Date.now()
  if (now > stored) {
    localStorage.setItem(key, String(now))
  }
}

/** "Maintenant" tel que connu par l'app : jamais antérieur au dernier instant
 * observé, même si l'horloge système a été reculée depuis. */
function effectiveNow(): number {
  const stored = parseInt(localStorage.getItem(ratchetKey()) || '0', 10);
  return Math.max(Date.now(), stored);
}

export function cacheBillingStatus(status: CachedBillingStatus, expiresAt: string | null): void {
  const payload: CachedBilling = { status, expiresAt }
  localStorage.setItem(cacheKey(), JSON.stringify(payload))
  bumpTimeRatchet()
}

export function getCachedBilling(): CachedBilling | null {
  try {
    const raw = localStorage.getItem(cacheKey())
    return raw ? (JSON.parse(raw) as CachedBilling) : null
  } catch {
    return null
  }
}

/** Pas de cache = jamais vérifié en ligne (install neuve) → on n'invente pas
 * un blocage : le serveur tranchera dès le premier appel en ligne. */
export function isReadOnly(): boolean {
  bumpTimeRatchet()

  const cached = getCachedBilling()
  if (!cached) return false

  if (cached.status === 'PAST_DUE' || cached.status === 'SUSPENDED' || cached.status === 'CANCELLED') {
    return true
  }
  if (cached.expiresAt && new Date(cached.expiresAt).getTime() < effectiveNow()) {
    return true
  }
  return false
}
