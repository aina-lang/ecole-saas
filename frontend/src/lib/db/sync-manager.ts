import {
  SYNC_PULLED_EVENT,
  activeSyncCount,
  nudgeAllSyncs,
  pullAllNow,
  startAllSyncs,
  stopAllSyncs,
  syncEntityNow,
  getPendingOperations,
  type PendingEntity,
} from './sync-engine'

import {
  fetchCouchDBConfig,
  hasCouchDBConfig,
  getCouchDBInfo,
  destroyAllDatabases,
  getPendingCleanups,
  removePendingCleanup,
  setCurrentTenant,
  migrateLegacyFeeDatabase,
  type EntityType,
} from './pouchdb'
import { useSyncStore } from '@/stores/sync-store'

// Ré-exporter stopAllSyncs pour que auth-store puisse l'importer depuis sync-manager
// (point d'entrée unique, évite que auth-store importe directement de sync-engine)
export { stopAllSyncs }

export interface SyncResult {
  entityType: string
  ok: boolean
  synced: number
  errors: number
  conflicts: number
  error?: string
}

let onlineListener: (() => void) | null = null
let offlineListener: (() => void) | null = null
let isInitialized = false

// ─── Deferred Cleanup ────────────────────────────────────────────────────────
/**
 * Traite les cleanups différés (tenants qui se sont déconnectés en mode offline).
 *
 * Pour chaque tenant en attente :
 *  1. Tente une sync rapide pour ne pas perdre les données non envoyées
 *  2. Détruit ensuite les bases locales
 *
 * Appelé au démarrage de l'app ET à chaque reconnexion réseau.
 */
async function processPendingCleanups(): Promise<void> {
  if (!navigator.onLine) return

  const pending = getPendingCleanups()
  if (pending.length === 0) return

  console.log(`[Sync] ${pending.length} cleanup(s) différé(s) à traiter`)

  for (const { tenantId, loggedOutAt } of pending) {
    console.log(`[Sync] Traitement du cleanup pour tenant "${tenantId}" (logout : ${loggedOutAt})`)

    // (#8) Basculer le contexte PouchDB sur le tenant à nettoyer : syncEntityNow
    // et createDatabase() utilisent currentTenantId. Sans ça, on synchroniserait
    // les bases du tenant COURANT (celui connecté) au lieu de celles du tenant
    // déconnecté dont on veut sauver les données. On restaure ensuite.
    const previousTenant = localStorage.getItem('tenantId') || 'default'
    setCurrentTenant(tenantId)

    // Tenter une dernière sync pour sauvegarder les données non envoyées
    // On passe les entités les plus critiques en priorité
    const CRITICAL_TYPES: EntityType[] = [
      'Student', 'Grade', 'Attendance', 'Payment',
      'Teacher', 'Class', 'Subject', 'AuditLog',
    ]

    try {
      await Promise.allSettled(
        CRITICAL_TYPES.map(entityType =>
          syncEntityNow(entityType).catch(err =>
            console.warn(`[Sync] Cleanup sync failed for ${entityType}:`, err.message)
          )
        )
      )
      console.log(`[Sync] Sync pré-cleanup terminée pour tenant "${tenantId}"`)
    } catch (err: any) {
      console.warn(`[Sync] Sync pré-cleanup échouée pour tenant "${tenantId}":`, err.message)
      // On continue quand même — les données sont peut-être déjà dans CouchDB
    } finally {
      // Restaurer le contexte PouchDB sur le tenant actif (connecté)
      setCurrentTenant(previousTenant)
    }

    // Détruire les bases locales du tenant déconnecté
    await destroyAllDatabases(tenantId)
    removePendingCleanup(tenantId)
    console.log(`[Sync] Cleanup terminé pour tenant "${tenantId}"`)
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Rafraîchissement d'arrière-plan : toutes les 6 s, récupération des
// changements serveur (saisies mobiles, autres postes) en plus des flux live.
const BACKGROUND_PULL_MS = 6000
let backgroundTimer: ReturnType<typeof setInterval> | null = null

function startBackgroundPull(): void {
  if (backgroundTimer) return
  backgroundTimer = setInterval(() => {
    pullAllNow().catch(() => {})
  }, BACKGROUND_PULL_MS)
}

function stopBackgroundPull(): void {
  if (backgroundTimer) {
    clearInterval(backgroundTimer)
    backgroundTimer = null
  }
}

// Identifiants CouchDB : sans eux, aucun flux ne doit démarrer (avant, on
// répliquait en silence vers localhost:5984 — rien ne partait, rien
// n'arrivait, et l'écran disait « En ligne »). On réessaie toutes les 10 s
// et on démarre les flux dès que l'API répond.
let configRetryTimer: ReturnType<typeof setTimeout> | null = null

async function ensureCouchDBConfig(): Promise<boolean> {
  if (hasCouchDBConfig()) return true
  const ok = await fetchCouchDBConfig()
  const store = useSyncStore.getState()
  if (ok) {
    store.setError(null)
    if (configRetryTimer) { clearTimeout(configRetryTimer); configRetryTimer = null }
    return true
  }
  const info = getCouchDBInfo()
  store.setError(`Identifiants de synchronisation non reçus (${info.error ?? 'API injoignable'}) — nouvelle tentative dans 10 s`)
  if (!configRetryTimer) {
    configRetryTimer = setTimeout(async () => {
      configRetryTimer = null
      if (!isInitialized) return
      if (await ensureCouchDBConfig()) {
        await processPendingCleanups().catch(() => {})
        await startAllSyncs().catch(() => {})
      }
    }, 10000)
  }
  return false
}

// Chien de garde : toutes les 15 s, si l'app est en ligne avec ses
// identifiants mais qu'aucun flux n'est enregistré OU qu'aucun échange avec
// CouchDB n'a eu lieu depuis 60 s, le moteur est relancé. Couvre tout ce
// qu'on ne peut pas prévoir : flux morts sans évènement, module rechargé à
// chaud en développement, réveil de veille, reprise réseau non signalée…
const WATCHDOG_MS = 15000
const CONTACT_STALE_MS = 60000
let watchdogTimer: ReturnType<typeof setInterval> | null = null
let watchdogBusy = false

function startWatchdog(): void {
  if (watchdogTimer) return
  watchdogTimer = setInterval(async () => {
    if (watchdogBusy || !isInitialized || !navigator.onLine) return
    if (!hasCouchDBConfig()) { await ensureCouchDBConfig().catch(() => {}); return }
    const store = useSyncStore.getState()
    const stale = store.lastContactAt !== null && Date.now() - store.lastContactAt > CONTACT_STALE_MS
    const noFeeds = activeSyncCount() === 0
    if (!noFeeds && !stale) return
    watchdogBusy = true
    try {
      console.warn(`[Sync] Chien de garde : ${noFeeds ? 'aucun flux actif' : 'aucun échange depuis 60 s'} — relance du moteur`)
      stopAllSyncs()
      await startAllSyncs()
      await pullAllNow().catch(() => {})
    } finally {
      watchdogBusy = false
    }
  }, WATCHDOG_MS)
}

function stopWatchdog(): void {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
}

export async function initSyncEngine(): Promise<void> {
  startBackgroundPull()
  startWatchdog()
  if (isInitialized) return
  isInitialized = true

  const store = useSyncStore.getState()
  console.log('[Sync] Initializing PouchDB-CouchDB sync engine, online:', navigator.onLine)

  await ensureCouchDBConfig()
  await migrateLegacyFeeDatabase()

  onlineListener = async () => {
    store.setOnline(true)
    // Si l'app a démarré hors ligne, les identifiants CouchDB n'ont jamais
    // été récupérés (fetchCouchDBConfig avait échoué en silence) : sans ce
    // rappel, startAllSyncs() ciblerait localhost sans authentification et
    // toutes les réplications échoueraient silencieusement.
    if (!(await ensureCouchDBConfig())) return
    // Traiter d'abord les cleanups différés, puis démarrer la sync normale
    await processPendingCleanups()
    await startAllSyncs().catch((err) => console.error('[Sync] startAllSyncs après reconnexion:', err))
  }

  offlineListener = () => {
    store.setOnline(false)
  }

  window.addEventListener('online', onlineListener)
  window.addEventListener('offline', offlineListener)

  if (navigator.onLine && hasCouchDBConfig()) {
    console.log('[Sync] Online on init, starting live sync')
    // Traiter les cleanups différés avant de démarrer la sync
    await processPendingCleanups()
    await startAllSyncs()
  }

  console.log('[Sync] Sync engine initialized')
}

export async function performSync(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync')
    return [{ entityType: '_all', ok: false, synced: 0, errors: 0, conflicts: 0, error: 'Hors ligne' }]
  }

  // La config CouchDB n'est relue que si elle manque (démarrage hors ligne) :
  // l'appel serveur re-provisionnait 21 bases à chaque clic.
  if (!(await ensureCouchDBConfig())) {
    return [{ entityType: '_all', ok: false, synced: 0, errors: 1, conflicts: 0, error: 'Identifiants de synchronisation non reçus' }]
  }
  store.setSyncing(true)
  store.setError(null)

  try {
    console.log('[Sync] Nudge: flux live relancés si besoin, attente « à jour »…')
    // « Coup de coude » : pas de réplication ponctuelle sur les bases dont le
    // flux live tourne et est à jour — seulement relance des flux manquants,
    // attente bornée, et échange ponctuel pour les bases en erreur.
    const results = await nudgeAllSyncs(10000)
    // Après une synchro manuelle, TOUT l'affichage se rafraîchit (même si
    // rien n'a été reçu) : c'est ce que l'utilisateur attend du bouton.
    try { window.dispatchEvent(new CustomEvent(SYNC_PULLED_EVENT, { detail: { entityType: '_all', count: 0, manual: true } })) } catch { /* hors navigateur */ }
    return results.map((r) => ({
      entityType: r.entityType,
      ok: r.ok,
      synced: r.synced,
      errors: r.errors,
      conflicts: r.conflicts,
      error: r.error,
    }))
  } catch (err: any) {
    console.error('[Sync] Error during sync:', err)
    store.setError(err.message)
    await startAllSyncs().catch(() => {})
    return [
      {
        entityType: '_all',
        ok: false,
        synced: 0,
        errors: 1,
        conflicts: 0,
        error: err.message,
      },
    ]
  } finally {
    store.setSyncing(false)
  }
}

export async function getSyncStatus(): Promise<{
  isOnline: boolean
  pendingCount: number
  pendingDetails: PendingEntity[]
  lastSyncAt: string | null
  isSyncing: boolean
  conflictCount: number
  serverStatus: any
}> {
  const store = useSyncStore.getState()
  const pending = await getPendingOperations()

  return {
    isOnline: navigator.onLine,
    // Nombre réel de changements locaux non poussés (et non le nombre de
    // types d'entités concernés, qui affichait « 2 » sans rien expliquer).
    pendingCount: pending.reduce((sum, p) => sum + p.count, 0),
    pendingDetails: pending,
    lastSyncAt: store.lastSyncAt,
    // « En cours » seulement si un flux est réellement actif — le drapeau
    // global restait parfois collé à true après une pause manquée.
    isSyncing: store.isSyncing && Object.values(store.entityStatus ?? {}).some((st: any) => st?.syncing),
    conflictCount: store.conflictCount,
    serverStatus: null,
  }
}

export function destroySyncEngine(): void {
  stopWatchdog()
  if (configRetryTimer) { clearTimeout(configRetryTimer); configRetryTimer = null }
  stopBackgroundPull()
  stopAllSyncs()

  if (onlineListener) {
    window.removeEventListener('online', onlineListener)
    onlineListener = null
  }
  if (offlineListener) {
    window.removeEventListener('offline', offlineListener)
    offlineListener = null
  }

  isInitialized = false
}

// Rechargement à chaud (Vite, développement) : quand ce module ou le moteur
// est remplacé, l'ancien état (flux, minuteries) est détruit et le nouveau
// module se réinitialise tout seul — sans ça, chaque modification de code
// laissait l'app sans synchronisation jusqu'au redémarrage complet.
const hot = (import.meta as any).hot
if (hot) {
  hot.dispose((data: any) => {
    data.reinit = isInitialized
    destroySyncEngine()
  })
  hot.accept()
  if (hot.data?.reinit) {
    initSyncEngine().catch((err: unknown) => console.error('[Sync] réinit après rechargement à chaud :', err))
  }
}
