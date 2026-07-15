import {
  getAllDocuments,
  getDocument,
  putDocument,
  deleteDocument,
  createDatabase,
  type EntityType,
} from './pouchdb'
import { enqueueOperation } from './sync-engine'

export async function queryEntities<T = any>(entityType: EntityType, filters?: Record<string, any>): Promise<T[]> {
  let results = await getAllDocuments(entityType)

  if (filters) {
    let limit: number | undefined
    let offset: number | undefined

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue

      if (key === 'limit') {
        limit = value as number
        continue
      }

      if (key === 'offset') {
        offset = value as number
        continue
      }

      if (key === 'page' || key === 'pageSize') continue

      if (key === 'sortBy' || key === 'sort_by' || key === 'sort') {
        const sortKey = key
        const dir = (filters as any).sortDirection === 'asc' ? 1 : -1
        results = [...results].sort((a: any, b: any) => {
          const aVal = a[sortKey]
          const bVal = b[sortKey]
          if (aVal < bVal) return -dir
          if (aVal > bVal) return dir
          return 0
        })
        continue
      }

      if (key === 'sortDirection' || key === 'sort_order' || key === 'direction' || key === 'order') continue

      if (key === 'search') {
        const term = String(value).toLowerCase()
        results = results.filter((doc: any) => {
          const values = Object.values(doc).map((v) => String(v).toLowerCase())
          return values.some((v) => v.includes(term))
        })
        continue
      }

      results = results.filter((doc: any) => doc[key] === value)
    }

    if (offset) results = results.slice(offset)
    if (limit) results = results.slice(0, limit)
  }

  return results as T[]
}

export async function countEntities(entityType: EntityType, filters?: Record<string, any>): Promise<number> {
  const { limit: _limit, offset: _offset, ...cleanFilters } = filters || {}
  const results = await queryEntities(entityType, cleanFilters)
  return results.length
}

export async function getEntityById<T = any>(entityType: EntityType, id: string): Promise<T | null> {
  const doc = await getDocument(entityType, id)
  return doc as T | null
}

export async function saveEntity(entityType: EntityType, data: any): Promise<any> {
  const id = data._id || data.id || crypto.randomUUID()
  const db = createDatabase(entityType)
  let existingRev: string | undefined
  try {
    const existing = await db.get(id)
    existingRev = existing._rev
  } catch { }
  db.close()
  const doc = { ...data, _id: id }
  if (existingRev) doc._rev = existingRev
  const isUpdate = !!existingRev
  let response: any
  try {
    response = await putDocument(entityType, doc)
  } catch (err) {
    console.error(`saveEntity(${entityType}, ${id}) putDocument error:`, err)
    throw err
  }

  await enqueueOperation(
    entityType,
    data.id || id,
    isUpdate ? 'UPDATE' : 'CREATE',
    data,
  )

  return { ...doc, _rev: response.rev }
}

export async function deleteEntity(entityType: EntityType, id: string): Promise<boolean> {
  await deleteDocument(entityType, id)

  await enqueueOperation(entityType, id, 'DELETE', {})

  return true
}
