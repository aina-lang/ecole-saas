import { saveEntity, deleteEntity } from './pouchdb-compat'
import type { EntityType } from './pouchdb'

export async function offlineSave(
  entityType: EntityType,
  data: any,
): Promise<any> {
  const id = data._id || data.id || crypto.randomUUID()
  const doc = { ...data, _id: id }
  const result = await saveEntity(entityType, doc)
  return result
}

export async function offlineDelete(
  entityType: EntityType,
  id: string,
): Promise<boolean> {
  return deleteEntity(entityType, id)
}

export async function offlineBulkCreate(
  entityType: EntityType,
  docs: any[],
): Promise<any[]> {
  const results = []
  for (const doc of docs) {
    const payload = {
      ...doc,
      _id: doc._id || doc.id || crypto.randomUUID(),
    }
    const r = await saveEntity(entityType, payload)
    results.push(r)
  }
  return results
}
