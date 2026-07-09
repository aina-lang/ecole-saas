import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Save, Check, X, Clock, Ban } from 'lucide-react'

import client from '@/api/client'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

interface ClassOption {
  id: string
  name: string
}

interface StudentAttendanceEntry {
  studentId: string
  studentName: string
  status: AttendanceStatus | null
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  present: {
    label: 'Présent',
    color: 'text-green-700',
    bg: 'bg-green-100',
    border: 'border-green-500',
    icon: <Check className="h-4 w-4" />
  },
  absent: {
    label: 'Absent',
    color: 'text-red-700',
    bg: 'bg-red-100',
    border: 'border-red-500',
    icon: <X className="h-4 w-4" />
  },
  late: {
    label: 'Retard',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    border: 'border-orange-500',
    icon: <Clock className="h-4 w-4" />
  },
  excused: {
    label: 'Excusé',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-500',
    icon: <Ban className="h-4 w-4" />
  }
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']
const STATUS_KEY_MAP: Record<string, AttendanceStatus> = {
  p: 'present',
  a: 'absent',
  l: 'late',
  e: 'excused'
}

export function AttendancePage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<Date>(new Date())
  const [classId, setClassId] = useState<string>('')
  const [entries, setEntries] = useState<StudentAttendanceEntry[]>([])

  const { data: classes } = useQuery<ClassOption[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await client.get('/classes')
      return res.data.data ?? res.data
    }
  })

  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: async () => {
      if (!classId) return []
      const res = await client.get('/students', { params: { classId } })
      return res.data.data ?? res.data
    },
    enabled: !!classId
  })

  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance', classId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!classId) return []
      const res = await client.get('/attendance', {
        params: { classId, date: format(date, 'yyyy-MM-dd') }
      })
      return res.data.data ?? res.data
    },
    enabled: !!classId
  })

  useEffect(() => {
    if (students) {
      const existingMap = new Map(
        (
          existingAttendance as Array<{ studentId: string; status: AttendanceStatus }> | undefined
        )?.map((a) => [a.studentId, a.status]) ?? []
      )
      setEntries(
        students.map((s) => ({
          studentId: s.id,
          studentName: `${s.lastName} ${s.firstName}`,
          status: existingMap.get(s.id) ?? null
        }))
      )
    }
  }, [students, existingAttendance])

  const submitMutation = useMutation({
    mutationFn: async (
      attendanceData: Array<{ studentId: string; status: AttendanceStatus; date: string }>
    ) => {
      const res = await client.post('/attendance/bulk', { attendance: attendanceData })
      return res.data
    },
    onSuccess: () => {
      toast.success('Présences enregistrées avec succès')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement des présences")
    }
  })

  function setStatus(studentId: string, status: AttendanceStatus) {
    setEntries((prev) =>
      prev.map((e) =>
        e.studentId === studentId ? { ...e, status: e.status === status ? null : status } : e
      )
    )
  }

  function handleSubmit() {
    const marked = entries.filter((e) => e.status !== null)
    if (marked.length === 0) {
      toast.error('Aucune présence à enregistrer')
      return
    }

    submitMutation.mutate(
      marked.map((e) => ({
        studentId: e.studentId,
        status: e.status!,
        date: format(date, 'yyyy-MM-dd')
      }))
    )
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    if (key in STATUS_KEY_MAP) {
      const focused = document.activeElement as HTMLElement | null
      if (focused && focused.dataset.studentId) {
        setStatus(focused.dataset.studentId, STATUS_KEY_MAP[key])
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const totalStudents = entries.length
  const presentCount = entries.filter((e) => e.status === 'present').length
  const absentCount = entries.filter((e) => e.status === 'absent').length
  const lateCount = entries.filter((e) => e.status === 'late').length
  const excusedCount = entries.filter((e) => e.status === 'excused').length
  const markedCount = presentCount + absentCount + lateCount + excusedCount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Appel</h2>
          <p className="text-muted-foreground">
            Gérez les présences des élèves par classe et par jour.
          </p>
        </div>
        <Button onClick={handleSubmit} disabled={submitMutation.isPending || markedCount === 0}>
          <Save className="mr-2 h-4 w-4" />
          {submitMutation.isPending ? 'Enregistrement...' : 'Enregistrer les présences'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-48 space-y-1.5">
          <label className="text-sm font-medium">Classe</label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {classes?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <Clock className="h-3 w-3 text-orange-600" />
            Retards: {lateCount}
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

      <div className="text-xs text-muted-foreground flex gap-4 mb-2">
        <span className="font-medium">Raccourcis:</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">P</kbd> Présent
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">A</kbd> Absent
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">L</kbd> Retard
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">E</kbd> Excusé
      </div>

      <Card>
        <CardContent className="p-4">
          {!classId ? (
            <p className="text-center text-muted-foreground py-12">
              Sélectionnez une classe pour faire l'appel.
            </p>
          ) : loadingStudents ? (
            <p className="text-center text-muted-foreground py-12">Chargement des élèves...</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun élève dans cette classe.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {entries.map((entry) => (
                <div
                  key={entry.studentId}
                  data-student-id={entry.studentId}
                  tabIndex={0}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    entry.status
                      ? STATUS_CONFIG[entry.status].bg + ' ' + STATUS_CONFIG[entry.status].border
                      : 'bg-card hover:bg-accent/50'
                  )}
                >
                  <span className="text-sm font-medium truncate">{entry.studentName}</span>
                  <div className="flex gap-1">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(entry.studentId, status)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                          entry.status === status
                            ? STATUS_CONFIG[status].bg +
                                ' ' +
                                STATUS_CONFIG[status].color +
                                ' ring-2 ring-offset-1 ' +
                                STATUS_CONFIG[status].border
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {entry.status === status && STATUS_CONFIG[status].icon}
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {markedCount > 0 && (
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSubmit} disabled={submitMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {submitMutation.isPending
              ? 'Enregistrement...'
              : `Enregistrer les présences (${markedCount})`}
          </Button>
        </div>
      )}
    </div>
  )
}
