import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import { setTenantSetting } from '@/lib/tenant-settings'
import type { Student, Level, AcademicYear, StudentEnrollment } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'

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
            classId: '',
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
            classId: '',
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
            classId: '',
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Gestion des rentrées
          </h2>
          <p className="text-muted-foreground">
            Clôture d'une année scolaire et préparation de la suivante
          </p>
        </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Année scolaire en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p>
            <span className="font-medium">Libellé :</span>{' '}
            {currentYear.label || (currentYear as any).name}
          </p>
          <p>
            <span className="font-medium">Début :</span>{' '}
            {currentYear.startDate}
          </p>
          <p>
            <span className="font-medium">Fin :</span>{' '}
            {currentYear.endDate}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Décisions d'orientation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPromotions ? (
            <p className="text-sm text-muted-foreground">
              Aucune décision d'orientation n'a encore été enregistrée pour
              cette année.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admis</TableHead>
                  <TableHead>Redoublants</TableHead>
                  <TableHead>Exclus</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-green-600 font-medium">
                    {stats.admis}
                  </TableCell>
                  <TableCell className="text-amber-600 font-medium">
                    {stats.redoublants}
                  </TableCell>
                  <TableCell className="text-red-600 font-medium">
                    {stats.exclus}
                  </TableCell>
                  <TableCell className="font-medium">
                    {currentEnrollments.length}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          <Button
            onClick={handleRollover}
            disabled={running || !hasPromotions}
            className="w-full sm:w-auto"
          >
            {running
              ? 'Traitement en cours…'
              : "Clôturer l'année et préparer la rentrée"}
          </Button>
        </CardContent>
      </Card>

      {running && maxProgress > 0 && (
        <div className="space-y-2">
          <Progress value={(progress / maxProgress) * 100} />
          <p className="text-sm text-muted-foreground text-center">
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
