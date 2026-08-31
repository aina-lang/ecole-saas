import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, isOffline } from './api'
import { queryClient } from './query'

// File d'attente hors ligne : un appel ou une saisie de notes faits sans
// réseau sont mémorisés puis rejoués dès que le serveur répond. Les données
// servent à l'école même si le professeur n'a pas de connexion en classe.

export interface OutboxItem {
  id: string
  kind: 'attendance' | 'grades'
  label: string
  method: 'post'
  url: string
  body: unknown
  createdAt: string
  invalidate: string[][]
  attempts: number
  lastError?: string
}

const KEY = 'ecoleprof.outbox'

interface OutboxState {
  items: OutboxItem[]
  flushing: boolean
  load: () => Promise<void>
  enqueue: (item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>) => Promise<void>
  flush: () => Promise<{ sent: number; failed: number }>
  remove: (id: string) => Promise<void>
}

async function persist(items: OutboxItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items))
}

export const useOutbox = create<OutboxState>((set, get) => ({
  items: [],
  flushing: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY)
      set({ items: raw ? JSON.parse(raw) : [] })
    } catch { set({ items: [] }) }
  },

  enqueue: async (item) => {
    const next: OutboxItem = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), attempts: 0 }
    const items = [...get().items, next]
    set({ items })
    await persist(items)
  },

  remove: async (id) => {
    const items = get().items.filter((i) => i.id !== id)
    set({ items })
    await persist(items)
  },

  flush: async () => {
    if (get().flushing) return { sent: 0, failed: 0 }
    set({ flushing: true })
    let sent = 0, failed = 0
    try {
      for (const item of [...get().items]) {
        try {
          await api.post(item.url, item.body)
          sent++
          const items = get().items.filter((i) => i.id !== item.id)
          set({ items }); await persist(items)
          for (const key of item.invalidate) queryClient.invalidateQueries({ queryKey: key })
        } catch (err) {
          if (isOffline(err)) break // toujours hors ligne : on réessaiera
          failed++
          const items = get().items.map((i) => i.id === item.id ? { ...i, attempts: i.attempts + 1, lastError: (err as any)?.response?.data?.message ?? 'Refusé par le serveur' } : i)
          set({ items }); await persist(items)
        }
      }
    } finally {
      set({ flushing: false })
    }
    return { sent, failed }
  },
}))

/** Envoie tout de suite si possible, sinon met en file. Retourne true si envoyé. */
export async function sendOrQueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>): Promise<boolean> {
  try {
    await api.post(item.url, item.body)
    for (const key of item.invalidate) queryClient.invalidateQueries({ queryKey: key })
    return true
  } catch (err) {
    if (isOffline(err)) {
      await useOutbox.getState().enqueue(item)
      return false
    }
    throw err
  }
}
