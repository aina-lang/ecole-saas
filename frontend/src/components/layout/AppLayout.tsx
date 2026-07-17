import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TitleBar } from './TitleBar'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

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
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const location = useLocation()

  const basePath = '/' + location.pathname.split('/')[1]
  const title = routeTitles[basePath] || 'École SaaS'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Topbar title={title} />

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
