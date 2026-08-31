import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import {
  RefreshCw, UserPlus, Users, GraduationCap, School, ClipboardCheck, Wallet, Clock, AlertTriangle,
  CalendarDays, ArrowRight, BookOpen, TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Payment, Student } from '@/types'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const quickActions = [
  { label: 'Inscrire un élève', path: '/students/new', icon: UserPlus },
  { label: 'Nouvelle classe', path: '/classes/new', icon: School },
  { label: 'Nouvel enseignant', path: '/teachers/new', icon: GraduationCap },
  { label: "Faire l'appel", path: '/attendance', icon: ClipboardCheck },
  { label: 'Emploi du temps', path: '/timetable', icon: CalendarDays },
  { label: 'Saisir des notes', path: '/grades/entry', icon: BookOpen },
]

const ar = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Ar`
const studentName = (s?: Student | null, fallback = '') =>
  s ? `${s.firstName ? `${s.firstName} ` : ''}${s.lastName}` : fallback
const initials = (s?: Student | null) =>
  s ? `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase() || '?' : '?'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data: counts, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: async () => {
      const [students, teachers, classes, attendances] = await Promise.all([
        queryEntities<any>('Student'),
        queryEntities<any>('Teacher'),
        queryEntities<any>('Class'),
        queryEntities<any>('Attendance'),
      ])
      const studentList = (students ?? []).filter((s: any) => !s.deletedAt)
      const classList = (classes ?? []).filter((c: any) => !c.deletedAt)
      const attendanceList = attendances ?? []
      const isPresent = (a: any) => String(a.status ?? '').toLowerCase() === 'present'
      const presentDays = attendanceList.filter(isPresent).length
      const attendanceRate = attendanceList.length > 0 ? Math.round((presentDays / attendanceList.length) * 100) : null

      const today = new Date().toISOString().slice(0, 10)
      const todayList = attendanceList.filter((a: any) => String(a.date ?? '').slice(0, 10) === today)
      const todayPresent = todayList.filter(isPresent).length
      const todayRate = todayList.length > 0 ? Math.round((todayPresent / todayList.length) * 100) : null

      const capacity = classList.reduce((sum: number, c: any) => sum + (Number(c.capacity) || 0), 0)
      const countByClass = new Map<string, number>()
      for (const s of studentList) {
        const cid = s.classId ?? s.class?.id
        if (cid) countByClass.set(cid, (countByClass.get(cid) ?? 0) + 1)
      }
      const classFill = classList
        .map((c: any) => ({ id: c.id, name: c.name as string, level: c.level as string | undefined, count: countByClass.get(c.id) ?? 0, capacity: Number(c.capacity) || 0 }))
        .sort((a, b) => b.count - a.count)

      const sevenDaysAgo = Date.now() - 7 * 86_400_000
      const newThisWeek = studentList.filter((s: any) => s.createdAt && new Date(s.createdAt).getTime() >= sevenDaysAgo).length
      const girls = studentList.filter((s: any) => s.gender === 'F').length

      return {
        totalStudents: studentList.length,
        totalTeachers: (teachers ?? []).filter((t: any) => !t.deletedAt).length,
        totalClasses: classList.length,
        capacity,
        attendanceRate,
        todayRate,
        todayCount: todayList.length,
        classFill,
        newThisWeek,
        girls,
      }
    },
    staleTime: 30_000,
  })

  const { data: finance, isLoading: loadingFinance } = useQuery({
    queryKey: ['dashboard-finance'],
    queryFn: async () => {
      const [payments, recentPaymentsRaw, students] = await Promise.all([
        queryEntities<Payment>('Payment'),
        queryEntities<Payment>('Payment', { sortBy: 'dueDate', sortDirection: 'desc', limit: 5 }),
        queryEntities<Student>('Student'),
      ])
      const byStatus = (st: string) => payments.filter((p) => p.status === st)
      const totalCollected = byStatus('paid').reduce((sum, p) => sum + (p.paidAmount || 0), 0)
      const totalPending = byStatus('pending').reduce((sum, p) => sum + (p.amount || 0), 0)
      const totalOverdue = byStatus('overdue').reduce((sum, p) => sum + (p.amount || 0), 0)
      const expected = totalCollected + totalPending + totalOverdue
      const recoveryRate = expected > 0 ? Math.round((totalCollected / expected) * 100) : null

      const monthly = new Array(12).fill(0) as number[]
      byStatus('paid').forEach((p) => {
        const d = new Date(p.dueDate)
        if (!Number.isNaN(d.getTime())) monthly[d.getMonth()] += p.paidAmount || 0
      })
      // Année scolaire malgache : de septembre à août.
      const order = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7]
      const monthlyCollection = order.map((m) => ({ month: MONTHS[m], amount: monthly[m] }))

      const withStudent = (p: Payment) => ({ ...p, student: students.find((s) => s.id === p.studentId) })
      return {
        totalCollected,
        totalPending,
        totalOverdue,
        recoveryRate,
        monthlyCollection,
        recentPayments: recentPaymentsRaw.filter((p) => p.status === 'paid').map(withStudent),
        overduePayments: byStatus('overdue')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .map(withStudent),
      }
    },
    staleTime: 30_000,
  })

  const kpis = [
    {
      label: 'Élèves',
      value: counts?.totalStudents ?? 0,
      hint: counts ? (counts.newThisWeek > 0 ? `+${counts.newThisWeek} cette semaine` : counts.girls ? `${counts.girls} filles · ${counts.totalStudents - counts.girls} garçons` : 'Aucune nouvelle inscription') : '',
      icon: Users,
      tone: 'bg-primary/10 text-primary',
      to: '/students',
    },
    {
      label: 'Enseignants',
      value: counts?.totalTeachers ?? 0,
      hint: counts && counts.totalClasses ? `${(counts.totalTeachers / counts.totalClasses).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par classe` : 'Corps enseignant',
      icon: GraduationCap,
      tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      to: '/teachers/list',
    },
    {
      label: 'Classes',
      value: counts?.totalClasses ?? 0,
      hint: counts && counts.capacity ? `${counts.totalStudents} / ${counts.capacity} places occupées` : 'Capacité non définie',
      icon: School,
      tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      to: '/classes',
    },
    {
      label: 'Présence',
      value: counts?.attendanceRate == null ? '—' : `${counts.attendanceRate} %`,
      hint: counts?.todayRate == null ? "Aucun appel aujourd'hui" : `Aujourd'hui : ${counts.todayRate} % sur ${counts.todayCount} appels`,
      icon: ClipboardCheck,
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      to: '/attendance',
    },
  ]

  const maxMonth = Math.max(...(finance?.monthlyCollection.map((m) => m.amount) ?? [0]), 1)
  const hasMonthly = (finance?.monthlyCollection ?? []).some((m) => m.amount > 0)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted-foreground">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bonjour, {user?.firstName || 'Utilisateur'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Voici l'état de votre établissement.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} aria-label="Rafraîchir">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button asChild>
            <Link to="/students/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Inscrire un élève
            </Link>
          </Button>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', k.tone)}>
                  <k.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">{isLoading ? '…' : k.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{isLoading ? ' ' : k.hint}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Finances */}
      {!loadingFinance && finance && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Finances
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/finances">
                Voir le détail <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  ['Collecté', finance.totalCollected, 'text-emerald-700 dark:text-emerald-400', TrendingUp],
                  ['En attente', finance.totalPending, 'text-amber-600 dark:text-amber-400', Clock],
                  ['En retard', finance.totalOverdue, 'text-red-600 dark:text-red-400', AlertTriangle],
                ] as const).map(([label, value, color, Icon]) => (
                  <div key={label} className="rounded-lg border bg-muted/30 p-3">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                      {label}
                    </p>
                    <p className={cn('mt-1 truncate text-lg font-semibold tabular-nums', color)}>{ar(value)}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taux de recouvrement</span>
                  <span className="font-semibold tabular-nums">{finance.recoveryRate == null ? '—' : `${finance.recoveryRate} %`}</span>
                </div>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {(() => {
                    const total = finance.totalCollected + finance.totalPending + finance.totalOverdue || 1
                    return (
                      <>
                        <div className="h-full bg-emerald-500" style={{ width: `${(finance.totalCollected / total) * 100}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${(finance.totalPending / total) * 100}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${(finance.totalOverdue / total) * 100}%` }} />
                      </>
                    )
                  })()}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Part collectée sur l'ensemble des frais émis.</p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Collecte mensuelle</p>
              {!hasMonthly ? (
                <p className="text-sm text-muted-foreground">Aucun paiement enregistré pour le moment.</p>
              ) : (
                <div className="flex h-36 items-end gap-1.5">
                  {finance.monthlyCollection.map((m) => (
                    <div key={m.month} className="group flex flex-1 flex-col items-center gap-1" title={`${m.month} : ${ar(m.amount)}`}>
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className={cn('w-full rounded-t-sm transition-colors', m.amount > 0 ? 'bg-primary/80 group-hover:bg-primary' : 'bg-muted')}
                          style={{ height: `${Math.max((m.amount / maxMonth) * 100, m.amount > 0 ? 4 : 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.month}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Effectifs par classe */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Effectifs par classe</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/classes">Toutes <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!counts?.classFill?.length ? (
              <p className="text-sm text-muted-foreground">Aucune classe créée.</p>
            ) : (
              counts!.classFill.slice(0, 6).map((c) => {
                const ratio = c.capacity ? Math.min(c.count / c.capacity, 1) : 0
                const full = c.capacity > 0 && c.count >= c.capacity
                return (
                  <Link key={c.id} to={`/classes/${c.id}`} className="block rounded-md p-1 transition-colors hover:bg-muted/60">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.count}{c.capacity ? ` / ${c.capacity}` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', full ? 'bg-red-500' : ratio >= 0.9 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${c.capacity ? ratio * 100 : 0}%` }}
                      />
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Paiements récents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Paiements récents</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/finances/payments">Tous <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {!finance || finance.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement récent.</p>
            ) : (
              finance.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-md p-1.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {initials(p.student)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{studentName(p.student, p.studentId)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.dueDate), 'd MMM yyyy', { locale: fr })}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {ar(p.paidAmount ?? 0)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Retards */}
        <Card className={cn(finance && finance.overduePayments.length > 0 && 'border-red-200 dark:border-red-900/60')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className={cn('h-4 w-4', finance && finance.overduePayments.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')} />
              Paiements en retard
              {finance && finance.overduePayments.length > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {finance.overduePayments.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!finance || finance.overduePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun retard de paiement.</p>
            ) : (
              <>
                {finance.overduePayments.slice(0, 5).map((p) => (
                  <Link key={p.id} to={p.student ? `/students/${p.student.id}` : '/finances/payments'} className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted/60">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {initials(p.student)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{studentName(p.student, p.studentId)}</p>
                      <p className="text-xs text-muted-foreground">Échu le {format(new Date(p.dueDate), 'd MMM yyyy', { locale: fr })}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{ar(p.amount ?? 0)}</span>
                  </Link>
                ))}
                {finance.overduePayments.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link to="/finances/payments">Voir les {finance.overduePayments.length} retards</Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.path}
                className="group flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4 text-center text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-primary shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <a.icon className="h-4 w-4" />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
