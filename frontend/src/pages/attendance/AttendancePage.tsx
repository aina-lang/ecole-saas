import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Check, X, Ban, Users, RotateCw } from 'lucide-react'

import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities } from '@/lib/db/offline'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED'

type StatusFilter = 'ALL' | AttendanceStatus | 'UNMARKED'

interface ClassOption {
  id: string
  name: string
}

interface StudentAttendanceEntry {
  studentId: string
  studentName: string
  registrationNumber: string
  status: AttendanceStatus | null
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  PRESENT: {
    label: 'Présent',
    color: 'text-green-700',
    bg: 'bg-green-100',
    border: 'border-green-500',
    icon: <Check className="h-4 w-4" />
  },
  ABSENT: {
    label: 'Absent',
    color: 'text-red-700',
    bg: 'bg-red-100',
    border: 'border-red-500',
    icon: <X className="h-4 w-4" />
  },
  EXCUSED: {
    label: 'Excusé',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-500',
    icon: <Ban className="h-4 w-4" />
  }
}

export function AttendancePage() {
  const [date, setDate] = useState<Date>(new Date())
  const [classId, setClassId] = useState<string>('')
  const [entries, setEntries] = useState<StudentAttendanceEntry[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const queryClient = useQueryClient()
  const { data: classes } = useLocalQuery<ClassOption>('Class')

  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: async () => {
      if (!classId) return []
      return queryEntities<Student>('Student', { classId })
    },
    enabled: !!classId
  })

  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance', classId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!classId) return []
      return queryEntities('Attendance', { classId, date: format(date, 'yyyy-MM-dd') })
    },
    enabled: !!classId
  })

  useEffect(() => {
    if (!students) {
      setEntries([])
      return
    }

    const existingMap = new Map(
      (
        existingAttendance as Array<{ studentId: string; status: AttendanceStatus }> | undefined
      )?.map((a) => [a.studentId, a.status]) ?? []
    )

    setEntries(
      students.map((s) => ({
        studentId: s.id,
        studentName: `${s.lastName} ${s.firstName}`,
        registrationNumber: s.registrationNumber,
        status: existingMap.get(s.id) ?? null
      }))
    )
  }, [students, existingAttendance])

  const filteredEntries = entries.filter((entry) => {
    const query = search.trim().toLowerCase()
    if (query) {
      const matchesName = entry.studentName.toLowerCase().includes(query)
      const matchesMatricule = entry.registrationNumber.toLowerCase().includes(query)
      if (!matchesName && !matchesMatricule) return false
    }
    if (statusFilter === 'UNMARKED') return entry.status === null
    if (statusFilter !== 'ALL') return entry.status === statusFilter
    return true
  })

  const totalStudents = entries.length
  const presentCount = entries.filter((e) => e.status === 'PRESENT').length
  const absentCount = entries.filter((e) => e.status === 'ABSENT').length
  const excusedCount = entries.filter((e) => e.status === 'EXCUSED').length
  const markedCount = presentCount + absentCount + excusedCount

  const isLoading = loadingStudents

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Présences</h2>
          <p className="text-muted-foreground">
            Consultez la liste des présences par classe et par jour.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['students'] })
            queryClient.invalidateQueries({ queryKey: ['attendance'] })
          }}
          disabled={isLoading}
        >
          <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
          />
        </div>
        <div className="w-48 space-y-1.5">
          <label className="text-sm font-medium">Classe</label>
          <Combobox
            value={classId}
            onValueChange={setClassId}
            placeholder="Sélectionner"
            searchPlaceholder="Rechercher une classe..."
            options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-sm font-medium">Rechercher</label>
          <Input
            placeholder="Nom ou matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48 space-y-1.5">
          <label className="text-sm font-medium">Statut</label>
          <Combobox
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            placeholder="Tous"
            options={[
              { value: 'ALL', label: 'Tous' },
              { value: 'PRESENT', label: 'Présent' },
              { value: 'ABSENT', label: 'Absent' },
              { value: 'EXCUSED', label: 'Excusé' },
              { value: 'UNMARKED', label: 'Non marqué' }
            ]}
          />
        </div>
      </div>

      {markedCount > 0 && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3 text-green-600" />
            Présents: {presentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <X className="h-3 w-3 text-red-600" />
            Absents: {absentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Ban className="h-3 w-3 text-blue-600" />
            Excusés: {excusedCount}
          </Badge>
          <span className="text-sm text-muted-foreground ml-2">
            {markedCount}/{totalStudents} élèves marqués
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {!classId ? (
            <p className="text-center text-muted-foreground py-12">
              Sélectionnez une classe pour consulter les présences.
            </p>
          ) : loadingStudents ? (
            <p className="text-center text-muted-foreground py-12">Chargement des élèves...</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun élève dans cette classe.
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun résultat pour cette recherche ou ce filtre.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredEntries.map((entry) => {
                const config = entry.status ? STATUS_CONFIG[entry.status] : null
                return (
                  <div
                    key={entry.studentId}
                    className={cn(
                      'flex flex-col gap-2 rounded-lg border p-3',
                      config ? config.bg + ' ' + config.border : 'bg-card'
                    )}
                  >
                    <span className="text-sm font-medium truncate">{entry.studentName}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.registrationNumber}
                    </span>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        config ? config.color : 'text-muted-foreground'
                      )}
                    >
                      {config ? (
                        <>
                          {config.icon}
                          {config.label}
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4" />
                          Non marqué
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
