import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SYNC_PULLED_EVENT } from '@/lib/db/sync-engine'
import { Toaster } from '@/components/ui/sonner'
import { AppRouter } from '@/router'
import { useSyncInvalidation } from '@/lib/db/hooks'
import { useEffect } from 'react'
import { initSyncEngine, destroySyncEngine } from '@/lib/db/sync-manager'
import { SyncDebugPanel } from '@/components/debug/SyncDebugPanel'
import { destroyAllDatabases } from '@/lib/db/pouchdb'
import '@/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

// Données reçues du serveur (mobile, autres postes) : on rafraîchit toutes
// les requêtes affichées — regroupé pour ne pas relancer 25 fois d'affilée.
let invalidateTimer: ReturnType<typeof setTimeout> | null = null
if (typeof window !== 'undefined') {
  window.addEventListener(SYNC_PULLED_EVENT, () => {
    if (invalidateTimer) clearTimeout(invalidateTimer)
    invalidateTimer = setTimeout(() => {
      invalidateTimer = null
      queryClient.invalidateQueries()
    }, 300)
  })
}

function AppInner() {
  useSyncInvalidation()

  useEffect(() => {
    initSyncEngine()

    return () => {
      destroySyncEngine()
    }
  }, [])

  return (
    <BrowserRouter>
      <AppRouter />
      <Toaster position="top-right" richColors />
      <SyncDebugPanel />
    </BrowserRouter>
  )
}

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}

export default App

if (typeof window !== 'undefined') {
  ;(window as any).resetLocalDatabases = async () => {
    try {
      await destroyAllDatabases()
      return { success: true }
    } catch (error) {
      console.error('Failed to reset local databases:', error)
      return { success: false, error: (error as Error).message }
    }
  }
}
