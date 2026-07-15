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
  } catch {
  }
}

function getDbName(entityType: EntityType): string {
  return `${DB_PREFIX}${entityType.toLowerCase()}`
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
