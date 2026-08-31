import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Ban, Check, Clock, RotateCw, Users, X } from 'lucide-react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities } from '@/lib/db/pouchdb-compat'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

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
  present: {
    label: 'Présent',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500',
    icon: <Check className="h-4 w-4" />
  },
  absent: {
    label: 'Absent',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    icon: <X className="h-4 w-4" />
  },
  late: {
    label: 'Retard',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    icon: <Clock className="h-4 w-4" />
  },
  excused: {
    label: 'Excusé',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    icon: <Ban className="h-4 w-4" />
  }
}

const PAGE_SIZE = 50

export function AttendancePage() {
  const [date, setDate] = useState<Date>(new Date())
  const [classId, setClassId] = useState<string>('')
  const [entries, setEntries] = useState<StudentAttendanceEntry[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { data: classes } = useLocalQuery<ClassOption>('Class')
  const today = new Date()
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: async () => {
      if (!classId) return []
      return queryEntities<Student>('Student', { classId })
    },
    enabled: !!classId
  })

  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance', classId, dateStr],
    queryFn: async () => {
      if (!classId) return []
      // Les documents créés sur ce poste portent date = 'yyyy-MM-dd' et un
      // statut minuscule ; ceux relayés par le serveur (appel fait sur mobile)
      // portent une date ISO complète et un statut en MAJUSCULES. On
      // normalise ici pour que les deux s'affichent.
      const all = await queryEntities<any>('Attendance', { classId })
      return all
        .filter((a) => !a.deletedAt && String(a.date ?? '').slice(0, 10) === dateStr)
        .map((a) => ({ ...a, status: String(a.status ?? '').toLowerCase() }))
        .filter((a) => ['present', 'absent', 'late', 'excused'].includes(a.status))
    },
    enabled: !!classId,
    // Appel modifiable depuis le mobile : on relit la base locale toutes les 5 s.
    refetchInterval: 5000,
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
    setPage(1)
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

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedEntries = filteredEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const totalStudents = entries.length
  const presentCount = entries.filter((e) => e.status === 'present').length
  const absentCount = entries.filter((e) => e.status === 'absent').length
  const excusedCount = entries.filter((e) => e.status === 'excused').length
  const markedCount = presentCount + absentCount + excusedCount

  const isLoading = loadingStudents

  const handleRefresh = () => {
    if (classId) {
      queryClient.invalidateQueries({ queryKey: ['students', classId] })
      queryClient.invalidateQueries({ queryKey: ['attendance', classId, dateStr] })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présences"
        description="Consultez la liste des présences par classe et par jour."
        actions={
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading} aria-label="Rafraîchir">
            <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        }
      />

      <FilterBar>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          max={today}
          className="w-[180px]"
        />
        <Combobox
          className="w-[200px]"
          value={classId}
          onValueChange={setClassId}
          placeholder="Classe"
          searchPlaceholder="Rechercher une classe..."
          options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nom ou matricule..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Combobox
          className="w-[160px]"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          placeholder="Statut"
          options={[
            { value: 'ALL', label: 'Tous' },
            { value: 'present', label: 'Présent' },
            { value: 'absent', label: 'Absent' },
            { value: 'late', label: 'Retard' },
            { value: 'excused', label: 'Excusé' },
            { value: 'UNMARKED', label: 'Non marqué' }
          ]}
        />
      </FilterBar>

      {markedCount > 0 && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3 text-emerald-600" />
            Présents: {presentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <X className="h-3 w-3 text-red-600" />
            Absents: {absentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Ban className="h-3 w-3 text-amber-600" />
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
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Aucune classe sélectionnée"
              description="Sélectionnez une classe pour consulter les présences."
            />
          ) : loadingStudents ? (
            <p className="text-center text-muted-foreground py-12">Chargement des élèves...</p>
          ) : entries.length === 0 ? (
            <EmptyState title="Aucun élève dans cette classe" />
          ) : filteredEntries.length === 0 ? (
            <EmptyState title="Aucun résultat" description="Aucun élève ne correspond à cette recherche ou à ce filtre." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {paginatedEntries.map((entry) => {
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
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={cn(safePage <= 1 && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={safePage === p}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={cn(safePage >= totalPages && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
