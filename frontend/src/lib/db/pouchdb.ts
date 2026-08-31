import PouchDB from 'pouchdb'
import client from '@/api/client'

// Source unique des entités locales : le type EntityType, la liste de
// purge (destroyAllDatabases) et la liste de synchronisation (sync-engine)
// en dérivent tous — en oublier une devient une erreur de compilation.
// Doit rester alignée avec SYNC_ENTITY_TYPES côté serveur
// (server/src/modules/couchdb/couchdb.constants.ts), seule frontière encore
// manuelle faute de package partagé entre frontend et serveur.
export const ALL_ENTITY_TYPES = [
  'Student', 'User', 'Teacher', 'Subject', 'Class', 'Grade',
  'Attendance', 'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
  'StudentDocument', 'AuditLog', 'Level',
  'StudentEnrollment', 'AcademicYear', 'GradeConfig', 'TenantSetting',
] as const

export type EntityType = typeof ALL_ENTITY_TYPES[number]

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

/** Identifiants CouchDB déjà connus ? (évite un aller-retour serveur inutile) */
export function hasCouchDBConfig(): boolean {
  return !!couchDBUser
}

let lastConfigError: string | null = null

/** Vrai si les identifiants ont été obtenus (sinon, motif dans getCouchDBInfo). */
export async function fetchCouchDBConfig(): Promise<boolean> {
  try {
    const { data } = await client.get('/sync/couchdb-config', { timeout: 10000 })
    if (data?.url) couchDBUrl = data.url.replace(/\/+$/, '')
    if (data?.user) couchDBUser = data.user
    if (data?.pass) couchDBPass = data.pass
    lastConfigError = null
    console.log('[PouchDB] CouchDB config:', couchDBUrl, 'user:', couchDBUser)
    return !!couchDBUser
  } catch (e: any) {
    lastConfigError = e?.response ? `API ${e.response.status}` : (e?.message || 'API injoignable')
    console.warn('[PouchDB] Cannot fetch CouchDB config:', lastConfigError)
    return false
  }
}

/** Diagnostic affiché dans l'écran Synchronisation. */
export function getCouchDBInfo(): { url: string; user: string | null; tenantId: string; error: string | null } {
  return { url: couchDBUrl, user: couchDBUser || null, tenantId: currentTenantId, error: lastConfigError }
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
  const tid = currentTenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `ecole-saas-${tid}-${entityType.toLowerCase()}`
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
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
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
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

export async function putDocument(entityType: EntityType, doc: any): Promise<any> {
  const db = createDatabase(entityType)
  try {
    // getDocument() (ci-dessus) retire volontairement _rev de ce qu'il renvoie,
    // pour ne pas polluer les objets métier utilisés partout dans l'app. Mais
    // le schéma courant "const existing = await getDocument(...); await
    // putDocument({...existing, champ: valeur})" (upload de photo, etc.)
    // arrivait donc ici SANS _rev — et PouchDB refuse catégoriquement un put()
    // sur un document déjà existant sans sa révision courante (409 Conflict).
    // On la retrouve nous-mêmes si elle manque, pour que ce schéma reste sûr
    // quel que soit l'appelant.
    let toWrite = doc
    const id = doc._id || doc.id
    if (!doc._rev && id) {
      try {
        const current = await db.get(id)
        toWrite = { ...doc, _rev: current._rev }
      } catch (err: any) {
        if (err.status !== 404) throw err
        // Document inexistant : rien à fusionner, PouchDB créera normalement.
      }
    }
    const response = await db.put(toWrite)
    return response
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
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
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
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
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
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

const DOC_NAMES_LOCAL_ID = '_local/document_names'

export async function loadCustomDocNames(): Promise<string[]> {
  const db = createDatabase('StudentDocument')
  try {
    const doc = await db.get(DOC_NAMES_LOCAL_ID)
    return (doc as any).names ?? []
  } catch {
    return []
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

export async function saveCustomDocName(name: string): Promise<void> {
  const db = createDatabase('StudentDocument')
  try {
    let doc: any
    try {
      doc = await db.get(DOC_NAMES_LOCAL_ID)
      if (doc.names?.includes(name)) { return }
      doc.names = [...new Set([...(doc.names ?? []), name])]
    } catch {
      doc = { _id: DOC_NAMES_LOCAL_ID, names: [name] }
    }
    await db.put(doc)
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

const FEE_NAMES_LOCAL_ID = '_local/fee_names'

export interface CustomFeeItem {
  name: string
  amount: number
}

export async function loadCustomFeeNames(): Promise<CustomFeeItem[]> {
  const db = createDatabase('FeeStructure')
  try {
    const doc = await db.get(FEE_NAMES_LOCAL_ID)
    return (doc as any).items ?? []
  } catch {
    return []
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

export async function saveCustomFeeItem(item: CustomFeeItem): Promise<void> {
  const db = createDatabase('FeeStructure')
  try {
    let doc: any
    try {
      doc = await db.get(FEE_NAMES_LOCAL_ID)
      const exists = (doc.items ?? []).some((i: CustomFeeItem) => i.name === item.name)
      if (exists) { return }
      doc.items = [...(doc.items ?? []), item]
    } catch {
      doc = { _id: FEE_NAMES_LOCAL_ID, items: [item] }
    }
    await db.put(doc)
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

// ─── Migration ponctuelle : ancienne base 'Fee' → 'FeeStructure' ──────────────
// Avant correction, les grilles tarifaires créées offline atterrissaient dans
// une base locale `ecole_saas_<tenant>_fee` qui n'existait dans aucun typage et
// ne synchronisait jamais avec le serveur (qui utilise 'FeeStructure'). Cette
// migration ponctuelle rapatrie les données locales existantes dans la vraie
// base avant qu'elle ne commence à synchroniser, pour ne pas perdre de données
// déjà saisies par un utilisateur avant ce correctif.
const LEGACY_FEE_MIGRATION_PREFIX = 'ecole_saas_fee_migration_done_'

export async function migrateLegacyFeeDatabase(): Promise<void> {
  const tid = currentTenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const flagKey = `${LEGACY_FEE_MIGRATION_PREFIX}${tid}`
  if (localStorage.getItem(flagKey)) return

  const legacyDb = new PouchDB(`${DB_PREFIX}${tid}_fee`, { adapter: 'idb' })
  try {
    const info = await legacyDb.info()
    if (info.doc_count > 0) {
      const { rows } = await legacyDb.allDocs({ include_docs: true })
      const docs = rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._id.startsWith('_local/'))
        .map((d: any) => {
          const { _rev, ...rest } = d
          return rest
        })
      if (docs.length > 0) {
        const target = createDatabase('FeeStructure')
        try {
          await target.bulkDocs(docs)
          console.log(`[PouchDB] Migration 'Fee' → 'FeeStructure' : ${docs.length} document(s) rapatrié(s)`)
        } finally {
          /* pas de close() */
        }
      }
    }

    try {
      const localNames = await legacyDb.get(FEE_NAMES_LOCAL_ID)
      const { _rev, ...rest } = localNames as any
      const target = createDatabase('FeeStructure')
      try {
        await target.put(rest)
      } finally {
        /* pas de close() */
      }
    } catch {
      // Pas de noms personnalisés hérités — rien à migrer.
    }

    await legacyDb.destroy()
  } catch {
    // Aucune ancienne base 'Fee' pour ce tenant — rien à faire.
  } finally {
    localStorage.setItem(flagKey, '1')
  }
}
