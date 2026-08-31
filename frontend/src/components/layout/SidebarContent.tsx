import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import { useUIStore } from '@/stores/ui-store'
import {
  LayoutDashboard, UserRound, Users, School, Layers, Presentation, Milestone,
  ClipboardList, ClipboardCheck, BookOpen, CalendarDays, Wallet, Receipt,
  UserCog, Settings, KeyRound, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const menuGroups = [
  {
    label: 'Accueil',
    items: [
      { label: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: 'École',
    items: [
      { label: 'Élèves', path: '/students', icon: UserRound, badgeKey: 'students' },
      { label: 'Parents', path: '/parents', icon: Users, badgeKey: 'parents' },
      { label: 'Classes', path: '/classes', icon: School, badgeKey: 'classes' },
      { label: 'Niveaux', path: '/administration/levels', icon: Layers },
      { label: 'Enseignants', path: '/teachers', icon: Presentation, badgeKey: 'teachers' },
      { label: 'Promotions', path: '/administration/promotion/deliberation', icon: Milestone },
     // { label: 'Messagerie', path: '/communications', icon: Users },
    ]
  },
  {
    label: 'Pédagogie',
    items: [
      { label: 'Notes', path: '/grades', icon: ClipboardList },
      { label: 'Présences', path: '/attendance', icon: ClipboardCheck },
      { label: 'Matières', path: '/subjects', icon: BookOpen },
      { label: 'Emploi du temps', path: '/timetable', icon: CalendarDays },
    ]
  },
  {
    label: 'Finance',
    items: [
 //     { label: 'Vue d\'ensemble', path: '/finances', icon: LayoutDashboard },
      { label: 'Paiements', path: '/finances/payments', icon: Wallet },
      { label: 'Frais par niveau', path: '/finances/fees', icon: Receipt },
    ]
  },
  {
    label: 'Paramètres',
    items: [
      { label: 'Utilisateurs', path: '/administration/users', icon: UserCog },
      { label: 'Configuration', path: '/administration/settings', icon: Settings },
    //  { label: 'Journaux d\'audit', path: '/administration/audit', icon: ClipboardList },
      { label: 'Licence', path: '/administration/license', icon: KeyRound },
      { label: 'Synchronisation', path: '/sync', icon: RefreshCw },
    ]
  },
]




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
    <TooltipProvider>
    <ScrollArea className="flex-1 px-3 py-2">
      <nav className="flex flex-col gap-4">
        {menuGroups.map((group, groupIndex) => (
          <div key={group.label} className="flex flex-col gap-1">
            {sidebarOpen && (
              <p className="px-3 text-[10.5px] font-semibold text-sidebar-muted uppercase tracking-[0.12em]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const count = badgeCount(item.badgeKey)
              const collapsed = !sidebarOpen && !forceShowLabels
              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-foreground/10 text-sidebar-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground',
                      !sidebarOpen && !forceShowLabels && 'lg:justify-center lg:px-0'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && sidebarOpen && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent" />
                      )}
                      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                      {sidebarOpen && (
                        <span className="flex-1 truncate transition-opacity">
                          {item.label}
                        </span>
                      )}
                      {sidebarOpen && count !== undefined && count > 0 && (
                        <Badge variant="secondary" className="h-5 border-0 bg-sidebar-foreground/10 px-1.5 text-[10px] font-medium text-sidebar-foreground">
                          {count}
                        </Badge>
                      )}
                    </>
                  )}
                </NavLink>
              )
              if (!collapsed) return link
              return (
                <Tooltip key={item.path} delayDuration={150}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className="flex items-center gap-2">
                    {item.label}
                    {count !== undefined && count > 0 && (
                      <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{count}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            })}
            {groupIndex < menuGroups.length - 1 && (
              <Separator className={cn('mt-1 bg-sidebar-border', !sidebarOpen && 'lg:hidden')} />
            )}
          </div>
        ))}
      </nav>
    </ScrollArea>
    </TooltipProvider>
  )
}