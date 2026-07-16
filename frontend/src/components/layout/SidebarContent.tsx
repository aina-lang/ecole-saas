import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import { useUIStore } from '@/stores/ui-store'
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
  BackpackIcon,
  GroupIcon,
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const menuGroups = [
  {
    label: 'Accueil',
    items: [
      { label: 'Tableau de bord', path: '/dashboard', icon: HomeDashboardIcon },
    ]
  },
  {
    label: 'École',
    items: [
      { label: 'Élèves', path: '/students', icon: PersonIcon, badgeKey: 'students' },
      { label: 'Parents', path: '/parents', icon: GroupIcon, badgeKey: 'parents' },
      { label: 'Classes', path: '/classes', icon: ReaderIcon, badgeKey: 'classes' },
      { label: 'Enseignants', path: '/teachers', icon: BackpackIcon, badgeKey: 'teachers' },
    ]
  },
  {
    label: 'Pédagogie',
    items: [
      { label: 'Notes', path: '/grades', icon: FileTextIcon },
      { label: 'Présences', path: '/attendance', icon: AttendanceIcon },
      { label: 'Matières', path: '/subjects', icon: BookmarkIcon },
      { label: 'Emploi du temps', path: '/timetable', icon: CalendarIcon },
    ]
  },
  {
    label: 'Vie scolaire',
    items: [
      { label: 'Communications', path: '/communications', icon: ChatBubbleIcon, badgeKey: 'messages' },
      { label: 'Finances', path: '/finances', icon: ValueNoneIcon },
    ]
  },
  {
    label: 'Paramètres',
    items: [
      { label: 'Utilisateurs', path: '/administration/users', icon: GearIcon },
      { label: 'Configuration', path: '/administration/settings', icon: GearIcon },
      { label: 'Journaux d\'audit', path: '/administration/audit', icon: UpdateIcon },
      { label: 'Synchronisation', path: '/sync', icon: UpdateIcon },
    ]
  },
]

function HomeDashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <path d="M1 6.5V14H5V9H10V14H14V6.5L7.5 1L1 6.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AttendanceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <path d="M3.5 10.5L6.5 13.5L12 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 7.5L3.5 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 2.5L12 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SidebarContent({ onItemClick, forceShowLabels }: { onItemClick?: () => void; forceShowLabels?: boolean }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  const { data: counts } = useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: async () => {
      const [students, teachers, classes, messages, parents] = await Promise.all([
        queryEntities<any>('Student'),
        queryEntities<any>('Teacher'),
        queryEntities<any>('Class'),
        queryEntities<any>('Message'),
        queryEntities<any>('User'),
      ])
      return {
        students: (students ?? []).length,
        teachers: (teachers ?? []).length,
        classes: (classes ?? []).length,
        messages: (messages ?? []).filter((m: any) => m.status === 'unread' || m.status === 'pending').length,
        parents: (parents ?? []).filter((u: any) => u.role === 'PARENT').length,
      }
    },
    staleTime: 30_000,
  })

  const badgeCount = (key?: string) => {
    if (!key || !counts) return undefined
    switch (key) {
      case 'students': return counts.students
      case 'teachers': return counts.teachers
      case 'classes': return counts.classes
      case 'messages': return counts.messages || undefined
      case 'parents': return counts.parents || undefined
      default: return undefined
    }
  }

  return (
    <ScrollArea className="flex-1 px-3 py-2">
      <nav className="flex flex-col gap-4">
        {menuGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {sidebarOpen && (
              <p className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const count = badgeCount(item.badgeKey)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                      !sidebarOpen && !forceShowLabels && 'lg:justify-center lg:px-0'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && sidebarOpen && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {sidebarOpen && (
                        <span className="flex-1 truncate transition-opacity">
                          {item.label}
                        </span>
                      )}
                      {sidebarOpen && count !== undefined && count > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                          {count}
                        </Badge>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
            <Separator className={cn('mt-1', !sidebarOpen && 'lg:hidden')} />
          </div>
        ))}
      </nav>
    </ScrollArea>
  )
}