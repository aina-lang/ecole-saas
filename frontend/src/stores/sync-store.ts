import { create } from 'zustand'

interface EntitySyncStatus {
  lastSyncAt: string | null
  syncing: boolean
  count: number
}

interface SyncState {
  isOnline: boolean
  pendingCount: number
  conflictCount: number
  lastSyncAt: string | null
  isSyncing: boolean
  entityStatus: Record<string, EntitySyncStatus>
  error: string | null

  setOnline: (online: boolean) => void
  incrementPending: () => void
  decrementPending: () => void
  setPendingCount: (count: number) => void
  setConflicts: (count: number) => void
  setSyncing: (syncing: boolean) => void
  setLastSync: (timestamp: string) => void
  setEntityStatus: (entityType: string, status: Partial<EntitySyncStatus>) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialEntityStatus: Record<string, EntitySyncStatus> = {
  Student: { lastSyncAt: null, syncing: false, count: 0 },
  Grade: { lastSyncAt: null, syncing: false, count: 0 },
  Attendance: { lastSyncAt: null, syncing: false, count: 0 },
  Class: { lastSyncAt: null, syncing: false, count: 0 },
  Subject: { lastSyncAt: null, syncing: false, count: 0 },
  Teacher: { lastSyncAt: null, syncing: false, count: 0 },
  User: { lastSyncAt: null, syncing: false, count: 0 },
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  entityStatus: initialEntityStatus,
  error: null,

  setOnline: (online: boolean) => set({ isOnline: online }),

  incrementPending: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),

  decrementPending: () =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),

  setPendingCount: (count: number) => set({ pendingCount: count }),

  setConflicts: (count: number) => set({ conflictCount: count }),

  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  setLastSync: (timestamp: string) =>
    set({ lastSyncAt: timestamp, error: null }),

  setEntityStatus: (entityType: string, status: Partial<EntitySyncStatus>) =>
    set((state) => ({
      entityStatus: {
        ...state.entityStatus,
        [entityType]: { ...state.entityStatus[entityType], ...status },
      },
    })),

  setError: (error: string | null) => set({ error }),

  reset: () =>
    set({
      pendingCount: 0,
      conflictCount: 0,
      lastSyncAt: null,
      isSyncing: false,
      entityStatus: initialEntityStatus,
      error: null,
    }),
}))
