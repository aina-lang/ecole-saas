import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { SidebarContent } from './SidebarContent'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getTenantSetting } from '@/lib/tenant-settings'

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const tenant = useUIStore((s) => s.tenant)
  const user = useAuthStore((s) => s.user)
  const tenantId = useAuthStore((s) => s.tenantId)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const { data: schoolData } = useQuery({
    // Clé dépendante du tenant : sinon, après un changement de compte sans
    // relance de l'app, React Query resservait le nom/logo de l'école précédente.
    queryKey: ['settings-school', tenantId],
    queryFn: async () => {
      const raw = await getTenantSetting('school')
      return raw ? JSON.parse(raw) as { schoolName?: string; primaryColor?: string; logoUrl?: string } : null
    },
  })

  const schoolName = schoolData?.schoolName || tenant.name || 'Sekoliko'
  const logoUrl = schoolData?.logoUrl || tenant.logoUrl || ''
  const initials = schoolName.charAt(0).toUpperCase()

  const userInitials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?'

  return (
    <aside
      className={cn(
        'relative z-10 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:flex rounded-l-[14px]',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      <div
        className={cn('flex h-14 items-center gap-2 border-b border-sidebar-border', sidebarOpen ? 'px-4' : 'justify-center px-2')}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={schoolName} className="h-8 w-8 shrink-0 rounded bg-white object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            {initials || 'E'}
          </div>
        )}
        {sidebarOpen && (
          <span className="truncate text-sm font-semibold animate-in fade-in duration-300">
            {schoolName}
          </span>
        )}
      </div>

      {/* Bouton replier/déplier posé à cheval sur le bord droit : il ne se
          dispute plus la place avec le logo quand la barre est repliée. */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Replier le menu' : 'Déplier le menu'}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="absolute -right-3 top-[18px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      <SidebarContent />

      <Separator />
      <div
        className={cn(
          'border-t border-sidebar-border',
          sidebarOpen ? 'p-3' : 'py-3'
        )}
      >
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-foreground/15 text-xs font-medium text-sidebar-foreground">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
               <p className="truncate text-sm font-medium">
                 {user ? `${user.firstName ? `${user.firstName} ` : ''}${user.lastName}` : 'Utilisateur'}
               </p>
              <p className="truncate text-xs text-sidebar-muted">
                {user?.role === 'ADMIN' ? 'Administrateur' : user?.role === 'TEACHER' ? 'Enseignant' : 'Utilisateur'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <TooltipProvider>
            <div className="flex justify-center">
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Se déconnecter"
                    onClick={() => setLogoutOpen(true)}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>Se déconnecter</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => {
          logout()
          setLogoutOpen(false)
          navigate('/login')
        }}
        title="Déconnexion"
        description="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmLabel="Déconnexion"
      />
    </aside>
  )
}