import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import { setTenantSetting } from '@/lib/tenant-settings'
import type { Student, Level, AcademicYear, StudentEnrollment } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader, InfoGrid, EmptyState } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'

export function RolloverPage() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [maxProgress, setMaxProgress] = useState(0)
  const [summary, setSummary] = useState<{
    admis: number
    redoublants: number
    exclus: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: currentYear, isLoading: yearLoading } = useQuery({
    queryKey: ['academic-year'],
    queryFn: async () => {
      const years = await queryEntities<AcademicYear>('AcademicYear' as any)
      return years?.find((y) => y.isCurrent) ?? null
    },
  })

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => queryEntities<Student>('Student'),
  })

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: () => queryEntities<Level>('Level' as any),
  })

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () =>
      queryEntities<StudentEnrollment>('StudentEnrollment' as any),
  })

  const currentEnrollments = useMemo(
    () =>
      currentYear
        ? enrollments.filter(
            (e) =>
              e.academicYearId === currentYear.id && e.promotionDecision,
          )
        : [],
    [enrollments, currentYear],
  )

  const stats = useMemo(
    () => ({
      admis: currentEnrollments.filter(
        (e) => e.promotionDecision === 'ADMIS',
      ).length,
      redoublants: currentEnrollments.filter(
        (e) => e.promotionDecision === 'REDOUBLANT',
      ).length,
      exclus: currentEnrollments.filter(
        (e) => e.promotionDecision === 'EXCLU',
      ).length,
    }),
    [currentEnrollments],
  )

  const handleRollover = async () => {
    // L'écran ne s'affiche pas sans année courante (garde plus bas), mais le
    // compilateur ne relie pas les deux : garde explicite avant d'y toucher.
    if (!currentYear) return
    setRunning(true)
    setError(null)
    setSummary(null)
    setProgress(0)

    try {
      const label = currentYear.label || (currentYear as any).name || ''
      const [startStr, endStr] = label.split('-')
      const startYear = parseInt(startStr, 10)
      const endYear = parseInt(endStr, 10)
      const newYearId = crypto.randomUUID()

      const total =
        currentEnrollments.length + 1
      setMaxProgress(total)
      let step = 0

      for (const enrollment of currentEnrollments) {
        const student = students.find(
          (s) => s.id === enrollment.studentId,
        )

        if (enrollment.promotionDecision === 'ADMIS') {
          const level = levels.find(
            (l) => l.id === enrollment.levelId,
          )
          const nextLevelId = level?.nextLevelId || enrollment.levelId

          await saveEntity('StudentEnrollment' as any, {
            id: crypto.randomUUID(),
            studentId: enrollment.studentId,
            academicYearId: newYearId,
            levelId: nextLevelId,
            classId: null,
            reinscriptionStatus: 'PRE_INSCRIT',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })

          if (student) {
            await saveEntity('Student', {
              ...student,
              classId: '',
            })
          }
        } else if (enrollment.promotionDecision === 'REDOUBLANT') {
          await saveEntity('StudentEnrollment' as any, {
            id: crypto.randomUUID(),
            studentId: enrollment.studentId,
            academicYearId: newYearId,
            levelId: enrollment.levelId,
            classId: null,
            reinscriptionStatus: 'PRE_INSCRIT',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        } else if (enrollment.promotionDecision === 'EXCLU') {
          await saveEntity('StudentEnrollment' as any, {
            id: crypto.randomUUID(),
            studentId: enrollment.studentId,
            academicYearId: newYearId,
            levelId: enrollment.levelId,
            classId: null,
            promotionDecision: 'EXCLU',
            reinscriptionStatus: 'BLOQUE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }

        step++
        setProgress(step)
      }

      const yearLabel = `${startYear + 1}-${endYear + 1}`
      const yearStartDate = `${startYear + 1}-09-01`
      const yearEndDate = `${endYear + 1}-08-31`
      const newYear = {
        id: newYearId,
        label: yearLabel,
        startDate: yearStartDate,
        endDate: yearEndDate,
        isCurrent: true,
      }
      // Même forme que SettingsPage.tsx/OnboardingPage.tsx (name, pas label) —
      // c'est ce que academicForm/usePeriods relisent.
      await setTenantSetting(
        'academic_year',
        JSON.stringify({ name: yearLabel, startDate: yearStartDate, endDate: yearEndDate }),
      )
      await saveEntity('AcademicYear' as any, newYear)

      step++
      setProgress(step)
      setSummary({
        admis: stats.admis,
        redoublants: stats.redoublants,
        exclus: stats.exclus,
      })
      toast.success('Rentrée préparée avec succès')
    } catch (err: any) {
      const msg = err?.message || 'Une erreur est survenue'
      setError(msg)
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  if (yearLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Chargement…
      </div>
    )
  }

  if (!currentYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Gestion des rentrées"
          description="Clôture d'une année scolaire et préparation de la suivante"
        />
        <Alert>
          <AlertTitle>Aucune année scolaire</AlertTitle>
          <AlertDescription>
            Aucune année scolaire n'est configurée. Veuillez d'abord créer une
            année scolaire dans les paramètres.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const hasPromotions = currentEnrollments.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des rentrées"
        description="Clôture d'une année scolaire et préparation de la suivante"
        actions={
          <Button
            onClick={handleRollover}
            disabled={running || !hasPromotions}
          >
            {running
              ? 'Traitement en cours…'
              : "Clôturer l'année et préparer la rentrée"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Année scolaire en cours</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoGrid
            columns={3}
            items={[
              { label: 'Libellé', value: currentYear.label || (currentYear as any).name },
              { label: 'Début', value: currentYear.startDate },
              { label: 'Fin', value: currentYear.endDate },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Décisions d'orientation</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasPromotions ? (
            <EmptyState
              title="Aucune décision"
              description="Aucune décision d'orientation n'a encore été enregistrée pour cette année."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['Admis', stats.admis, 'text-emerald-700 dark:text-emerald-400'],
                ['Redoublants', stats.redoublants, 'text-amber-600 dark:text-amber-400'],
                ['Exclus', stats.exclus, 'text-red-600 dark:text-red-400'],
                ['Effectif total', currentEnrollments.length, 'text-foreground'],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {running && maxProgress > 0 && (
        <div className="space-y-2">
          <Progress value={(progress / maxProgress) * 100} />
          <p className="text-sm text-muted-foreground">
            {progress} / {maxProgress} étapes
          </p>
        </div>
      )}

      {summary && (
        <Alert>
          <AlertTitle>Rentrée préparée</AlertTitle>
          <AlertDescription>
            {summary.admis} admis, {summary.redoublants} redoublants,{' '}
            {summary.exclus} exclus
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
