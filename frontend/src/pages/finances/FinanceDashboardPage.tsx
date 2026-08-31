import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader, EmptyState } from '@/components/layout/page'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  BarChartIcon,
  ExclamationTriangleIcon,
  PersonIcon,
  TimerIcon,
  CheckCircledIcon
} from '@radix-ui/react-icons'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import type { Payment, Student } from '@/types'

interface FinanceSummary {
  totalCollected: number
  totalPending: number
  totalOverdue: number
  studentCount: number
  monthlyCollection: { month: string; amount: number }[]
}

interface DashboardData {
  summary: FinanceSummary
  recentPayments: (Payment & { student?: Student })[]
  overduePayments: (Payment & { student?: Student })[]
}

async function fetchDashboard(): Promise<DashboardData> {
  const [payments, students] = await Promise.all([
    queryEntities<Payment>('Payment'),
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

  const sortedPayments = [...payments].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''))
  const recentPayments = sortedPayments.slice(0, 10).map(p => ({
    ...p,
    student: students.find(s => s.id === p.studentId)
  }))
  const overduePayments = payments
    .filter(p => p.status === 'overdue')
    .map(p => ({
      ...p,
      student: students.find(s => s.id === p.studentId)
    }))

  return {
    summary: {
      totalCollected,
      totalPending,
      totalOverdue,
      studentCount: students.length,
      monthlyCollection
    },
    recentPayments,
    overduePayments
  }
}

export function FinanceDashboardPage() {
  const navigate = useNavigate()
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: fetchDashboard
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord financier" description="Aperçu des finances de l'établissement." />
        <EmptyState title="Aucune donnée disponible" />
      </div>
    )
  }

  const { summary, recentPayments, overduePayments } = dashboard

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord financier" description="Aperçu des finances de l'établissement." />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collecté ce mois
            </CardTitle>
            <CheckCircledIcon className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {summary.totalCollected.toLocaleString('fr-FR')} Ar
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total des paiements reçus</p>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            <TimerIcon className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {summary.totalPending.toLocaleString('fr-FR')} Ar
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
              {summary.totalOverdue.toLocaleString('fr-FR')} Ar
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Paiements en retard</p>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Élèves</CardTitle>
            <PersonIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.studentCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Élèves avec paiements</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly collection chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChartIcon className="h-5 w-5" />
              Collecte mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.monthlyCollection.length === 0 ? (
              <EmptyState title="Aucune donnée pour le moment" description="Les paiements encaissés apparaîtront ici mois par mois." />
            ) : (
              <div className="space-y-3">
                {summary.monthlyCollection.map((item) => {
                  const maxAmount = Math.max(...summary.monthlyCollection.map((m) => m.amount), 1)
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

        {/* Recent payments */}
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
                {recentPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Aucun paiement récent
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayments.map((p) => (
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

      {/* Retards : résumé + les plus anciens seulement, le reste dans la liste filtrée */}
      {overduePayments.length > 0 && (() => {
        const sorted = [...overduePayments].sort((x, y) => new Date(x.dueDate).getTime() - new Date(y.dueDate).getTime() || (y.amount - (y.paidAmount || 0)) - (x.amount - (x.paidAmount || 0)))
        const totalDue = overduePayments.reduce((n, p) => n + (p.amount - (p.paidAmount || 0)), 0)
        const shown = sorted.slice(0, 8)
        const name = (p: typeof shown[number]) => p.student ? `${p.student.firstName ? `${p.student.firstName} ` : ''}${p.student.lastName}` : p.studentId
        const daysLate = (d: string | Date) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000))
        return (
          <Card className="border-red-200 dark:border-red-900/60">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-400">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  Paiements en retard
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">{overduePayments.length}</span>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{totalDue.toLocaleString('fr-FR')} Ar restant dus · les {shown.length} plus anciens ci-dessous</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/finances/payments?status=overdue')}>
                Voir tous les retards ({overduePayments.length})
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Retard</TableHead>
                    <TableHead className="text-right">Reste dû</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(p.student ? `/students/${p.student.id}` : '/finances/payments?status=overdue')}>
                      <TableCell className="font-medium">{name(p)}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(p.dueDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">{daysLate(p.dueDate)} j</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{(p.amount - (p.paidAmount || 0)).toLocaleString('fr-FR')} Ar</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
