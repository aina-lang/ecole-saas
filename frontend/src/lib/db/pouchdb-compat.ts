import {
  getAllDocuments,
  getDocument,
  putDocument,
  deleteDocument,
  createDatabase,
  type EntityType,
} from './pouchdb'
import { getTenantId } from './token-cache'

/** Résout le tenantId courant depuis la mémoire (token-cache) ou localStorage. */
function getCurrentTenantId(): string | null {
  return getTenantId() ?? localStorage.getItem('tenantId') ?? null
}

/**
 * Enrichit un array de Teacher en lisant les infos User depuis la base User locale.
 * Ajoute les champs user_firstName, user_lastName, user_email sur chaque Teacher.
 * Utilisable quand Teacher.user est un objet plat { id: '...' } sans détails.
 */
export async function enrichTeachers(teachers: any[]): Promise<any[]> {
  try {
    const users = await queryEntities<any>('User')
    const userMap = new Map(users.map((u) => [u.id, u]))
    return teachers.map((t) => {
      const userId = t.userId || (t.user && typeof t.user === 'object' ? t.user.id : null)
      const user = userId ? userMap.get(userId) : null
      const enriched: any = {
        ...t,
        user_firstName: t.user_firstName ?? (user?.firstName ?? user?.user_firstName ?? t.user?.firstName ?? ''),
        user_lastName: t.user_lastName ?? (user?.lastName ?? user?.user_lastName ?? t.user?.lastName ?? ''),
        user_email: t.user_email ?? (user?.email ?? user?.user_email ?? t.user?.email ?? ''),
      }
      // Si la base User a des phones stockés sous forme de champ user_phone_i
      for (let i = 0; i < 3; i++) {
        if (!enriched[`user_phone_${i}`]) {
          if (user?.[`user_phone_${i}`]) {
            enriched[`user_phone_${i}`] = user[`user_phone_${i}`]
          } else if (user?.phones?.[i]?.value) {
            enriched[`user_phone_${i}`] = user.phones[i].value
          }
        }
      }
      // Fallback: certains anciens docs ont firstName/lastName directement
      if (!enriched.user_firstName && t.firstName) {
        enriched.user_firstName = t.firstName
      }
      if (!enriched.user_lastName && t.lastName) {
        enriched.user_lastName = t.lastName
      }
      if (!enriched.user_email && t.email) {
        enriched.user_email = t.email
      }
      return enriched
    })
  } catch {
    return teachers
  }
}

export async function queryEntities<T = any>(entityType: EntityType, filters?: Record<string, any>): Promise<T[]> {
  let results = await getAllDocuments(entityType)

  // (#7) Filtre de garde : on ne renvoie que les docs du tenant courant.
  // La DB est déjà isolée par tenant (nom incluant le tenantId), mais si un
  // doc sans tenantId a été injecté par erreur, on l'écarte pour éviter
  // toute fuite de données entre tenants.
  const guardTenantId = getCurrentTenantId()
  if (guardTenantId) {
    results = results.filter((doc: any) => !doc.tenantId || doc.tenantId === guardTenantId)
  }

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
        const sortKey = (filters as any).sortBy || (filters as any).sort_by || (filters as any).sort
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

      if (key === 'sortDirection' || key === 'sortOrder' || key === 'sort_order' || key === 'direction' || key === 'order') continue

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

  // FIXE CRITIQUE : garantir que tenantId est toujours présent dans le document.
  // Sans lui, le sync-worker serveur jette le doc silencieusement (processChange:61).
  const tenantId = data.tenantId || getCurrentTenantId()
  if (!tenantId) {
    console.warn(`[PouchDB] saveEntity(${entityType}, ${id}): tenantId manquant — le document ne sera pas synchronisé avec PostgreSQL`)
  }

  const db = createDatabase(entityType)
  let existingRev: string | undefined
  try {
    const existing = await db.get(id)
    existingRev = existing._rev
  } catch { }
  db.close()

  // tenantId forcé dans le doc, qu'il vienne du payload ou du store
  const doc: any = { ...data, _id: id, tenantId }
  if (existingRev) doc._rev = existingRev
  let response: any
  try {
    response = await putDocument(entityType, doc)
  } catch (err) {
    console.error(`saveEntity(${entityType}, ${id}) putDocument error:`, err)
    throw err
  }

  return { ...doc, _rev: response.rev }
}

export async function deleteEntity(entityType: EntityType, id: string): Promise<boolean> {
  await deleteDocument(entityType, id)
  return true
}
