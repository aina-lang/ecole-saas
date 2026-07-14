import client from '@/api/client'

export type EntityType = 'Student' | 'User' | 'Teacher' | 'Subject' | 'Class' | 'Grade' | 'Attendance'

export const staticData = {
  classes: [] as any[],
  subjects: [] as any[],
  teachers: [] as any[],
  loaded: false,
}

async function isElectron(): Promise<boolean> {
  return typeof window !== 'undefined' && !!window.api?.local
}

async function onlineSave(entityType: string, data: any): Promise<any> {
  const endpoints: Record<string, { base: string; getId: (d: any) => string }> = {
    Student: { base: '/students', getId: (d) => d.id },
    User: { base: '/users', getId: (d) => d.id },
    Teacher: { base: '/teachers', getId: (d) => d.id },
    Subject: { base: '/subjects', getId: (d) => d.id },
    Class: { base: '/classes', getId: (d) => d.id },
    Grade: { base: '/grades', getId: (d) => d.id },
    Attendance: { base: '/attendance', getId: (d) => d.id },
  }

  const cfg = endpoints[entityType]
  if (!cfg) throw new Error(`No endpoint for ${entityType}`)

  const id = cfg.getId(data)
  if (id) {
    const { data: result } = await client.patch(`${cfg.base}/${id}`, data)
    return result?.data ?? result
  }
  const { data: result } = await client.post(cfg.base, data)
  return result?.data ?? result
}

async function onlineQuery(entityType: string, filters?: Record<string, any>): Promise<any[]> {
  const endpoints: Record<string, string> = {
    Student: '/students',
    User: '/users',
    Teacher: '/teachers',
    Subject: '/subjects',
    Class: '/classes',
    Grade: '/grades',
    Attendance: '/attendance',
  }

  const base = endpoints[entityType]
  if (!base) return []

  const { data } = await client.get(base, { params: filters })
  return data?.data ?? data ?? []
}

function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(camelToSnake)
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    result[snakeKey] = camelToSnake(value)
  }
  return result
}

export async function saveEntity(entityType: EntityType, data: any): Promise<any> {
  if (await isElectron()) {
    await window.api.local.save(entityType, data)
    const result = { ...data, _offline: true }
    if (window.api?.sync?.forceSync) {
      window.api.sync.forceSync().catch(() => {})
    }
    return result
  }
  return onlineSave(entityType, data)
}

export async function deleteEntity(entityType: EntityType, id: string): Promise<boolean> {
  if (await isElectron()) {
    const result = await window.api.local.delete(entityType, id)
    if (window.api?.sync?.forceSync) {
      window.api.sync.forceSync().catch(() => {})
    }
    return result.success
  }
  const endpoints: Record<string, string> = {
    Student: '/students',
    User: '/users',
    Teacher: '/teachers',
    Subject: '/subjects',
    Class: '/classes',
    Grade: '/grades',
    Attendance: '/attendance',
  }
  const base = endpoints[entityType]
  if (!base) return false
  await client.delete(`${base}/${id}`)
  return true
}

export async function queryEntities<T = any>(entityType: EntityType, filters?: Record<string, any>): Promise<T[]> {
  if (await isElectron()) {
    const results = await window.api.local.query(entityType, filters)
    return results ?? []
  }
  return onlineQuery(entityType, filters)
}

export async function getEntityById<T = any>(entityType: EntityType, id: string): Promise<T | null> {
  if (await isElectron()) {
    return window.api.local.getById(entityType, id)
  }
  const endpoints: Record<string, string> = {
    Student: '/students',
    User: '/users',
    Teacher: '/teachers',
    Subject: '/subjects',
    Class: '/classes',
    Grade: '/grades',
    Attendance: '/attendance',
  }
  const base = endpoints[entityType]
  if (!base) return null
  const { data } = await client.get(`${base}/${id}`)
  return data?.data ?? data ?? null
}

export async function loadStaticData(): Promise<void> {
  staticData.classes = await queryEntities('Class')
  staticData.subjects = await queryEntities('Subject')
  staticData.teachers = await queryEntities('Teacher')
  staticData.loaded = true
}
