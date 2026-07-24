import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import {
  queryEntities,
  saveEntity,
  deleteEntity,
} from './pouchdb-compat'
import { offlineSave, offlineDelete } from './offline-queue'
import type { EntityType } from './pouchdb'
import { useSyncStore } from '@/stores/sync-store'
import { getTenantSetting } from '@/lib/tenant-settings'

export interface QueryResult<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface MutationResult<T> {
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
        setError(err.message)
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
    return () => {
      mountedRef.current = false
    }
  }, [fetch, ...deps])

  return { data, loading, error, refetch: fetch }
}

export function useLocalMutation<T = any>(entityType: EntityType): MutationResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const mutate = useCallback(
    async (payload: any): Promise<T | null> => {
      try {
        setLoading(true)
        setError(null)
        const result = await offlineSave(entityType, payload)
        if (mountedRef.current) {
          setData(result as T)
        }
        return result as T
      } catch (err: any) {
        const msg = err.message
        if (mountedRef.current) {
          setError(msg)
        }
        return null
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    },
    [entityType],
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, loading, error, mutate, reset }
}

export function useLocalDelete(entityType: EntityType) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setLoading(true)
        setError(null)
        const ok = await offlineDelete(entityType, id)
        return ok
      } catch (err: any) {
        setError(err.message)
        return false
      } finally {
        setLoading(false)
      }
    },
    [entityType],
  )

  return { remove, loading, error }
}

export function usePeriods() {
  const [periods, setPeriods] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rawSystem = await getTenantSetting('period_system')
        const system = rawSystem || 'TRIMESTER'
        const rawAcademic = await getTenantSetting('academic_year')
        const academic = rawAcademic ? JSON.parse(rawAcademic) : null

        if (cancelled) return

        const savedPeriods = academic?.periods
        if (savedPeriods?.length) {
          setPeriods(savedPeriods.map((p: any) => ({ value: p.id, label: p.name })))
        } else {
          const labels: Record<string, string[]> = {
            TRIMESTER: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'],
            SEMESTER: ['Semestre 1', 'Semestre 2'],
            BIMESTER: ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4', 'Bimestre 5'],
          }
          const items = (labels[system] || labels.TRIMESTER).map((label, i) => ({
            value: String(i + 1),
            label,
          }))
          setPeriods(items)
        }
      } catch {
        if (!cancelled) {
          setPeriods([
            { value: '1', label: 'Trimestre 1' },
            { value: '2', label: 'Trimestre 2' },
            { value: '3', label: 'Trimestre 3' },
          ])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { periods, loading }
}

export function useStaticData() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await Promise.all([
          queryEntities('Class'),
          queryEntities('Subject'),
          queryEntities('Teacher'),
        ])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { loading }
}

// Invalide le cache React Query quand le moteur de sync réel (PouchDB↔CouchDB,
// voir sync-manager.ts) reçoit du nouveau contenu ou repasse en ligne. Ceci
// s'appuyait auparavant sur des événements IPC (`sync:progress`/`sync:status-changed`)
// que le process main n'a jamais émis — l'invalidation ne se déclenchait donc
// jamais. Le moteur de sync tourne entièrement dans le renderer (voir
// SyncLifecycle dans App.tsx) ; on s'abonne directement à son store zustand.
export function useSyncInvalidation() {
  const queryClient = useQueryClient()
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt)
  const isOnline = useSyncStore((s) => s.isOnline)

  useEffect(() => {
    if (lastSyncAt) {
      queryClient.invalidateQueries()
    }
  }, [lastSyncAt, queryClient])

  useEffect(() => {
    if (isOnline) {
      queryClient.invalidateQueries()
    }
  }, [isOnline, queryClient])
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
