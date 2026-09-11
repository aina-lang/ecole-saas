import { useEffect } from 'react'
import { HashRouter, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SYNC_PULLED_EVENT } from '@/lib/db/sync-engine'
import { Toaster } from '../../components/ui/sonner'
import { AppRouter } from '../../router'
import { UNAUTHORIZED_EVENT } from '../../api/client'
import { useAuthStore } from '../../stores/auth-store'
import { initSyncEngine, destroySyncEngine } from '../../lib/db/sync-manager'
import { useSyncInvalidation } from '../../lib/db/hooks'
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

// Le moteur de sync PouchDB↔CouchDB ne doit tourner que quand l'app est
// déverrouillée : avant login/déverrouillage, il n'y a pas de tenant/token
// valides, et pendant un verrouillage (collègues sur poste partagé), on coupe
// la réplication comme le reste de l'accès aux données.
function SyncLifecycle(): null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useSyncInvalidation()

  useEffect(() => {
    if (!isAuthenticated) return
    initSyncEngine()
    return () => {
      destroySyncEngine()
    }
  }, [isAuthenticated])

  return null
}

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      {/* HashRouter et non BrowserRouter : en production la page est chargée
          en file:// (loadFile). Sous Windows, le chemin garde la lettre de
          lecteur (/C:/Program Files/…/index.html, puis /C:/dashboard après
          une redirection) : aucune route ne correspondait jamais, et l'app
          s'ouvrait sur une fenêtre vide. En développement le problème restait
          invisible, l'app étant servie par http://localhost. Avec le hash
          (#/dashboard), la route est indépendante du chemin du fichier. */}
      <HashRouter>
        <div className="flex h-screen flex-col overflow-hidden rounded-[14px] bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="flex-1 overflow-hidden">
            <AppRouter />
            <AuthListener />
            <HydrateAuth />
            <SyncLifecycle />
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
