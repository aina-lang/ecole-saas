import { NavLink } from 'react-router-dom'
import {
  PersonIcon,
  ReaderIcon,
  ChatBubbleIcon,
  ValueNoneIcon,
  GearIcon,
  UpdateIcon,
  BookmarkIcon,
  CalendarIcon,
  FileTextIcon,
  BackpackIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/stores/ui-store'

const menuItems = [
  { label: 'Tableau de bord', path: '/dashboard', icon: HomeDashboardIcon },
  { label: 'Élèves', path: '/students', icon: PersonIcon },
  { label: 'Enseignants', path: '/teachers', icon: BackpackIcon },
  { label: 'Classes', path: '/classes', icon: ReaderIcon },
  { label: 'Notes', path: '/grades', icon: FileTextIcon },
  { label: 'Présences', path: '/attendance', icon: AttendanceIcon },
  { label: 'Matières', path: '/subjects', icon: BookmarkIcon },
  { label: 'Emploi du temps', path: '/timetable', icon: CalendarIcon },
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

interface SidebarContentProps {
  onItemClick?: () => void
  forceShowLabels?: boolean
}

export function SidebarContent({ onItemClick, forceShowLabels }: SidebarContentProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <ScrollArea className="flex-1 px-3 py-2">
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className={cn('truncate transition-opacity', !sidebarOpen && !forceShowLabels && 'lg:hidden')}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </ScrollArea>
  )
}
