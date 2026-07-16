import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { SidebarContent } from './SidebarContent'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const tenant = useUIStore((s) => s.tenant)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const userInitials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?'

  return (
    <aside
      className={cn(
        'relative hidden flex-col border-r bg-background transition-all duration-300 lg:flex rounded-l-[14px]',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded shrink-0" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold shrink-0">
              {tenant.name ? tenant.name.charAt(0) : 'E'}
            </div>
          )}
          {sidebarOpen && (
            <span className="truncate text-sm font-semibold animate-in fade-in duration-300">
              {tenant.name || 'École SaaS'}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 transition-transform duration-300',
            !sidebarOpen && 'mx-auto'
          )}
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <SidebarContent />

      <Separator />
      <div
        className={cn(
          'border-t',
          sidebarOpen ? 'p-3' : 'py-3'
        )}
      >
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">
                {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
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
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
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