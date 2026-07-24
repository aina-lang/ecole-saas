import PouchDB from 'pouchdb'
import { useSyncStore } from '@/stores/sync-store'
import { createDatabase, createRemoteDatabase, createSync, type EntityType } from './pouchdb'

const SYNC_DEVICE_ID_KEY = 'sync_device_id'
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

// Doit rester alignée avec SYNCABLE_MODELS (server/src/common/prisma/prisma.service.ts)
// et ENTITIES (server/src/modules/sync/sync-worker.service.ts) : ce sont trois listes
// dupliquées faute de package partagé entre frontend et server — toute entité ajoutée
// ici doit l'être aux deux endroits côté serveur, sinon elle se synchronise dans un sens
// mais pas dans l'autre.
const SYNC_ENTITY_TYPES: EntityType[] = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
  'AuditLog', 'Level',
]

const activeSyncs = new Map<string, PouchDB.Replication.Sync>()
const remainingConflicts = new Map<string, number>()

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
  } finally {
    db.close()
  }
  return unresolved
}

function getDeviceId(): string {
  let id = localStorage.getItem(SYNC_DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SYNC_DEVICE_ID_KEY, id)
  }
  return id
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
    back_off_function: (delay: number) => Math.min(delay * 2, 60000),
  })

  const store = useSyncStore.getState()

  sync.on('change', (change) => {
    if (change.direction === 'push' && change.change?.docs_written) {
      store.setEntityStatus(entityType, { syncing: false })
      const seq = (change.change as any)?.last_seq
      if (seq !== undefined) setLastPushedSeq(entityType, seq)
    }
    if (change.direction === 'pull' && change.change?.docs_read) {
      store.setLastSync(new Date().toISOString())
    }
  })

  sync.on('paused', async () => {
    store.setSyncing(false)
    // La réplication est à jour (rattrapée) : c'est le bon moment pour
    // détecter et résoudre les conflits éventuellement créés par ce cycle.
    try {
      const unresolved = await resolveEntityConflicts(entityType)
      remainingConflicts.set(entityType, unresolved)
      pushConflictCount()
    } catch (err) {
      console.error(`[Sync] Résolution des conflits (${entityType}) échouée:`, err)
    }
    const db = createDatabase(entityType)
    try {
      const info = await db.info()
      setLastPushedSeq(entityType, info.update_seq as any)
    } catch { /* ignoré */ } finally {
      db.close()
    }
  })

  sync.on('active', () => {
    store.setSyncing(true)
  })

  sync.on('complete', () => {
    activeSyncs.delete(key)
  })

  sync.on('error', (err) => {
    console.error(`[Sync] ${entityType} replication error:`, err)
    const msg = String(err?.message || err || '')
    if (!msg.includes('conflict') && !msg.includes('409')) {
      store.setError(`Erreur de synchronisation (${entityType}): ${msg.slice(0, 120)}`)
    }
    activeSyncs.delete(key)
  })

  sync.on('denied', (err) => {
    console.warn(`[Sync] ${entityType} replication denied:`, err)
  })

  activeSyncs.set(key, sync)
  return sync
}

export function stopEntitySync(entityType: EntityType): void {
  const key = getSyncKey(entityType)
  const sync = activeSyncs.get(key)
  if (sync) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

export function stopAllSyncs(): void {
  for (const [key, sync] of activeSyncs) {
    sync.cancel()
    activeSyncs.delete(key)
  }
}

export async function startAllSyncs(): Promise<void> {
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
  const local = createDatabase(entityType)
  const remote = createRemoteDatabase(entityType)

  try {
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
  } finally {
    local.close()
    remote.close()
  }
}

export async function syncAllNow(): Promise<SyncResult[]> {
  const store = useSyncStore.getState()
  store.setSyncing(true)
  store.setError(null)

  const results: SyncResult[] = []

  for (const entityType of SYNC_ENTITY_TYPES) {
    try {
      const result = await syncEntityNow(entityType)
      results.push({
        entityType,
        ok: result.docsFailed === 0,
        synced: result.docsWritten,
        errors: result.docsFailed,
        conflicts: 0,
      })
    } catch (err: any) {
      results.push({
        entityType,
        ok: false,
        synced: 0,
        errors: 1,
        conflicts: 0,
        error: err.message,
      })
    }
  }

  const hasErrors = results.some((r) => !r.ok)
  if (hasErrors) {
    store.setError('Certaines entités n\'ont pas pu être synchronisées')
  }

  store.setSyncing(false)
  store.setLastSync(new Date().toISOString())

  return results
}

export async function getPendingOperations(): Promise<any[]> {
  const store = useSyncStore.getState()
  const tenantPrefix = `${getTenantId()}:`
  const replicating = Array.from(activeSyncs.keys())
    .filter((key) => key.startsWith(tenantPrefix))
    .map((key) => key.slice(tenantPrefix.length)) as EntityType[]

  const local = createDatabase('FeeStructure')
  local.close()

  const pending: any[] = []

  for (const entityType of replicating) {
    try {
      const db = createDatabase(entityType)
      const info = await db.info()
      const lastSeqKey = `${SYNC_META_PREFIX}${getTenantId()}_${entityType}`
      const lastPushedSeq = parseInt(localStorage.getItem(lastSeqKey) || '0', 10)
      const diff = info.update_seq - lastPushedSeq
      if (diff > 0) {
        pending.push({
          entityType,
          status: 'pending',
          count: diff,
          _localSeq: info.update_seq,
        })
      }
      db.close()
    } catch {
      pending.push({ entityType, status: 'unknown' })
    }
  }

  if (pending.length > 0) {
    store.setPendingCount(pending.reduce((sum, p) => sum + (p.count || 0), 0))
  }

  return pending
}
