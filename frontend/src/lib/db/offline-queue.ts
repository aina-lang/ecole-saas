import { enqueueOperation, processQueue, getPendingOperations } from './sync-engine'
import { saveEntity, deleteEntity } from './pouchdb-compat'
import { putDocument, type EntityType } from './pouchdb'

export async function offlineSave(
  entityType: EntityType,
  data: any,
): Promise<any> {
  const id = data._id || data.id || crypto.randomUUID()
  const doc = { ...data, _id: id }

  const result = await saveEntity(entityType, doc)

  const serverId = data.id || id
  await enqueueOperation(
    entityType,
    serverId,
    data.id ? 'UPDATE' : 'CREATE',
    data,
  )

  return result
}

export async function offlineDelete(
  entityType: EntityType,
  id: string,
): Promise<boolean> {
  const result = await deleteEntity(entityType, id)

  await enqueueOperation(entityType, id, 'DELETE', {})

  return result
}

export async function offlineBulkCreate(
  entityType: EntityType,
  docs: any[],
): Promise<any[]> {
  const payloads = docs.map((doc) => ({
    ...doc,
    _id: doc._id || doc.id || crypto.randomUUID(),
  }))

  const results = []
  for (const doc of payloads) {
    const r = await putDocument(entityType, doc)
    results.push(r)
  }

  for (const doc of payloads) {
    await enqueueOperation(entityType, doc._id, 'CREATE', doc)
  }

  return results
}

export async function flushQueue(): Promise<{
  synced: number
  conflicts: number
  errors: number
}> {
  const pending = await getPendingOperations()
  if (!pending.length) {
    return { synced: 0, conflicts: 0, errors: 0 }
  }

  return processQueue()
}

export async function getQueueStats(): Promise<{
  total: number
  byEntityType: Record<string, number>
  byOperation: Record<string, number>
}> {
  const operations = await getPendingOperations()
  const byEntityType: Record<string, number> = {}
  const byOperation: Record<string, number> = {}

  for (const op of operations) {
    byEntityType[op.entityType] = (byEntityType[op.entityType] || 0) + 1
    byOperation[op.operation] = (byOperation[op.operation] || 0) + 1
  }

  return {
    total: operations.length,
    byEntityType,
    byOperation,
  }
}
