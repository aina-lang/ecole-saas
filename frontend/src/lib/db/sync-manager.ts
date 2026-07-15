import {
  startAllSyncs,
  stopAllSyncs,
  syncAllNow,
  syncEntityNow,
  getPendingOperations,
} from './sync-engine'

import {
  fetchCouchDBConfig,
  destroyAllDatabases,
  getPendingCleanups,
  removePendingCleanup,
  setCurrentTenant,
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
      'Teacher', 'Class', 'Subject',
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

export async function initSyncEngine(): Promise<void> {
  if (isInitialized) return
  isInitialized = true

  const store = useSyncStore.getState()
  console.log('[Sync] Initializing PouchDB-CouchDB sync engine, online:', navigator.onLine)

  await fetchCouchDBConfig()

  onlineListener = async () => {
    store.setOnline(true)
    // Traiter d'abord les cleanups différés, puis démarrer la sync normale
    await processPendingCleanups()
    startAllSyncs()
  }

  offlineListener = () => {
    store.setOnline(false)
  }

  window.addEventListener('online', onlineListener)
  window.addEventListener('offline', offlineListener)

  if (navigator.onLine) {
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

  await fetchCouchDBConfig()
  store.setSyncing(true)
  store.setError(null)

  try {
    console.log('[Sync] Performing one-shot sync...')
    const results = await syncAllNow()
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
  lastSyncAt: string | null
  isSyncing: boolean
  conflictCount: number
  serverStatus: any
}> {
  const store = useSyncStore.getState()
  const pending = await getPendingOperations()

  return {
    isOnline: navigator.onLine,
    pendingCount: pending.length,
    lastSyncAt: store.lastSyncAt,
    isSyncing: store.isSyncing,
    conflictCount: store.conflictCount,
    serverStatus: null,
  }
}

export function destroySyncEngine(): void {
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
