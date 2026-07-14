import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity } from '@/lib/db/offline'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, ReloadIcon } from '@radix-ui/react-icons'

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

  const { data: teachers } = useLocalQuery<Teacher>('Teacher')

  const { data: attendances, isLoading } = useQuery({
    queryKey: ['teacher-attendance', date],
    queryFn: () => queryEntities('TeacherAttendance', { date })
  })

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
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-fit"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enseignant</TableHead>
                <TableHead>Spécialité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[300px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Chargement...</TableCell>
                </TableRow>
              ) : !teachers?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Aucun enseignant</TableCell>
                </TableRow>
              ) : (
                teachers.map((teacher) => {
                  const att = attendanceMap.get(teacher.id)
                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        {teacher.user.firstName} {teacher.user.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {teacher.specialty || '-'}
                      </TableCell>
                      <TableCell>
                        {att ? (
                          <Badge className={statusColors[att.status] || ''} variant="secondary">
                            {statusLabels[att.status] || att.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non marqué</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={att?.status === status ? 'default' : 'outline'}
                              onClick={() => setStatus(teacher.id, status)}
                              disabled={bulkMutation.isPending}
                            >
                              {statusLabels[status]}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
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
