import { create } from 'zustand'

interface SyncState {
  isOnline: boolean
  pendingCount: number
  conflictCount: number
  lastSyncAt: string | null
  isSyncing: boolean
  setOnline: (online: boolean) => void
  incrementPending: () => void
  decrementPending: () => void
  setConflicts: (count: number) => void
  setSyncing: (syncing: boolean) => void
  setLastSync: (timestamp: string) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncAt: null,
  isSyncing: false,

  setOnline: (online: boolean) => set({ isOnline: online }),

  incrementPending: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),

  decrementPending: () =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1)
    })),

  setConflicts: (count: number) => set({ conflictCount: count }),

  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  setLastSync: (timestamp: string) => set({ lastSyncAt: timestamp })
}))
