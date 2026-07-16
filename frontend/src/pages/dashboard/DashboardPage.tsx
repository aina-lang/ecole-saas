import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { PersonIcon, ReaderIcon, BellIcon, StarIcon } from '@radix-ui/react-icons'
import { RefreshCw, PlusIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryEntities } from '@/lib/db/pouchdb-compat'

const quickActions = [
  { label: 'Inscrire un élève', path: '/students/new', variant: 'default' as const },
  { label: 'Nouvelle classe', path: '/classes/new', variant: 'default' as const },
  { label: 'Nouvel enseignant', path: '/teachers/new', variant: 'default' as const },
  { label: "Faire l'appel", path: '/attendance', variant: 'outline' as const },
  { label: 'Emploi du temps', path: '/timetable', variant: 'outline' as const },
  { label: 'Envoyer un message', path: '/communications', variant: 'outline' as const }
]

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data: counts, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: async () => {
      const [students, teachers, classes, attendances] = await Promise.all([
        queryEntities('Student'),
        queryEntities('Teacher'),
        queryEntities('Class'),
        queryEntities('Attendance'),
      ])
      const totalStudents = (students ?? []).length
      const totalTeachers = (teachers ?? []).length
      const totalClasses = (classes ?? []).length
      const attendancesList = attendances ?? []
      const totalDays = attendancesList.length
      const presentDays = attendancesList.filter((a: any) => a.status === 'present').length
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

      return { totalStudents, totalTeachers, totalClasses, attendanceRate }
    },
    staleTime: 30_000,
  })

  const stats = [
    {
      label: 'Total Élèves',
      value: isLoading ? '...' : String(counts?.totalStudents ?? 0),
      icon: PersonIcon,
      change: '—',
      variant: 'default' as const,
    },
    {
      label: 'Enseignants',
      value: isLoading ? '...' : String(counts?.totalTeachers ?? 0),
      icon: ReaderIcon,
      change: '—',
      variant: 'default' as const,
    },
    {
      label: 'Classes',
      value: isLoading ? '...' : String(counts?.totalClasses ?? 0),
      icon: BellIcon,
      change: '—',
      variant: 'default' as const,
    },
    {
      label: 'Taux de présence',
      value: isLoading ? '...' : `${counts?.attendanceRate ?? 0}%`,
      icon: StarIcon,
      change: '—',
      variant: 'default' as const,
    },
  ]

  const handleRefresh = () => refetch()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Bonjour, {user?.firstName || 'Utilisateur'}
          </h2>
          <p className="text-muted-foreground">Voici un aperçu de votre établissement aujourd'hui.</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Données synchronisées localement
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickActions.map((action) => (
              <Button key={action.label} variant={action.variant} asChild className="h-16">
                <Link to={action.path} className="flex items-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
