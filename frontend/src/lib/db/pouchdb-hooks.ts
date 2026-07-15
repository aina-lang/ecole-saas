import { useState, useEffect, useCallback, useRef } from 'react'
import PouchDB from 'pouchdb'
import {
  getAllDocuments,
  getDocument,
  type EntityType,
} from './pouchdb'
import { offlineSave, offlineDelete, offlineBulkCreate } from './offline-queue'

interface QueryResult<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function usePouchDBQuery<T = any>(entityType: EntityType): QueryResult<T> {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const results = await getAllDocuments(entityType)
      if (mountedRef.current) {
        setData(results as T[])
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
  }, [entityType])

  useEffect(() => {
    mountedRef.current = true
    fetch()

    const db = new PouchDB(`ecole_saas_${entityType.toLowerCase()}`, { adapter: 'idb' })

    const unsubscribe = db
      .changes({
        since: 'now',
        live: true,
        include_docs: true,
      })
      .on('change', () => {
        if (mountedRef.current) {
          fetch()
        }
      })

    return () => {
      mountedRef.current = false
      unsubscribe.cancel()
      db.close()
    }
  }, [entityType, fetch])

  return { data, loading, error, refetch: fetch }
}

export function usePouchDBMutation(entityType: EntityType) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const create = useCallback(
    async (doc: any): Promise<any> => {
      try {
        setLoading(true)
        setError(null)
        const result = await offlineSave(entityType, doc)
        return result
      } catch (err: any) {
        const msg = err.message
        if (mountedRef.current) setError(msg)
        throw err
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [entityType],
  )

  const update = useCallback(
    async (id: string, changes: any): Promise<any> => {
      try {
        setLoading(true)
        setError(null)
        const existing = await getDocument(entityType, id)
        if (!existing) throw new Error('Document not found')
        const payload = { ...existing, ...changes, _id: existing.id }
        const result = await offlineSave(entityType, payload)
        return result
      } catch (err: any) {
        const msg = err.message
        if (mountedRef.current) setError(msg)
        throw err
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [entityType],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        await offlineDelete(entityType, id)
      } catch (err: any) {
        const msg = err.message
        if (mountedRef.current) setError(msg)
        throw err
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [entityType],
  )

  const bulkCreate = useCallback(
    async (docs: any[]): Promise<any[]> => {
      try {
        setLoading(true)
        setError(null)
        const results = await offlineBulkCreate(entityType, docs)
        return results
      } catch (err: any) {
        const msg = err.message
        if (mountedRef.current) setError(msg)
        throw err
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [entityType],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { create, update, remove, bulkCreate, loading, error }
}
