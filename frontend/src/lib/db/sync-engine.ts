import PouchDB from 'pouchdb'
import { useSyncStore } from '@/stores/sync-store'
import { createDatabase, createRemoteDatabase, createSync, hasCouchDBConfig, ALL_ENTITY_TYPES, type EntityType } from './pouchdb'

const SYNC_META_PREFIX = 'ecole_saas_sync_seq_'

function getTenantId(): string {
  return localStorage.getItem('tenantId')?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'
}

function getSyncKey(entityType: EntityType): string {
  return `${getTenantId()}:${entityType}`
}

export interface SyncResult {
  entityType: EntityType
  ok: boolean
  synced: number
  errors: number
  conflicts: number
  error?: string
}

// Toutes les entités locales se répliquent : la liste dérive de la source
// unique ALL_ENTITY_TYPES (pouchdb.ts). Côté serveur, l'équivalent est
// SYNC_ENTITY_TYPES (modules/couchdb/couchdb.constants.ts), dont dérivent le
// worker et SYNCABLE_MODELS — l'alignement frontend↔serveur reste la seule
// frontière manuelle, faute de package partagé.
const SYNC_ENTITY_TYPES: readonly EntityType[] = ALL_ENTITY_TYPES

const activeSyncs = new Map<string, PouchDB.Replication.Sync>()
/** Bases ayant reçu des documents depuis la dernière résolution de conflits. */
const dirtySince = new Set<EntityType>()
const remainingConflicts = new Map<string, number>()
// Timers de relance après erreur, par clé de sync — annulés par
// stopEntitySync/stopAllSyncs pour qu'une réplication ne ressuscite pas
// derrière l'écran de verrouillage ou après un cleanup de tenant.
const restartTimers = new Map<string, ReturnType<typeof setTimeout>>()

function pushConflictCount(): void {
  let total = 0
  for (const n of remainingConflicts.values()) total += n
  useSyncStore.getState().setConflicts(total)
}

/**
 * Résout les conflits de réplication PouchDB (révisions concurrentes créées
 * par deux appareils modifiant le même document hors ligne) de façon
 * déterministe : la révision dont `updatedAt`/`deletedAt` est la plus récente
 * gagne, plutôt que le choix arbitraire (hash de révision) par défaut de
 * PouchDB. Les révisions perdantes sont purgées de l'arbre.
 *
 * Limite connue : ceci reste un "dernier écrit gagne" au niveau du document
 * entier (pas de fusion champ par champ). Deux modifications concurrentes sur
 * des champs différents du même document ne sont pas fusionnées — la version
 * la plus récente écrase entièrement l'autre. Une vraie fusion nécessiterait
 * un mécanisme CRDT/3-way merge, hors de portée ici.
 */
async function resolveEntityConflicts(entityType: EntityType): Promise<number> {
  const db = createDatabase(entityType)
  let unresolved = 0
  try {
    const { rows } = await db.allDocs({ include_docs: true, conflicts: true })
    for (const row of rows as any[]) {
      const doc = row.doc
      if (!doc?._conflicts?.length) continue

      const losingRevs: string[] = doc._conflicts
      const candidates = await Promise.all(
        losingRevs.map((rev) => db.get(doc._id, { rev }).catch(() => null)),
      )
      const versions = [doc, ...candidates.filter(Boolean)] as any[]
      const timeOf = (v: any) => new Date(v.updatedAt || v.deletedAt || v.createdAt || 0).getTime()

      if (versions.every((v) => !Number.isFinite(timeOf(v)) || timeOf(v) === 0)) {
        // Aucune des versions n'a de timestamp exploitable — on ne peut pas
        // choisir un gagnant significatif. On garde le comportement PouchDB
        // par défaut mais on purge quand même l'arbre pour ne pas le laisser
        // grossir indéfiniment, et on le compte comme "non résolu de façon fiable".
        unresolved++
      } else {
        const winner = versions.reduce((best, cur) => (timeOf(cur) > timeOf(best) ? cur : best))
        if (winner._rev !== doc._rev) {
          const { _rev, ...rest } = winner
          await db.put({ ...rest, _id: doc._id, _rev: doc._rev })
        }
      }

      await Promise.all(
        losingRevs.map((rev) => db.remove(doc._id, rev).catch(() => {})),
      )
    }
  } catch { /* résolution différée à la prochaine pause */ }
  // Pas de db.close() : exécuté pendant qu'un flux live utilise la même base.
  return unresolved
}

function getMetaDb(): PouchDB.Database {
  const tid = getTenantId()
  return new PouchDB(`ecole_saas_${tid}_sync_meta`, { adapter: 'idb' })
}

// Écrit le dernier update_seq local effectivement poussé/à jour vers CouchDB.
// C'est cette valeur que getPendingOperations() compare à info().update_seq
// pour savoir combien de changements locaux n'ont pas encore été envoyés.
// Avant ce correctif, cette clé n'était jamais écrite : le compteur "en
// attente" affichait toujours l'intégralité de l'historique local.
function setLastPushedSeq(entityType: EntityType, seq: number | string): void {
  const key = `${SYNC_META_PREFIX}${getTenantId()}_${entityType}`
  localStorage.setItem(key, String(seq))
}

async function setLastSyncTimestamp(entityType: string, timestamp: string): Promise<void> {
  const db = getMetaDb()
  try {
    const id = `last_sync_${entityType}`
    try {
      const existing = await db.get(id)
      await db.put({ ...existing, timestamp })
    } catch {
      await db.put({ _id: id, timestamp })
    }
  } finally {
    db.close()
  }
}

export async function startEntitySync(entityType: EntityType): Promise<PouchDB.Replication.Sync> {
  const key = getSyncKey(entityType)
  if (activeSyncs.has(key)) {
    return activeSyncs.get(key)!
  }

  const sync = createSync(entityType, {
    live: true,
    retry: true,
    // Reprise rapide après une coupure : au plus 10 s entre deux tentatives
    // (60 s auparavant — une simple micro-coupure figeait un flux une minute).
    back_off_function: (delay: number) => Math.min(delay ? delay * 2 : 1000, 10000),
  })

  const store = useSyncStore.getState()

  sync.on('change', (change) => {
    store.touchContact()
    if (change.direction === 'push' && change.change?.docs_written) {
      store.setEntityStatus(entityType, { syncing: false })
      const seq = (change.change as any)?.last_seq
      if (seq !== undefined) setLastPushedSeq(entityType, seq)
    }
    if (change.direction === 'pull' && change.change?.docs_read) {
      store.setLastSync(new Date().toISOString())
      dirtySince.add(entityType)
      notifyPulled(entityType, change.change.docs_read)
      // Les documents reçus font avancer update_seq local : ils ne sont pas
      // « en attente d'envoi ». Sans ce recalage, chaque réception gonflait
      // le compteur jusqu'à la prochaine pause de la réplication.
      createDatabase(entityType).info().then((info) => setLastPushedSeq(entityType, info.update_seq as any)).catch(() => {})
    }
  })

  // CouchDB a REFUSÉ des documents (droits insuffisants, validation) : PouchDB
  // n'émet pas 'error' mais 'denied' — sans ce gestionnaire, le compteur
  // « en attente » ne redescendait jamais et rien ne l'expliquait.
  sync.on('denied', (err: any) => {
    const msg = `Refusé par le serveur : ${String(err?.message || err?.reason || err?.name || 'accès refusé').slice(0, 120)}`
    console.error(`[Sync] ${entityType} denied:`, err)
    store.setEntityStatus(entityType, { syncing: false, error: msg })
  })

  sync.on('paused', async () => {
    store.touchContact()
    store.setSyncing(false)
    store.setEntityStatus(entityType, { syncing: false })
    // Réplication rattrapée : l'éventuelle erreur précédente est levée.
    store.setEntityStatus(entityType, { error: null })
    // La réplication est à jour (rattrapée) : c'est le bon moment pour
    // détecter et résoudre les conflits éventuellement créés par ce cycle.
    // Conflits : uniquement si cette base a reçu des documents depuis la
    // dernière fois (un allDocs complet ×21 à chaque pause coûtait cher pour
    // rien), et jamais sur le journal d'audit (append-only, volumineux).
    if (dirtySince.has(entityType) && entityType !== 'AuditLog') {
      dirtySince.delete(entityType)
      try {
        const unresolved = await resolveEntityConflicts(entityType)
        remainingConflicts.set(entityType, unresolved)
        pushConflictCount()
      } catch (err) {
        console.error(`[Sync] Résolution des conflits (${entityType}) échouée:`, err)
      }
    }
    try {
      const info = await createDatabase(entityType).info()
      setLastPushedSeq(entityType, info.update_seq as any)
    } catch { /* ignoré */ }
  })

  sync.on('active', () => {
    store.touchContact()
    store.setSyncing(true)
    store.setEntityStatus(entityType, { syncing: true })
  })

  sync.on('complete', () => {
    // « complete » arrive de façon asynchrone après une annulation : si un
    // nouveau flux a déjà pris la place (Synchroniser maintenant), ne pas
    // l'effacer du registre — c'est ce qui affichait « Réplication inactive »
    // partout alors que les flux tournaient.
    if (activeSyncs.get(key) !== sync) return
    activeSyncs.delete(key)
    // Un flux live ne se termine que si on l'annule ; sinon c'est une mort
    // silencieuse (longpoll coupé, erreur fatale) → on le relance.
    if (wantLive) {
      console.warn(`[Sync] ${entityType}: flux live terminé — relance dans 5 s`)
      setTimeout(() => { if (!activeSyncs.has(key)) startEntitySync(entityType).catch(() => {}) }, 5000)
    }
  })

  sync.on('error', (err) => {
    console.error(`[Sync] ${entityType} replication error:`, err)
    const msg = String(err?.message || err?.reason || '')
    // Interruption sans motif (longpoll coupé) ou connexion IndexedDB en cours
    // de fermeture : PouchDB réessaie tout seul, rien à signaler.
    if (!msg || msg.includes('connection is closing') || msg.includes('database is closed')) return
    if (!msg.includes('conflict') && !msg.includes('409')) {
      store.setError(`Erreur de synchronisation (${entityType}): ${msg.slice(0, 120)}`)
    }
    // Mémorisé par entité pour que l'écran de sync puisse expliquer un
    // compteur « en attente » qui ne redescend pas.
    store.setEntityStatus(entityType, { syncing: false, error: msg.slice(0, 160) })
    if (activeSyncs.get(key) === sync) activeSyncs.delete(key)
    // Relance automatique : sans elle, la réplication de cette entité restait
    // morte jusqu'au prochain initSyncEngine (redémarrage de l'app). Le timer
    // est enregistré pour être annulable par stopEntitySync/stopAllSyncs.
    clearTimeout(restartTimers.get(key))
    restartTimers.set(key, setTimeout(() => {
      restartTimers.delete(key)
      if (navigator.onLine && !activeSyncs.has(key)) {
        startEntitySync(entityType).catch((e) =>
          console.error(`[Sync] relance ${entityType} échouée:`, e)
        )
      }
    }, 15000))
  })

  sync.on('denied', (err) => {
    console.warn(`[Sync] ${entityType} replication denied:`, err)
  })

  activeSyncs.set(key, sync)
  return sync
}

export function stopEntitySync(entityType: EntityType): void {
  const key = getSyncKey(entityType)
  clearTimeout(restartTimers.get(key))
  restartTimers.delete(key)
  const sync = activeSyncs.get(key)
  if (sync) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

// Vrai tant que l'app veut des flux live actifs (entre startAllSyncs et
// stopAllSyncs) : un flux qui meurt pendant ce temps est relancé ; après une
// déconnexion volontaire, non.
let wantLive = false

export function stopAllSyncs(): void {
  wantLive = false
  for (const timer of restartTimers.values()) clearTimeout(timer)
  restartTimers.clear()
  for (const [key, sync] of activeSyncs) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

export async function startAllSyncs(): Promise<void> {
  wantLive = true
  const results = await Promise.allSettled(
    SYNC_ENTITY_TYPES.map((type) => startEntitySync(type)),
  )
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      console.error(`[Sync] Failed to start sync for ${SYNC_ENTITY_TYPES[i]}:`, results[i])
    }
  }
}

export async function syncEntityNow(entityType: EntityType): Promise<{
  docsRead: number
  docsWritten: number
  docsFailed: number
}> {
  // Pas de local.close() en fin de fonction : la connexion IndexedDB est
  // partagée par nom ; la fermer pendant que les flux live redémarrent
  // provoquait « The database connection is closing ».
  const local = createDatabase(entityType)
  const remote = createRemoteDatabase(entityType)

  {
    const pushResult = await local.replicate.to(remote, { batch_size: 100 })
    const pullResult = await local.replicate.from(remote, { batch_size: 100 })

    const timestamp = new Date().toISOString()
    await setLastSyncTimestamp(entityType, timestamp)
    const info = await local.info()
    setLastPushedSeq(entityType, info.update_seq as any)
    useSyncStore.getState().setLastSync(timestamp)

    const unresolved = await resolveEntityConflicts(entityType)
    remainingConflicts.set(entityType, unresolved)
    pushConflictCount()

    return {
      docsRead: pullResult.docs_read,
      docsWritten: pushResult.docs_written,
      docsFailed: (pushResult.docs_failed || 0) + (pullResult.docs_failed || 0),
    }
  }
}

/** Une promesse qui ne peut pas rester pendue : au-delà du délai, on rend la main. */
/** Ce que rend une réplication PouchDB, une fois terminée. */
interface ReplicationResult {
  docs_read?: number
  docs_written?: number
}

/**
 * PouchDB expose replicate.to/from comme un EventEmitter « thenable » :
 * TypeScript n'en tire aucun type exploitable (`unknown`), et toute lecture de
 * `docs_read` / `docs_written` échouait. Ce passe-plat rétablit la forme réelle
 * du résultat, qui est stable d'une version à l'autre.
 */
function asReplication(p: unknown): Promise<ReplicationResult> {
  return p as Promise<ReplicationResult>
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s)`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export async function syncAllNow(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  store.setSyncing(true)
  store.setError(null)

  // Toutes les bases en parallèle, chacune bornée à 20 s : auparavant la
  // boucle était séquentielle et sans délai — une seule réplication pendue
  // (long-poll mort, réseau qui hoquette) bloquait « Synchroniser maintenant »
  // pour toujours, spinner compris.
  const results: SyncResult[] = await Promise.all(SYNC_ENTITY_TYPES.map(async (entityType): Promise<SyncResult> => {
    try {
      const result = await withTimeout(syncEntityNow(entityType), 20000, entityType)
      return {
        entityType,
        ok: result.docsFailed === 0,
        synced: result.docsWritten,
        errors: result.docsFailed,
        conflicts: 0,
      }
    } catch (err: any) {
      return {
        entityType,
        ok: false,
        synced: 0,
        errors: 1,
        conflicts: 0,
        error: err?.message,
      }
    }
  }))

  const hasErrors = results.some((r) => !r.ok)
  if (hasErrors) {
    store.setError('Certaines entités n\'ont pas pu être synchronisées')
  }

  store.setSyncing(false)
  store.setLastSync(new Date().toISOString())

  return results
}

export interface PendingEntity {
  entityType: EntityType
  /** Changements locaux non encore poussés (0 si inconnu). */
  count: number
  /** Réplication en erreur : explique pourquoi le compteur ne redescend pas. */
  error?: string | null
  /** Aucune réplication active pour cette entité (pas démarrée / arrêtée). */
  inactive?: boolean
}

/**
 * Changements locaux non encore poussés, par entité.
 * Compare update_seq local au dernier seq poussé (posé sur 'paused').
 * Toutes les entités sont inspectées — y compris celles dont la réplication
 * n'a pas démarré ou est tombée en erreur, sinon elles disparaissaient du
 * compteur alors qu'elles sont précisément la cause du blocage.
 */
export async function getPendingOperations(): Promise<PendingEntity[]> {
  const store = useSyncStore.getState()
  const tenantPrefix = `${getTenantId()}:`
  const activeKeys = new Set(Array.from(activeSyncs.keys()).filter((k) => k.startsWith(tenantPrefix)))
  const pending: PendingEntity[] = []

  for (const entityType of SYNC_ENTITY_TYPES) {
    const db = createDatabase(entityType)
    try {
      const info = await db.info()
      const lastSeqKey = `${SYNC_META_PREFIX}${getTenantId()}_${entityType}`
      const lastPushedSeq = parseInt(localStorage.getItem(lastSeqKey) || '0', 10)
      const diff = Number(info.update_seq) - lastPushedSeq
      const error = store.entityStatus[entityType]?.error ?? null
      const inactive = !activeKeys.has(`${tenantPrefix}${entityType}`)
      // Toutes les bases sont listées (0 = « À jour ») : l'écran de synchro
      // montre l'état complet plutôt qu'un vide ambigu quand tout va bien.
      pending.push({ entityType, count: Math.max(0, diff), error, inactive })
    } catch {
      pending.push({ entityType, count: 0, error: 'Base locale inaccessible' })
    }
  }

  // Toujours mis à jour — y compris à 0, sinon l'ancienne valeur restait
  // affichée après une synchronisation réussie.
  store.setPendingCount(pending.reduce((sum, p) => sum + p.count, 0))
  return pending
}

// ---------------------------------------------------------------------------
// Réception de données : les écrans (React Query) ne surveillent pas PouchDB ;
// on émet un évènement global à chaque lot reçu pour qu'ils se rafraîchissent.
// ---------------------------------------------------------------------------
export const SYNC_PULLED_EVENT = 'sync:pulled'

function notifyPulled(entityType: EntityType, count: number): void {
  if (!count) return
  try {
    window.dispatchEvent(new CustomEvent(SYNC_PULLED_EVENT, { detail: { entityType, count } }))
  } catch { /* hors navigateur */ }
}

let pulling = false

/**
 * Récupération ponctuelle de TOUTES les bases (réplication « from » avec
 * point de reprise : quasi gratuite quand rien n'a changé). Appelée toutes
 * les quelques secondes en arrière-plan en complément des flux live, pour
 * qu'une saisie faite sur mobile (relayée par le serveur) apparaisse sur le
 * poste même si un flux live s'est endormi.
 */
export async function pullAllNow(): Promise<number> {
  if (pulling || !navigator.onLine || !hasCouchDBConfig()) return 0
  pulling = true
  let total = 0
  const store = useSyncStore.getState()
  try {
    await Promise.allSettled(SYNC_ENTITY_TYPES.map(async (entityType) => {
      const local = createDatabase(entityType)
      const remote = createRemoteDatabase(entityType)
      try {
        // 1. Envoi : tout changement local non poussé part ici, même si le
        //    flux live dort — puis le point de référence du compteur « en
        //    attente » est recalé sur la réalité (0 si tout est parti).
        //    Envoi seulement s'il y a réellement des changements locaux non
        //    poussés (sinon 21 réplications à vide toutes les 6 s).
        const before = await local.info()
        const lastPushed = parseInt(localStorage.getItem(`${SYNC_META_PREFIX}${getTenantId()}_${entityType}`) || '0', 10)
        const push: ReplicationResult = Number(before.update_seq) > lastPushed
          ? await withTimeout(asReplication(local.replicate.to(remote, { batch_size: 200 })), 20000, `${entityType} (envoi)`)
          : { docs_written: 0 }
        // 2. Réception.
        const pull = await withTimeout(asReplication(local.replicate.from(remote, { batch_size: 200 })), 20000, `${entityType} (réception)`)
        store.touchContact()
        const info = await local.info()
        setLastPushedSeq(entityType, info.update_seq as any)
        if (pull.docs_read) {
          total += pull.docs_read
          notifyPulled(entityType, pull.docs_read)
        }
        if (push.docs_written || pull.docs_read) store.setLastSync(new Date().toISOString())
        store.setEntityStatus(entityType, { error: null })
      } catch (err: any) {
        // Erreur réelle (réseau, refus) : visible dans l'écran de synchro.
        // Les erreurs sans message (requête interrompue, base fermée par un
        // autre flux) sont transitoires : la passe suivante réessaie.
        const msg = String(err?.message || err?.reason || '')
        const transient = !msg || msg.includes('conflict') || msg.includes('connection is closing') || msg.includes('database is closed')
        if (!transient) store.setEntityStatus(entityType, { error: msg.slice(0, 160) })
      }
      // Pas de local.close() : les instances PouchDB partagent la connexion
      // IndexedDB par nom — la fermer ici coupait les flux live en cours.
    }))
  } finally {
    pulling = false
  }
  return total
}

/**
 * « Synchroniser maintenant » léger : pour chaque base, s'assurer que le flux
 * live existe (le relancer sinon) puis attendre qu'il soit à jour — borné.
 * Les bases en erreur passent par une réplication ponctuelle. Aucune
 * réplication n'est refaite pour une base dont le flux tourne et est à jour.
 */
export async function nudgeAllSyncs(timeoutMs = 10000): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  store.setError(null)
  const tenantPrefix = `${getTenantId()}:`
  return Promise.all(SYNC_ENTITY_TYPES.map(async (entityType): Promise<SyncResult> => {
    const key = `${tenantPrefix}${entityType}`
    const status = store.entityStatus[entityType]
    try {
      if (status?.error) {
        // Base en erreur : échange ponctuel pour repartir sur une base saine.
        const r = await withTimeout(syncEntityNow(entityType), timeoutMs, entityType)
        useSyncStore.getState().setEntityStatus(entityType, { error: null })
        if (!activeSyncs.has(key)) await startEntitySync(entityType)
        return { entityType, ok: r.docsFailed === 0, synced: r.docsWritten, errors: r.docsFailed, conflicts: 0 }
      }
      if (!activeSyncs.has(key)) await startEntitySync(entityType)
      // Attendre que le flux ait fini de rattraper (syncing → false).
      const start = Date.now()
      while (useSyncStore.getState().entityStatus[entityType]?.syncing && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 200))
      }
      const info = await createDatabase(entityType).info()
      setLastPushedSeq(entityType, info.update_seq as any)
      return { entityType, ok: true, synced: 0, errors: 0, conflicts: 0 }
    } catch (err: any) {
      return { entityType, ok: false, synced: 0, errors: 1, conflicts: 0, error: err?.message }
    }
  }))
}

/** Nombre de flux live enregistrés pour le tenant courant (chien de garde). */
export function activeSyncCount(): number {
  const prefix = `${getTenantId()}:`
  let n = 0
  for (const key of activeSyncs.keys()) if (key.startsWith(prefix)) n++
  return n
}
