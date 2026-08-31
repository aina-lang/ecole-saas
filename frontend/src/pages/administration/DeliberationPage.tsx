import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import type { AcademicYear, Class, Student, Grade, Subject, PromotionDecision } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@/components/ui/data-table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InfoCircledIcon } from '@radix-ui/react-icons'

interface StudentRow {
  id: string
  firstName: string
  lastName: string
  average: number
}

export function DeliberationPage() {
  const queryClient = useQueryClient()
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [decisions, setDecisions] = useState<Record<string, PromotionDecision>>({})

  const { data: academicYears } = useQuery({
    queryKey: ['academicYears-deliberation'],
    queryFn: () => queryEntities<AcademicYear>('AcademicYear' as any),
  })

  const { data: classes } = useQuery({
    queryKey: ['classes-deliberation'],
    queryFn: () => queryEntities<Class>('Class'),
  })

  const currentYear = useMemo(
    () => academicYears?.find((y) => y.isCurrent),
    [academicYears],
  )

  useEffect(() => {
    if (currentYear && !selectedYearId) {
      setSelectedYearId(currentYear.id)
    }
  }, [currentYear, selectedYearId])

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-deliberation', selectedClassId],
    queryFn: () => queryEntities<Student>('Student', { classId: selectedClassId }),
    enabled: !!selectedClassId,
  })

  const { data: gradeConfig } = useQuery({
    queryKey: ['grade-config-deliberation'],
    queryFn: async () => {
      try {
        const doc = await getEntityById<any>('GradeConfig' as any, 'grade_config')
        return doc ?? null
      } catch { return null }
    },
  })

  const includedTypes = useMemo(() => {
    if (!gradeConfig?.includedTypes) return null
    return new Set(gradeConfig.includedTypes)
  }, [gradeConfig])

  const { data: subjects } = useQuery({
    queryKey: ['subjects-deliberation'],
    queryFn: () => queryEntities<Subject>('Subject'),
  })

  const subjectCoeffMap = useMemo(() => {
    const map = new Map<string, number>()
    if (subjects) subjects.forEach((s) => map.set(s.id, s.coefficient))
    return map
  }, [subjects])

  const { data: grades } = useQuery({
    queryKey: ['grades-deliberation', selectedClassId, selectedYearId],
    queryFn: async () => {
      if (!students?.length) return []
      const allGrades = await queryEntities<Grade>('Grade')
      const studentIds = new Set(students.map((s) => s.id))
      return allGrades.filter(
        (g) => studentIds.has(g.studentId) && (g as any).academicYearId === selectedYearId,
      )
    },
    enabled: !!students?.length && !!selectedYearId,
  })

  const studentRows: StudentRow[] = useMemo(() => {
    if (!students || !grades) return []
    return students.map((student) => {
      const studentGrades = grades.filter((g) => g.studentId === student.id)
      const filteredGrades = includedTypes
        ? studentGrades.filter((g) => includedTypes.has(g.evaluationType.toUpperCase()))
        : studentGrades.filter((g) => g.evaluationType.toUpperCase() !== 'EXAMEN_BLANC')
      let avg = 0
      if (filteredGrades.length > 0) {
        const totalWeighted = filteredGrades.reduce(
          (sum, g) => sum + ((g.value / g.maxValue) * 20 * (subjectCoeffMap.get(g.subjectId) ?? g.coefficient)),
          0,
        )
        const totalCoeff = filteredGrades.reduce(
          (sum, g) => sum + (subjectCoeffMap.get(g.subjectId) ?? g.coefficient),
          0,
        )
        avg = totalCoeff > 0 ? Math.round((totalWeighted / totalCoeff) * 100) / 100 : 0
      }
      return {
        id: student.id,
        firstName: student.firstName || '',
        lastName: student.lastName,
        average: avg,
      }
    })
  }, [students, grades, includedTypes, subjectCoeffMap])

  const getDefaultDecision = (avg: number): PromotionDecision => {
    if (avg >= 10) return 'ADMIS'
    if (avg >= 9.5) return 'A_DELIBERER'
    return 'REDOUBLANT'
  }

  const getDecision = (studentId: string, average: number): PromotionDecision => {
    return decisions[studentId] ?? getDefaultDecision(average)
  }

  const setDecision = (studentId: string, decision: PromotionDecision) => {
    setDecisions((prev) => ({ ...prev, [studentId]: decision }))
  }

  const decisionLabels: Record<PromotionDecision, string> = {
    ADMIS: 'Admis',
    REDOUBLANT: 'Redoublant',
    EXCLU: 'Exclu',
    A_DELIBERER: 'À délibérer',
  }

  // Couleurs sémantiques : admis (émeraude), à délibérer (ambre), redoublant
  // (neutre), exclu (rouge) — lisibles en clair et en sombre.
  const decisionClasses: Record<PromotionDecision, string> = {
    ADMIS: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    A_DELIBERER: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    REDOUBLANT: 'border-transparent bg-muted text-foreground',
    EXCLU: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }

  const decisionCounts = useMemo(() => {
    const counts: Record<PromotionDecision, number> = { ADMIS: 0, A_DELIBERER: 0, REDOUBLANT: 0, EXCLU: 0 }
    for (const row of studentRows) counts[decisions[row.id] ?? getDefaultDecision(row.average)]++
    return counts
  }, [studentRows, decisions])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existingEnrollments = await queryEntities<any>('StudentEnrollment' as any)
      const now = new Date().toISOString()
      const selectedClass = classes?.find((c) => c.id === selectedClassId)
      const levelId = selectedClass?.levelId || ''

      for (const row of studentRows) {
        const decision = getDecision(row.id, row.average)
        const existing = existingEnrollments.find(
          (e: any) => e.studentId === row.id && e.academicYearId === selectedYearId,
        )

        if (existing) {
          await saveEntity('StudentEnrollment' as any, {
            ...existing,
            promotionDecision: decision,
            updatedAt: now,
          })
        } else {
          await saveEntity('StudentEnrollment' as any, {
            id: crypto.randomUUID(),
            studentId: row.id,
            academicYearId: selectedYearId,
            levelId,
            classId: selectedClassId,
            promotionDecision: decision,
            reinscriptionStatus: 'PRE_INSCRIT',
            createdAt: now,
            updatedAt: now,
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      toast.success('Décisions de promotion enregistrées')
    },
    onError: () => toast.error("Erreur lors de l'enregistrement des décisions"),
  })

  const columns: ColumnDef<StudentRow>[] = [
    { key: 'lastName', label: 'Nom', sortable: true },
    { key: 'firstName', label: 'Prénom', sortable: true },
    {
      key: 'average',
      label: 'Moyenne',
      sortable: true,
      render: (row) => {
        let color = 'text-red-600 dark:text-red-400'
        if (row.average >= 10) color = 'text-emerald-700 dark:text-emerald-400'
        else if (row.average >= 9.5) color = 'text-amber-600 dark:text-amber-400'
        return (
          <span className={cn('font-semibold tabular-nums', color)}>
            {row.average.toFixed(2)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">/ 20</span>
          </span>
        )
      },
    },
    {
      key: 'autoDecision',
      label: 'Décision auto',
      render: (row) => (
        <Badge variant="outline" className={decisionClasses[getDefaultDecision(row.average)]}>
          {decisionLabels[getDefaultDecision(row.average)]}
        </Badge>
      ),
    },
    {
      key: 'decision',
      label: 'Décision finale',
      render: (row) => (
        <Select
          value={getDecision(row.id, row.average)}
          onValueChange={(val) => setDecision(row.id, val as PromotionDecision)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIS">Admis</SelectItem>
            <SelectItem value="A_DELIBERER">À délibérer</SelectItem>
            <SelectItem value="REDOUBLANT">Redoublant</SelectItem>
            <SelectItem value="EXCLU">Exclu</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Délibération"
        description="Calcul des moyennes et décisions de passage par classe"
        actions={
          studentRows.length > 0 ? (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Enregistrement...'
                : 'Enregistrer les décisions'}
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <div className="space-y-2">
          <Label>Année académique</Label>
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent>
              {academicYears?.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label || (y as any).name} {y.isCurrent ? '(En cours)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Classe</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner une classe" />
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
      </FilterBar>

      {studentRows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['ADMIS', 'Admis', 'text-emerald-700 dark:text-emerald-400'],
            ['A_DELIBERER', 'À délibérer', 'text-amber-600 dark:text-amber-400'],
            ['REDOUBLANT', 'Redoublants', 'text-foreground'],
            ['EXCLU', 'Exclus', 'text-red-600 dark:text-red-400'],
          ] as const).map(([key, label, color]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{decisionCounts[key]}</p>
                <p className="text-xs text-muted-foreground">
                  {studentRows.length ? Math.round((decisionCounts[key] / studentRows.length) * 100) : 0} % de la classe
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {studentRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">
              Élèves — {classes?.find((c) => c.id === selectedClassId)?.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({studentRows.length} élève{studentRows.length > 1 ? 's' : ''})
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Les décisions modifiées manuellement sont conservées jusqu'à l'enregistrement.</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoCircledIcon className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      <strong>Règles de passage :</strong><br />
                      • Moyenne ≥ 10/20 → <span className="text-emerald-600">Admis</span><br />
                      • 9,50 ≤ Moyenne &lt; 10 → <span className="text-amber-600">À délibérer</span><br />
                      • Moyenne &lt; 9,50 → <span className="text-red-600">Redoublant</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={studentRows}
              total={studentRows.length}
              page={1}
              limit={999}
              onPageChange={() => {}}
              getRowId={(row) => row.id}
              isLoading={studentsLoading}
              emptyMessage="Aucun élève trouvé"
            />
          </CardContent>
        </Card>
      )}

      {!selectedClassId && (
        <Card>
          <CardContent>
            <EmptyState
              title="Aucune classe sélectionnée"
              description="Choisissez une année et une classe pour lancer la délibération."
            />
          </CardContent>
        </Card>
      )}

      {selectedClassId && !studentsLoading && studentRows.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title="Aucun élève"
              description="Aucun élève trouvé dans cette classe."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
