import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Users, TrendingUp, Award, ChevronDown, ChevronRight } from 'lucide-react'

import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities } from '@/lib/db/offline'
import client from '@/api/client'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClassOption {
  id: string
  name: string
}

interface StudentOption {
  id: string
  firstName: string
  lastName: string
}

interface AttendanceStats {
  overallRate: number
  totalRecords: number
  byClass: Array<{
    className: string
    rate: number
    present: number
    absent: number
    late: number
    excused: number
    total: number
  }>
  byStatus: {
    present: number
    absent: number
    late: number
    excused: number
  }
  students?: Array<{
    id: string
    firstName: string
    lastName: string
    rate: number
    present: number
    absent: number
    late: number
    excused: number
    total: number
  }>
}

export function AttendanceStatsPage() {
  const [classId, setClassId] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  const { data: classes } = useLocalQuery<ClassOption>('Class')

  const { data: students } = useQuery<StudentOption[]>({
    queryKey: ['students', classId],
    queryFn: async () => {
      if (!classId) return []
      const items = await queryEntities<any>('Student', { classId })
      return (items ?? []).map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName }))
    },
    enabled: !!classId
  })

  const { data: stats, isLoading } = useQuery<AttendanceStats>({
    queryKey: [
      'attendance-stats',
      classId,
      studentId,
      dateFrom?.toISOString(),
      dateTo?.toISOString()
    ],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (classId) params.classId = classId
      if (studentId) params.studentId = studentId
      if (dateFrom) params.from = format(dateFrom, 'yyyy-MM-dd')
      if (dateTo) params.to = format(dateTo, 'yyyy-MM-dd')
      const res = await client.get('/attendance/stats', { params })
      return res.data.data ?? res.data
    }
  })

  const statusColors: Record<string, string> = {
    present: 'bg-green-500',
    absent: 'bg-red-500',
    late: 'bg-orange-500',
    excused: 'bg-blue-500'
  }

  const statusLabels: Record<string, string> = {
    present: 'Présent',
    absent: 'Absent',
    late: 'Retard',
    excused: 'Excusé'
  }

  function StatusBar({
    data,
    total
  }: {
    data: { present: number; absent: number; late: number; excused: number }
    total: number
  }) {
    if (total === 0) return <div className="h-4 rounded-full bg-muted" />
    return (
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${(data.present / total) * 100}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${(data.absent / total) * 100}%` }}
        />
        <div
          className="bg-orange-500 transition-all duration-500"
          style={{ width: `${(data.late / total) * 100}%` }}
        />
        <div
          className="bg-blue-500 transition-all duration-500"
          style={{ width: `${(data.excused / total) * 100}%` }}
        />
      </div>
    )
  }

  function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    color
  }: {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
    color: string
  }) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Statistiques de présence</h2>
        <p className="text-muted-foreground">
          Analysez les taux de présence par classe et par élève.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label className="mb-1.5 block text-sm">Classe</Label>
              <Combobox
                value={classId}
                onValueChange={(v) => {
                  setClassId(v || 'all')
                  setStudentId('')
                }}
                placeholder="Toutes"
                searchPlaceholder="Rechercher une classe..."
                options={[
                  { value: 'all', label: 'Toutes les classes' },
                  ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div className="w-48">
              <Label className="mb-1.5 block text-sm">Élève</Label>
              <Combobox
                value={studentId}
                onValueChange={(v) => setStudentId(v || 'all')}
                disabled={!classId}
                placeholder="Tous"
                searchPlaceholder="Rechercher un élève..."
                options={[
                  { value: 'all', label: 'Tous les élèves' },
                  ...(students ?? []).map((s) => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName}`,
                  })),
                ]}
              />
            </div>
            <div className="w-44">
              <Label className="mb-1.5 block text-sm">Du</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Date début'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-44">
              <Label className="mb-1.5 block text-sm">Au</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Date fin'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo || classId || studentId) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setClassId('')
                    setStudentId('')
                    setDateFrom(undefined)
                    setDateTo(undefined)
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">
          Chargement des statistiques...
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Taux de présence global"
              value={`${stats.overallRate}%`}
              sub={`Sur ${stats.totalRecords} entrées`}
              color="text-green-600"
            />
            <StatCard
              icon={Users}
              label="Présents"
              value={stats.byStatus.present}
              color="text-green-600"
            />
            <StatCard
              icon={Award}
              label="Absences + Retards"
              value={stats.byStatus.absent + stats.byStatus.late}
              sub={`${stats.byStatus.excused} excusés`}
              color="text-red-600"
            />
            <StatCard
              icon={Users}
              label="Total enregistrements"
              value={stats.totalRecords}
              color="text-blue-600"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <StatusBar data={stats.byStatus} total={stats.totalRecords} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${statusColors[key]}`} />
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="font-medium">
                        {stats.byStatus[key as keyof typeof stats.byStatus]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.byClass.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Par classe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.byClass.map((cls) => (
                    <div key={cls.className}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{cls.className}</span>
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            cls.rate >= 80
                              ? 'text-green-600'
                              : cls.rate >= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          )}
                        >
                          {cls.rate}%
                        </span>
                      </div>
                      <StatusBar
                        data={{
                          present: cls.present,
                          absent: cls.absent,
                          late: cls.late,
                          excused: cls.excused
                        }}
                        total={cls.total}
                      />
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>P: {cls.present}</span>
                        <span>A: {cls.absent}</span>
                        <span>R: {cls.late}</span>
                        <span>E: {cls.excused}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {stats.students && stats.students.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Détail par élève</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {stats.students.map((student) => {
                    const isExpanded = expandedStudent === student.id
                    return (
                      <div key={student.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                          className="flex w-full items-center justify-between px-6 py-3 hover:bg-accent/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">
                              {student.lastName} {student.firstName}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-32">
                              <StatusBar
                                data={{
                                  present: student.present,
                                  absent: student.absent,
                                  late: student.late,
                                  excused: student.excused
                                }}
                                total={student.total}
                              />
                            </div>
                            <span
                              className={cn(
                                'text-sm font-semibold w-12 text-right',
                                student.rate >= 80
                                  ? 'text-green-600'
                                  : student.rate >= 60
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              )}
                            >
                              {student.rate}%
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-6 pb-3 pl-14">
                            <div className="grid grid-cols-4 gap-3 text-sm">
                              {Object.entries(statusLabels).map(([key, label]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${statusColors[key]}`}
                                  />
                                  <span className="text-muted-foreground">{label}:</span>
                                  <span className="font-medium">
                                    {student[key as keyof typeof student] as number}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Total: {student.total} entrées
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center text-muted-foreground py-12">
          Aucune donnée statistique disponible.
        </div>
      )}
    </div>
  )
}
