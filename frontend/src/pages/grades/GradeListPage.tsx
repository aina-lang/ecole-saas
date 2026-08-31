import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { Edit, Trash2, Plus, RotateCw } from 'lucide-react'

import { useLocalQuery, usePeriods } from '@/lib/db/hooks'
import { deleteEntity, saveEntity, queryEntities, countEntities } from '@/lib/db/pouchdb-compat'
import type { Grade, PaginatedResponse, Subject, Student } from '@/types'
import { cn } from '@/lib/utils'
import { formatSubjectLabel } from '@/lib/subject'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, FilterBar } from '@/components/layout/page'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GradeAveragingConfig } from './GradeAveragingConfig'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

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

import { evalTypeToLabel } from '@/lib/evaluation-types'

const evaluationTypeVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    exam: 'default',
    test: 'secondary',
    homework: 'outline',
    oral: 'secondary',
    project: 'destructive',
    controle: 'default',
    examen_blanc: 'destructive'
  }

export function GradeListPage() {
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('notes')
  const [classId, setClassId] = useState<string>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [periodId, setPeriodId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailGrade, setDetailGrade] = useState<GradeWithDetails | null>(null)
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
      const [result, total, students, subjects] = await Promise.all([
        queryEntities<Grade>('Grade', params),
        countEntities('Grade', params),
        queryEntities<Student>('Student'),
        // `class` n'est pas dans le type Subject mais le document répliqué le
        // porte (hydraté côté serveur) — il sert au libellé de la matière.
        queryEntities<Subject & { class?: { id: string; name: string } | null }>('Subject'),
      ])
      const studentMap = new Map((students ?? []).map((s) => [s.id, s]))
      const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s]))

      const enriched = result.map((grade: any) => {
        const student = studentMap.get(grade.studentId)
        const subject = subjectMap.get(grade.subjectId)
        return {
          ...grade,
          student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName } : undefined,
          subject: subject
            ? {
                id: subject.id,
                name: subject.name,
                code: subject.code,
                level: subject.level,
                class: subject.class || null,
              }
            : undefined,
        } as GradeWithDetails
      })

      return { data: enriched, total } as PaginatedResponse<GradeWithDetails>
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

  const [editGrade, setEditGrade] = useState<GradeWithDetails | null>(null)
  const [editSubjectId, setEditSubjectId] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editMaxValue, setEditMaxValue] = useState('20')
  const [editCoeff, setEditCoeff] = useState('1')
  const [editEvalType, setEditEvalType] = useState('')
  const [editComment, setEditComment] = useState('')

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editGrade) return
      await saveEntity('Grade', {
        id: editGrade.id,
        studentId: editGrade.studentId,
        subjectId: editSubjectId,
        classId: editGrade.classId,
        academicYearId: editGrade.academicYearId,
        value: parseFloat(editValue),
        maxValue: parseFloat(editMaxValue),
        coefficient: parseFloat(editCoeff),
        evaluationType: editEvalType,
        comment: editComment || undefined,
        periodId: editGrade.periodId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      toast.success('Note mise à jour')
      setEditGrade(null)
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  })

  const grades = gradesResponse?.data ?? []
  const total = gradesResponse?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        description="Consultez et gérez les notes des élèves."
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['grades'] })}
              disabled={isLoading}
              aria-label="Rafraîchir"
            >
              <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button asChild>
              <Link to="/grades/entry">
                <Plus className="mr-2 h-4 w-4" />
                Saisie de notes
              </Link>
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-6 mt-4">

      <FilterBar>
        <Combobox
          className="w-[200px]"
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
        <Combobox
          className="w-[200px]"
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
        <Combobox
          className="w-[160px]"
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
      </FilterBar>

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
                          ? 'text-emerald-600'
                          : g.value >= g.maxValue * 0.5
                            ? 'text-amber-600'
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
                      {evalTypeToLabel(g.evaluationType)}
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
                  const periodLabel = periods.find((p) => p.value === g.periodId)?.label
                  return periodLabel ?? '-'
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
              setDetailGrade(g)
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
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditGrade(g)
                    setEditSubjectId(g.subjectId)
                    setEditValue(String(g.value))
                    setEditMaxValue(String(g.maxValue))
                    setEditCoeff(String(g.coefficient))
                    setEditEvalType(g.evaluationType)
                    setEditComment(g.comment ?? '')
                  }}>
                    <Edit className="h-4 w-4" />
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

      <Dialog open={!!editGrade} onOpenChange={(o) => { if (!o) setEditGrade(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la note</DialogTitle>
          </DialogHeader>
          {editGrade && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editGrade.student?.lastName} {editGrade.student?.firstName}
              </div>
              <div className="space-y-1.5">
                <Label>Matière</Label>
                <Combobox
                  value={editSubjectId}
                  onValueChange={setEditSubjectId}
                  placeholder="Sélectionner"
                  searchPlaceholder="Rechercher..."
                  options={(subjects ?? []).map((s) => ({ value: s.id, label: formatSubjectLabel(s) }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Input type="number" min="0" step="0.5" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>/ Max</Label>
                  <Input type="number" min="1" value={editMaxValue} onChange={(e) => setEditMaxValue(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Coefficient</Label>
                  <Input type="number" min="0.5" step="0.5" value={editCoeff} onChange={(e) => setEditCoeff(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editEvalType} onValueChange={setEditEvalType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['exam', 'test', 'homework', 'oral', 'project', 'controle', 'examen_blanc'] as const).map((t) => (
                      <SelectItem key={t} value={t}>{evalTypeToLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Commentaire</Label>
                <Input value={editComment} onChange={(e) => setEditComment(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditGrade(null)}>Annuler</Button>
                <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailGrade} onOpenChange={(o) => { if (!o) setDetailGrade(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Détails de la note</DialogTitle>
          </DialogHeader>
          {detailGrade && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Élève</span>
                <span className="font-medium">{detailGrade.student?.lastName} {detailGrade.student?.firstName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Matière</span>
                <span className="font-medium">{detailGrade.subject ? formatSubjectLabel(detailGrade.subject) : '—'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Note</span>
                <span className="font-medium">{detailGrade.value} / {detailGrade.maxValue}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Coefficient</span>
                <span className="font-medium">{detailGrade.coefficient}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{evalTypeToLabel(detailGrade.evaluationType)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Période</span>
                <span className="font-medium">{periods.find((p) => p.value === detailGrade.periodId)?.label ?? detailGrade.periodId}</span>
              </div>
              {detailGrade.comment && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Commentaire</span>
                  <span className="font-medium">{detailGrade.comment}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Créé le</span>
                <span className="font-medium">{detailGrade.createdAt ? format(new Date(detailGrade.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <GradeAveragingConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}
