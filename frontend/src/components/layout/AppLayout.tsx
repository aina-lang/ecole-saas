import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TitleBar } from './TitleBar'
import { SubscriptionBanner } from './SubscriptionBanner'
import { UpdateBanner } from './UpdateBanner'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/students': 'Élèves',
  '/teachers': 'Enseignants',
  '/classes': 'Classes',
  '/grades': 'Notes',
  '/attendance': 'Présences',
  '/communications': 'Communications',
  '/finances': 'Finances',
  '/administration': 'Paramètres',
  '/sync': 'Synchronisation'
}

export function AppLayout() {
  const location = useLocation()

  const basePath = '/' + location.pathname.split('/')[1]
  const title = routeTitles[basePath] || 'Sekoliko'

  // La barre latérale occupe toute la hauteur de la fenêtre ; la barre de
  // titre (zone de déplacement + contrôles) ne couvre que la colonne de
  // contenu. Les pages publiques (login, onboarding…) gardent leur propre
  // barre de titre via PublicLayout (router).
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TitleBar />
        <Topbar title={title} />
        <SubscriptionBanner />
        <UpdateBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
