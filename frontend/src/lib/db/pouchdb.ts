import PouchDB from 'pouchdb'

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

function getDbName(entityType: EntityType): string {
  return `${DB_PREFIX}${entityType.toLowerCase()}`
}

export function createDatabase(entityType: EntityType): PouchDB.Database {
  return new PouchDB(getDbName(entityType), { adapter: 'idb' })
}

export async function getAllDocuments(entityType: EntityType): Promise<any[]> {
  const db = createDatabase(entityType)
  try {
    const result = await db.allDocs({ include_docs: true, descending: true })
    return result.rows.map((row: any) => {
      const doc = row.doc
      if (!doc) return null
      const { _rev, ...rest } = doc
      return rest._id ? { ...rest, id: rest._id } : rest
    }).filter(Boolean)
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
