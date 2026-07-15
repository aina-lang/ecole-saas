import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AppRouter } from '@/router'
import { useSyncInvalidation } from '@/lib/db/hooks'
import { useEffect } from 'react'
import { initSyncEngine, destroySyncEngine } from '@/lib/db/sync-manager'
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
