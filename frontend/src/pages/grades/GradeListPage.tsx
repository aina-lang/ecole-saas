import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Edit, Trash2, Plus, RotateCw } from 'lucide-react'

import { useLocalQuery, usePeriods } from '@/lib/db/hooks'
import { deleteEntity, queryEntities, countEntities } from '@/lib/db/pouchdb-compat'
import type { Grade, PaginatedResponse, Subject } from '@/types'
import { cn } from '@/lib/utils'
import { formatSubjectLabel } from '@/lib/subject'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TrashIcon } from '@radix-ui/react-icons'

interface GradeWithDetails extends Grade {
  student?: { id: string; firstName: string; lastName: string }
  subject?: { id: string; name: string; code: string | null; level: string | null; class?: { id: string; name: string } | null }
  period?: { id: string; label: string }
  createdAt?: string
}

interface ClassOption {
  id: string
  name: string
}

interface SubjectOption extends Subject {}

const evaluationTypeLabels: Record<string, string> = {
  exam: 'Examen',
  test: 'Test',
  homework: 'Devoir',
  project: 'Projet'
}

const evaluationTypeVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    exam: 'default',
    test: 'secondary',
    homework: 'outline',
    project: 'destructive'
  }

export function GradeListPage() {
  const queryClient = useQueryClient()

  const [classId, setClassId] = useState<string>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [periodId, setPeriodId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const limit = 10

  const { data: classes } = useLocalQuery<ClassOption>('Class')

  const { data: subjects } = useLocalQuery<SubjectOption>('Subject')

  const { periods, loading: loadingPeriods } = usePeriods()

  const { data: gradesResponse, isLoading } = useQuery<PaginatedResponse<GradeWithDetails>>({
    queryKey: ['grades', classId, subjectId, periodId, page, sortBy, sortOrder],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sortBy,
        sortOrder
      }
      if (classId) params.classId = classId
      if (subjectId) params.subjectId = subjectId
      if (periodId) params.periodId = periodId
      const [result, total] = await Promise.all([
        queryEntities<GradeWithDetails>('Grade', params),
        countEntities('Grade', params)
      ])
      return { data: result, total } as PaginatedResponse<GradeWithDetails>
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('Grade', id)
    },
    onSuccess: () => {
      toast.success('Note supprimée avec succès')
      queryClient.invalidateQueries({ queryKey: ['grades'] })
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    }
  })

  const grades = gradesResponse?.data ?? []
  const total = gradesResponse?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notes</h2>
          <p className="text-muted-foreground">Consultez et gérez les notes des élèves.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['grades'] })}
            disabled={isLoading}
          >
            <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button asChild>
            <Link to="/grades/entry">
              <Plus className="mr-2 h-4 w-4" />
              Saisie de notes
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Combobox
                value={classId}
                onValueChange={(v) => {
                  setClassId(v || 'all')
                  setPage(1)
                }}
                placeholder="Classe"
                searchPlaceholder="Rechercher une classe..."
                options={[
                  { value: 'all', label: 'Toutes les classes' },
                  ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div className="w-48">
              <Combobox
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v || 'all')
                  setPage(1)
                }}
                placeholder="Matière"
                searchPlaceholder="Rechercher une matière..."
                options={[
                  { value: 'all', label: 'Toutes les matières' },
                  ...(subjects ?? []).map((s) => ({ value: s.id, label: formatSubjectLabel(s) })),
                ]}
              />
            </div>
            <div className="w-40">
              <Combobox
                value={periodId}
                onValueChange={(v) => {
                  setPeriodId(v)
                  setPage(1)
                }}
                placeholder="Période"
                disabled={loadingPeriods}
                options={[
                  { value: 'all', label: 'Toutes' },
                  ...periods.map((p) => ({ value: p.value, label: p.label })),
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Élève',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return g.student ? `${g.student.lastName} ${g.student.firstName}` : g.studentId
                },
              },
              {
                key: 'subject',
                label: 'Matière',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return g.subject ? formatSubjectLabel(g.subject) : g.subjectId
                },
              },
              {
                key: 'value',
                label: 'Note',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return (
                    <span
                      className={cn(
                        'font-semibold',
                        g.value >= g.maxValue * 0.8
                          ? 'text-green-600'
                          : g.value >= g.maxValue * 0.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      )}
                    >
                      {g.value}
                    </span>
                  )
                },
              },
              {
                key: 'maxValue',
                label: '/ Max',
                render: (grade) => (grade as GradeWithDetails).maxValue,
              },
              {
                key: 'coefficient',
                label: 'Coefficient',
                sortable: true,
                render: (grade) => (grade as GradeWithDetails).coefficient,
              },
              {
                key: 'evaluationType',
                label: 'Type',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return (
                    <Badge variant={evaluationTypeVariants[g.evaluationType] ?? 'outline'}>
                      {evaluationTypeLabels[g.evaluationType] ?? g.evaluationType}
                    </Badge>
                  )
                },
              },
              {
                key: 'period',
                label: 'Période',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return g.period?.label ?? '-'
                },
              },
              {
                key: 'createdAt',
                label: 'Date',
                sortable: true,
                render: (grade) => {
                  const g = grade as GradeWithDetails
                  return g.createdAt
                    ? format(new Date(g.createdAt), 'dd MMM yyyy', { locale: fr })
                    : '-'
                },
              },
            ]}
            data={grades}
            total={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onSortChange={(key, direction) => {
              setSortBy(key)
              setSortOrder(direction)
            }}
            sortKey={sortBy}
            sortDirection={sortOrder}
            filters={{
              classId,
              subjectId,
              periodId,
            }}
            onFilterChange={(key, value) => {
              if (key === 'classId') setClassId(value)
              else if (key === 'subjectId') setSubjectId(value)
              else if (key === 'periodId') setPeriodId(value)
              setPage(1)
            }}
            onRowClick={(grade) => {
              const g = grade as GradeWithDetails
              if (g.id) window.location.href = `/grades/entry?edit=${g.id}`
            }}
            onBulkDelete={(ids) => {
              Promise.all(ids.map(id => deleteEntity('Grade', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['grades'] })
                  toast.success(`${ids.length} note(s) supprimée(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(grade) => (grade as GradeWithDetails).id}
            isLoading={isLoading}
            emptyMessage="Aucune note trouvée."
            bulkDeleteLabel="note(s)"
            renderRowActions={(grade) => {
              const g = grade as GradeWithDetails
              return (
                <>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/grades/entry?edit=${g.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <ConfirmDialog
                    open={deleteId === g.id}
                    onOpenChange={(open) => {
                      if (!open) setDeleteId(null)
                    }}
                    onConfirm={() => deleteMutation.mutate(g.id)}
                    title="Confirmer la suppression"
                    description="Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(g.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
