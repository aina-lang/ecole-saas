import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  BarChartIcon,
  ExclamationTriangleIcon,
  PersonIcon,
  TimerIcon,
  CheckCircledIcon
} from '@radix-ui/react-icons'
import client from '@/api/client'
import type { ApiResponse, Payment, Student } from '@/types'

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

function fetchDashboard(): Promise<ApiResponse<DashboardData>> {
  return client.get('/finances/dashboard').then((r) => r.data)
}

export function FinanceDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: fetchDashboard
  })

  const dashboard = data?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  const { summary, recentPayments, overduePayments } = dashboard

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tableau de bord financier</h2>
        <p className="text-muted-foreground">Aperçu des finances de l'établissement.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collecté ce mois
            </CardTitle>
            <CheckCircledIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.totalCollected.toLocaleString('fr-FR')} XAF
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
              {summary.totalPending.toLocaleString('fr-FR')} XAF
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
              {summary.totalOverdue.toLocaleString('fr-FR')} XAF
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
              <p className="text-sm text-muted-foreground">Aucune donnée pour le moment</p>
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
                          {item.amount.toLocaleString('fr-FR')} XAF
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
                        {p.student ? `${p.student.firstName} ${p.student.lastName}` : p.studentId}
                      </TableCell>
                      <TableCell>{p.paidAmount.toLocaleString('fr-FR')} XAF</TableCell>
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

      {/* Overdue payments alert */}
      {overduePayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-600">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Paiements en retard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overduePayments.map((p) => (
              <Alert key={p.id} variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertTitle>
                  {p.student ? `${p.student.firstName} ${p.student.lastName}` : p.studentId}
                </AlertTitle>
                <AlertDescription>
                  {p.amount.toLocaleString('fr-FR')} XAF - Échu le{' '}
                  {format(new Date(p.dueDate), 'dd/MM/yyyy', { locale: fr })}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
