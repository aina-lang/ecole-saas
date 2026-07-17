import { useEffect } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '../../components/ui/sonner'
import { AppRouter } from '../../router'
import { TitleBar } from '../../components/layout/TitleBar'
import { UNAUTHORIZED_EVENT } from '../../api/client'
import { useAuthStore } from '../../stores/auth-store'
import './global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000
    }
  }
})

function AuthListener(): null {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [navigate])

  return null
}

function HydrateAuth(): null {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return null
}

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen flex-col overflow-hidden rounded-[14px] bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <TitleBar />
          <div className="flex-1 overflow-hidden">
            <AppRouter />
            <AuthListener />
            <HydrateAuth />
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
