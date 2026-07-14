import { useState, useEffect, useCallback, useRef } from 'react'
import client, { extractErrorMessage } from '@/api/client'
import { queryEntities, saveEntity, deleteEntity, getEntityById, type EntityType, staticData, loadStaticData } from './offline'

interface QueryResult<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface MutationResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  mutate: (data: any) => Promise<T | null>
  reset: () => void
}

export function useLocalQuery<T = any>(
  entityType: EntityType,
  filters?: Record<string, any>,
  deps: any[] = [],
): QueryResult<T> {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const results = await queryEntities<T>(entityType, filters)
      if (mountedRef.current) {
        setData(results)
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(extractErrorMessage(err))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [entityType, JSON.stringify(filters)])

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch, ...deps])

  return { data, loading, error, refetch: fetch }
}

export function useLocalMutation<T = any>(entityType: EntityType): MutationResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const mutate = useCallback(async (payload: any): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      const result = await saveEntity(entityType, payload)
      if (mountedRef.current) {
        setData(result as T)
      }
      return result as T
    } catch (err: any) {
      const msg = extractErrorMessage(err)
      if (mountedRef.current) {
        setError(msg)
      }
      return null
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [entityType])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  return { data, loading, error, mutate, reset }
}

export function useLocalDelete(entityType: EntityType) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)
      const ok = await deleteEntity(entityType, id)
      return ok
    } catch (err: any) {
      setError(extractErrorMessage(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [entityType])

  return { remove, loading, error }
}

export function useStaticData() {
  const [loading, setLoading] = useState(!staticData.loaded)

  useEffect(() => {
    if (!staticData.loaded) {
      setLoading(true)
      loadStaticData().finally(() => setLoading(false))
    }
  }, [])

  return { ...staticData, loading }
}

export async function saveRemoteDirect(entityType: string, data: any): Promise<any> {
  const endpoints: Record<string, { base: string }> = {
    Student: { base: '/students' },
    User: { base: '/users' },
    Teacher: { base: '/teachers' },
    Subject: { base: '/subjects' },
    Class: { base: '/classes' },
  }
  const cfg = endpoints[entityType]
  if (!cfg) throw new Error(`No endpoint for ${entityType}`)

  if (data.id) {
    const { data: res } = await client.patch(`${cfg.base}/${data.id}`, data)
    return res?.data ?? res
  }
  const { data: res } = await client.post(cfg.base, data)
  return res?.data ?? res
}
