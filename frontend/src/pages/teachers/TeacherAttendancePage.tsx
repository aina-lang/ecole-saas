import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, ReloadIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  EXCUSED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

const statusLabels: Record<string, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'En retard',
  EXCUSED: 'Excusé'
}

export function TeacherAttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refreshKey, setRefreshKey] = useState(0)
  const queryClient = useQueryClient()

  const { data: teachers, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<Teacher>('Teacher')

  const { data: attendances, isLoading: isLoadingAttendances } = useQuery({
    queryKey: ['teacher-attendance', date, refreshKey],
    queryFn: () => queryEntities('TeacherAttendance', { date })
  })

  const isLoading = loadingTeachers || isLoadingAttendances

  const handleRefresh = () => {
    refetchTeachers()
    queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] })
  }

  const attendanceMap = new Map((attendances ?? []).map((a: any) => [a.teacherId, a]))

  const bulkMutation = useMutation({
    mutationFn: async (records: { teacherId: string; status: string; justification?: string }[]) => {
      for (const r of records) {
        await saveEntity('TeacherAttendance', {
          id: crypto.randomUUID(),
          teacherId: r.teacherId,
          date,
          status: r.status,
          justification: r.justification || null,
        })
      }
    },
    onSuccess: () => {
      setRefreshKey((k) => k + 1)
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] })
      toast.success('Présences enregistrées (mode hors-ligne)')
    },
    onError: () => toast.error("Erreur lors de l'enregistrement")
  })

  function setStatus(teacherId: string, status: string) {
    bulkMutation.mutate([{ teacherId, status }])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Présence des enseignants</h2>
          <p className="text-muted-foreground">Marquer la présence des professeurs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(format(d, 'yyyy-MM-dd'))}
            className="w-[180px]"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Enseignant',
                render: (teacher) => {
                  const t = teacher as any
                  const name = t.user ? `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim() : `${t.firstName || ''} ${t.lastName || ''}`.trim()
                  return name || 'Enseignant inconnu'
                },
                className: 'font-medium',
              },
              {
                key: 'specialty',
                label: 'Spécialité',
                render: (teacher) => (teacher as any).specialty || '-',
              },
              {
                key: 'status',
                label: 'Statut',
                render: (teacher) => {
                  const att = attendanceMap.get((teacher as any).id)
                  return att ? (
                    <Badge className={statusColors[att.status] || ''} variant="secondary">
                      {statusLabels[att.status] || att.status}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Non marqué</span>
                  )
                },
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (teacher) => {
                  const att = attendanceMap.get((teacher as any).id)
                  return (
                    <div className="flex gap-1">
                      {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={att?.status === status ? 'default' : 'outline'}
                          onClick={() => setStatus((teacher as any).id, status)}
                          disabled={bulkMutation.isPending}
                        >
                          {statusLabels[status]}
                        </Button>
                      ))}
                    </div>
                  )
                },
              },
            ]}
            data={teachers ?? []}
            total={(teachers ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(teacher) => (teacher as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun enseignant"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] })}
        >
          <ReloadIcon className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>
    </div>
  )
}
