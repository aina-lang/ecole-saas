import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity, enrichTeachers } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { ReloadIcon } from '@radix-ui/react-icons'
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
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: teachersRaw, refetch: refetchTeachers } = useLocalQuery<Teacher>('Teacher')

  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['enriched-teachers', teachersRaw],
    queryFn: () => enrichTeachers(teachersRaw ?? []),
    enabled: !!teachersRaw,
  })

  const { data: attendances, isLoading: isLoadingAttendances } = useQuery({
    queryKey: ['teacher-attendance', date],
    queryFn: () => queryEntities('TeacherAttendance', { date }),
  })

  const isLoading = isLoadingTeachers || isLoadingAttendances

  const handleRefresh = () => {
    refetchTeachers()
    queryClient.invalidateQueries({ queryKey: ['teacher-attendance', date] })
  }

  const attendanceMap = new Map((attendances ?? []).map((a: any) => [a.teacherId, a]))

  const saveMutation = useMutation({
    mutationFn: async (record: { teacherId: string; status: string }) => {
      const existing = attendanceMap.get(record.teacherId)
      await saveEntity('TeacherAttendance', {
        id: existing?.id || crypto.randomUUID(),
        teacherId: record.teacherId,
        date,
        status: record.status,
        justification: null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance', date] })
      toast.success('Présence enregistrée')
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  })

  function setStatus(teacherId: string, status: string) {
    saveMutation.mutate({ teacherId, status })
  }

  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      label: 'Enseignant',
      render: (row) => {
        const first = row.user?.firstName ?? row.user_firstName ?? ''
        const last = row.user?.lastName ?? row.user_lastName ?? ''
        return `${first} ${last}`.trim() || 'Sans nom'
      },
      className: 'font-medium',
    },
    {
      key: 'specialty',
      label: 'Spécialité',
      render: (row) => row.specialty || '-',
    },
    {
      key: 'status',
      label: 'Statut',
      render: (row) => {
        const att = attendanceMap.get(row.id)
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
      render: (row) => {
        const att = attendanceMap.get(row.id)
        return (
          <div className="flex gap-1">
            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={att?.status === status ? 'default' : 'outline'}
                onClick={() => setStatus(row.id, status)}
                disabled={saveMutation.isPending}
              >
                {statusLabels[status]}
              </Button>
            ))}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présence des enseignants"
        description="Marquer la présence des professeurs"
        actions={
          <>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading} aria-label="Rafraîchir">
              <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <DatePicker
              value={date}
              onChange={(d) => {
                if (d) {
                  const formatted = format(d, 'yyyy-MM-dd')
                  if (formatted <= today) setDate(formatted)
                }
              }}
              className="w-[180px]"
              max={new Date(today)}
            />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={teachers ?? []}
            total={(teachers ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="Aucun enseignant"
          />
        </CardContent>
      </Card>
    </div>
  )
}
