import PouchDB from 'pouchdb'
import client from '@/api/client'

export type EntityType =
  | 'Student'
  | 'User'
  | 'Teacher'
  | 'Subject'
  | 'Class'
  | 'Grade'
  | 'Attendance'
  | 'Payment'
  | 'FeeStructure'
  | 'Message'
  | 'TimetableSlot'
  | 'TeacherContract'
  | 'TeacherPayment'
  | 'TeacherAttendance'

const DB_PREFIX = 'ecole_saas_'
let couchDBUrl = 'http://localhost:5984'
let couchDBUser = ''
let couchDBPass = ''

/**
 * TenantId actif — inclus dans le nom des bases IndexedDB pour isoler
 * les données entre comptes. Sans ça, tous les tenants partagent
 * la même base `ecole_saas_student` et se voient mutuellement.
 */
let currentTenantId: string = localStorage.getItem('tenantId') || 'default'

/**
 * À appeler immédiatement après login pour basculer les bases locales
 * vers le contexte du nouveau tenant.
 */
export function setCurrentTenant(tenantId: string): void {
  currentTenantId = tenantId
  console.log(`[PouchDB] Tenant basculé : ${tenantId}`)
}

export function configureCouchDB(url: string, user?: string, pass?: string): void {
  couchDBUrl = url.replace(/\/+$/, '')
  couchDBUser = user || ''
  couchDBPass = pass || ''
}

export async function fetchCouchDBConfig(): Promise<void> {
  try {
    const { data } = await client.get('/sync/couchdb-config')
    if (data?.url) couchDBUrl = data.url.replace(/\/+$/, '')
    if (data?.user) couchDBUser = data.user
    if (data?.pass) couchDBPass = data.pass
    console.log('[PouchDB] CouchDB config:', couchDBUrl)
  } catch (e) {
    console.warn('[PouchDB] Cannot fetch CouchDB config, using default', couchDBUrl)
  }
}

/**
 * Nom de la DB locale — inclut le tenantId pour isoler les données.
 * ex : `ecole_saas_tid_abc123_student`
 */
function getDbName(entityType: EntityType): string {
  const tid = currentTenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${DB_PREFIX}${tid}_${entityType.toLowerCase()}`
}

function getRemoteDbName(entityType: EntityType): string {
  return `ecole-saas-${entityType.toLowerCase()}`
}

function getAuthPart(): string {
  if (couchDBUser && couchDBPass) return `${couchDBUser}:${encodeURIComponent(couchDBPass)}@`
  return ''
}

function getRemoteUrl(entityType: EntityType): string {
  const db = getRemoteDbName(entityType)
  return `${couchDBUrl.replace('://', `://${getAuthPart()}`)}/${db}`
}

export function createDatabase(entityType: EntityType): PouchDB.Database {
  return new PouchDB(getDbName(entityType), { adapter: 'idb' })
}

export function createRemoteDatabase(entityType: EntityType): PouchDB.Database {
  return new PouchDB(getRemoteUrl(entityType))
}

export function createSync(
  entityType: EntityType,
  options: PouchDB.Replication.SyncOptions = {},
): PouchDB.Replication.Sync {
  const local = createDatabase(entityType)
  const remote = createRemoteDatabase(entityType)
  return local.sync(remote, {
    live: true,
    retry: true,
    ...options,
  })
}

export async function getAllDocuments(entityType: EntityType): Promise<any[]> {
  const db = createDatabase(entityType)
  try {
    const result = await db.allDocs({ include_docs: true, descending: true })
    return result.rows
      .map((row: any) => {
        const doc = row.doc
        if (!doc) return null
        const { _rev, ...rest } = doc
        return rest._id ? { ...rest, id: rest._id } : rest
      })
      .filter(Boolean)
  } finally {
    db.close()
  }
}

export async function getDocument(entityType: EntityType, id: string): Promise<any | null> {
  const db = createDatabase(entityType)
  try {
    try {
      const doc = await db.get(id)
      const { _rev, ...rest } = doc
      return rest._id ? { ...rest, id: rest._id } : rest
    } catch (err: any) {
      if (err.status === 404) return null
      throw err
    }
  } finally {
    db.close()
  }
}

export async function putDocument(entityType: EntityType, doc: any): Promise<any> {
  const db = createDatabase(entityType)
  try {
    const response = await db.put(doc)
    return response
  } finally {
    db.close()
  }
}

export async function deleteDocument(
  entityType: EntityType,
  id: string,
  rev?: string,
): Promise<void> {
  const db = createDatabase(entityType)
  try {
    if (!rev) {
      const doc = await db.get(id)
      rev = doc._rev
    }
    await db.remove(id, rev)
  } finally {
    db.close()
  }
}

export async function bulkCreateDocuments(
  entityType: EntityType,
  docs: any[],
): Promise<any> {
  const db = createDatabase(entityType)
  try {
    const result = await db.bulkDocs(docs)
    return result
  } finally {
    db.close()
  }
}


// ─── Deferred Cleanup (Logout offline) ─────────────────────────────────────
// Clé localStorage qui stocke les tenantIds dont les bases doivent être
// nettoyées dès que la connexion est rétablie.
export const PENDING_CLEANUP_KEY = 'pouchdb_pending_cleanup'

export interface PendingCleanup {
  tenantId: string
  loggedOutAt: string // ISO timestamp
}

/** Enregistre un tenant pour cleanup différé (utilisé au logout offline). */
export function scheduleTenantCleanup(tenantId: string): void {
  const existing = getPendingCleanups()
  // Éviter les doublons
  if (existing.find(p => p.tenantId === tenantId)) return
  const updated: PendingCleanup[] = [
    ...existing,
    { tenantId, loggedOutAt: new Date().toISOString() },
  ]
  localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(updated))
  console.log(`[PouchDB] Cleanup différé planifié pour tenant "${tenantId}"`)
}

/** Retourne la liste des tenants en attente de cleanup. */
export function getPendingCleanups(): PendingCleanup[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CLEANUP_KEY) || '[]')
  } catch {
    return []
  }
}

/** Supprime un tenant de la liste de cleanup différé une fois nettoyé. */
export function removePendingCleanup(tenantId: string): void {
  const updated = getPendingCleanups().filter(p => p.tenantId !== tenantId)
  localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(updated))
}
// ────────────────────────────────────────────────────────────────────────────

const ALL_ENTITY_TYPES: EntityType[] = [
  'Student', 'User', 'Teacher', 'Subject', 'Class', 'Grade',
  'Attendance', 'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
]

/**
 * Détruit toutes les bases IndexedDB d'un tenant donné.
 *
 * @param tenantId  - Le tenant à purger (par défaut : tenant courant).
 *                    Passer un ID explicite pour les cleanups différés
 *                    d'un tenant déjà déconnecté.
 */
export async function destroyAllDatabases(tenantId?: string): Promise<void> {
  const tid = (tenantId || currentTenantId).replace(/[^a-zA-Z0-9_-]/g, '_')

  const results = await Promise.allSettled(
    ALL_ENTITY_TYPES.map(async (entityType) => {
      const dbName = `${DB_PREFIX}${tid}_${entityType.toLowerCase()}`
      const db = new PouchDB(dbName, { adapter: 'idb' })
      await db.destroy()
      console.log(`[PouchDB] Base détruite : ${dbName}`)
    })
  )

  // Détruire aussi la base méta (timestamps de sync)
  try {
    const metaDb = new PouchDB(`ecole_saas_${tid}_sync_meta`, { adapter: 'idb' })
    await metaDb.destroy()
  } catch { /* ignoré si absente */ }

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    console.warn(`[PouchDB] ${failed.length} base(s) non détruites pour tenant "${tid}"`)
  } else {
    console.log(`[PouchDB] Toutes les bases du tenant "${tid}" purgées`)
  }
}
