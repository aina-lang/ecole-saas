import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { PersonIcon, ReaderIcon, BellIcon, StarIcon, CheckCircledIcon, TimerIcon, ExclamationTriangleIcon, BarChartIcon } from '@radix-ui/react-icons'
import { RefreshCw, PlusIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Payment, Student } from '@/types'

const quickActions = [
  { label: 'Inscrire un élève', path: '/students/new', variant: 'default' as const },
  { label: 'Nouvelle classe', path: '/classes/new', variant: 'default' as const },
  { label: 'Nouvel enseignant', path: '/teachers/new', variant: 'default' as const },
  { label: "Faire l'appel", path: '/attendance', variant: 'outline' as const },
  { label: 'Emploi du temps', path: '/timetable', variant: 'outline' as const },
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

  const { data: finance, isLoading: loadingFinance } = useQuery({
    queryKey: ['dashboard-finance'],
    queryFn: async () => {
      const [payments, recentPaymentsRaw, students] = await Promise.all([
        queryEntities<Payment>('Payment'),
        queryEntities<Payment>('Payment', { sortBy: 'dueDate', sortDirection: 'desc', limit: 3 }),
        queryEntities<Student>('Student'),
      ])

      const totalCollected = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.paidAmount || 0), 0)
      const totalPending = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      const totalOverdue = payments
        .filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + (p.amount || 0), 0)

      const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
      const monthlyCollectionMap: Record<string, number> = {}
      payments.filter(p => p.status === 'paid').forEach(p => {
        const d = new Date(p.dueDate)
        const key = monthLabels[d.getMonth()]
        monthlyCollectionMap[key] = (monthlyCollectionMap[key] || 0) + (p.paidAmount || 0)
      })
      const monthlyCollection = Object.entries(monthlyCollectionMap).map(([month, amount]) => ({ month, amount }))

      const recentPayments = recentPaymentsRaw.map(p => ({
        ...p,
        student: students.find(s => s.id === p.studentId)
      }))
      const overduePayments = payments
        .filter(p => p.status === 'overdue')
        .map(p => ({
          ...p,
          student: students.find(s => s.id === p.studentId)
        }))

      return { totalCollected, totalPending, totalOverdue, monthlyCollection, recentPayments, overduePayments }
    },
    staleTime: 30_000,
  })

  const stats = [
    {
      label: 'Total Élèves',
      value: isLoading ? '...' : String(counts?.totalStudents ?? 0),
      icon: PersonIcon,
      variant: 'default' as const,
    },
    {
      label: 'Enseignants',
      value: isLoading ? '...' : String(counts?.totalTeachers ?? 0),
      icon: ReaderIcon,
      variant: 'default' as const,
    },
    {
      label: 'Classes',
      value: isLoading ? '...' : String(counts?.totalClasses ?? 0),
      icon: BellIcon,
      variant: 'default' as const,
    },
    {
      label: 'Taux de présence',
      value: isLoading ? '...' : `${counts?.attendanceRate ?? 0}%`,
      icon: StarIcon,
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
          <p className="text-muted-foreground">Voici un aperçu de votre établissement.</p>
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

      {/* Stats */}
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
              <p className="mt-1 text-xs text-muted-foreground">Données synchronisées localement</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Finance KPIs */}
      {!loadingFinance && finance && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Collecté</CardTitle>
                <CheckCircledIcon className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {finance.totalCollected.toLocaleString('fr-FR')} Ar
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Total des paiements reçus</p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
                <TimerIcon className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {finance.totalPending.toLocaleString('fr-FR')} Ar
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Paiements en attente</p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">En retard</CardTitle>
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {finance.totalOverdue.toLocaleString('fr-FR')} Ar
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Paiements en retard</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5" />
                  Collecte mensuelle
                </CardTitle>
              </CardHeader>
              <CardContent>
                {finance.monthlyCollection.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée pour le moment</p>
                ) : (
                  <div className="space-y-3">
                    {finance.monthlyCollection.map((item) => {
                      const maxAmount = Math.max(...finance.monthlyCollection.map((m) => m.amount), 1)
                      const percentage = (item.amount / maxAmount) * 100
                      return (
                        <div key={item.month} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.month}</span>
                            <span className="text-muted-foreground">
                              {item.amount.toLocaleString('fr-FR')} Ar
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Paiements récents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finance.recentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Aucun paiement récent
                        </TableCell>
                      </TableRow>
                    ) : (
                      finance.recentPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                             {p.student ? `${p.student.firstName ? `${p.student.firstName} ` : ''}${p.student.lastName}` : p.studentId}
                          </TableCell>
                          <TableCell>{p.paidAmount.toLocaleString('fr-FR')} Ar</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(p.dueDate), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {finance.overduePayments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  Paiements en retard
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {finance.overduePayments.map((p) => (
                  <Alert key={p.id} variant="destructive">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <AlertTitle>
                       {p.student ? `${p.student.firstName ? `${p.student.firstName} ` : ''}${p.student.lastName}` : p.studentId}
                    </AlertTitle>
                    <AlertDescription>
                      {p.amount.toLocaleString('fr-FR')} Ar - Échu le{' '}
                      {format(new Date(p.dueDate), 'dd/MM/yyyy', { locale: fr })}
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

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
