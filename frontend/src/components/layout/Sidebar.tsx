import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/stores/ui-store'
import { SidebarContent } from './SidebarContent'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const tenant = useUIStore((s) => s.tenant)

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
          'flex h-10 items-center px-4 text-xs text-muted-foreground',
          !sidebarOpen && 'justify-center px-0'
        )}
      >
        {sidebarOpen ? 'v1.0.0' : 'v1'}
      </div>
    </aside>
  )
}
