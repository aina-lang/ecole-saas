import { NavLink } from 'react-router-dom'
import {
  PersonIcon,
  ReaderIcon,
  RocketIcon,
  ChatBubbleIcon,
  ValueNoneIcon,
  GearIcon,
  UpdateIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/stores/ui-store'

const menuItems = [
  { label: 'Tableau de bord', path: '/dashboard', icon: HomeDashboardIcon },
  { label: 'Élèves', path: '/students', icon: PersonIcon },
  { label: 'Classes', path: '/classes', icon: ReaderIcon },
  { label: 'Notes', path: '/grades', icon: RocketIcon },
  { label: 'Présences', path: '/attendance', icon: AttendanceIcon },
  { label: 'Communications', path: '/communications', icon: ChatBubbleIcon },
  { label: 'Finances', path: '/finances', icon: ValueNoneIcon },
  { label: 'Administration', path: '/administration', icon: GearIcon },
  { label: 'Synchronisation', path: '/sync', icon: UpdateIcon }
]

function HomeDashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1 6.5V14H5V9H10V14H14V6.5L7.5 1L1 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AttendanceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.5 10.5L6.5 13.5L12 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 7.5L3.5 10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 2.5L12 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const tenant = useUIStore((s) => s.tenant)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-background transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-0 -translate-x-full lg:w-16 lg:translate-x-0'
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
            {tenant.name ? tenant.name.charAt(0) : 'E'}
          </div>
        )}
        <span
          className={cn(
            'truncate text-sm font-semibold transition-opacity',
            !sidebarOpen && 'lg:hidden'
          )}
        >
          {tenant.name || 'École SaaS'}
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn('truncate transition-opacity', !sidebarOpen && 'lg:hidden')}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      <Separator />
      <div
        className={cn(
          'flex h-10 items-center px-4 text-xs text-muted-foreground',
          !sidebarOpen && 'lg:hidden'
        )}
      >
        v1.0.0
      </div>
    </aside>
  )
}
