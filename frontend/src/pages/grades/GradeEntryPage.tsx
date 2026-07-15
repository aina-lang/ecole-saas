import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Save, ArrowLeft } from 'lucide-react'

import { useLocalQuery, usePeriods } from '@/lib/db/hooks'
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Student, Subject } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'


interface ClassOption {
  id: string
  name: string
}

interface SubjectOption extends Subject {}

interface StudentGradeEntry {
  studentId: string
  studentName: string
  value: string
  comment: string
}

export function GradeEntryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [classId, setClassId] = useState<string>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [evaluationType, setEvaluationType] = useState<string>('')
  const [maxValue, setMaxValue] = useState<string>('20')
  const [coefficient, setCoefficient] = useState<string>('1')
  const [periodId, setPeriodId] = useState<string>('')
  const [entries, setEntries] = useState<StudentGradeEntry[]>([])
  const [submitting, setSubmitting] = useState(false)

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const { data: classes } = useLocalQuery<ClassOption>('Class')

  const { data: subjects } = useLocalQuery<SubjectOption>('Subject')

  const { periods, loading: loadingPeriods } = usePeriods()

  const selectedSubject = subjects?.find((s) => s.id === subjectId)

  useEffect(() => {
    if (selectedSubject?.coefficient) {
      setCoefficient(String(selectedSubject.coefficient))
    }
  }, [selectedSubject])

  useEffect(() => {
    if (periods.length > 0 && !periodId) {
      setPeriodId(periods[0].value)
    }
  }, [periods, periodId])

  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: async () => {
      if (!classId) return []
      return queryEntities<Student>('Student', { classId })
    },
    enabled: !!classId
  })

  useEffect(() => {
    if (students) {
      setEntries(
        students.map((s) => ({
          studentId: s.id,
          studentName: `${s.lastName} ${s.firstName}`,
          value: '',
          comment: ''
        }))
      )
    }
  }, [students])

  const setInputRef = useCallback((studentId: string, el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(studentId, el)
    } else {
      inputRefs.current.delete(studentId)
    }
  }, [])

  function handleValueChange(studentId: string, raw: string) {
    const sanitized = raw.replace(/[^0-9.]/g, '')
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, value: sanitized } : e))
    )
  }

  function handleCommentChange(studentId: string, comment: string) {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, comment } : e)))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < entries.length) {
        const next = entries[nextIndex]
        const nextInput = inputRefs.current.get(next.studentId)
        nextInput?.focus()
        nextInput?.select()
      }
    }
  }

  function validate(): boolean {
    const max = parseFloat(maxValue)
    if (!classId) {
      toast.error('Veuillez sélectionner une classe')
      return false
    }
    if (!subjectId) {
      toast.error('Veuillez sélectionner une matière')
      return false
    }
    if (!evaluationType) {
      toast.error("Veuillez sélectionner un type d'évaluation")
      return false
    }
    if (!max || max <= 0) {
      toast.error('La note maximale doit être supérieure à 0')
      return false
    }

    const hasValue = entries.some((e) => e.value !== '')
    if (!hasValue) {
      toast.error('Aucune note saisie')
      return false
    }

    for (const entry of entries) {
      if (entry.value === '') continue
      const val = parseFloat(entry.value)
      if (isNaN(val) || val < 0) {
        toast.error(`Note invalide pour ${entry.studentName}`)
        return false
      }
      if (val > max) {
        toast.error(`La note de ${entry.studentName} ne peut pas dépasser ${max}`)
        return false
      }
    }
    return true
  }

  async function handleSubmitAll() {
    if (!validate()) return
    setSubmitting(true)

    const gradeEntries = entries
      .filter((e) => e.value !== '')
      .map((e) => ({
        studentId: e.studentId,
        subjectId,
        value: parseFloat(e.value),
        maxValue: parseFloat(maxValue),
        coefficient: parseFloat(coefficient),
        evaluationType: evaluationType.toUpperCase(),
        periodId: periodId || undefined,
        comment: e.comment || undefined
      }))

    try {
      for (const entry of gradeEntries) {
        await saveEntity('Grade', entry)
      }
      toast.success(`${gradeEntries.length} note(s) enregistrée(s) avec succès`)
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      setEntries((prev) => prev.map((e) => ({ ...e, value: '', comment: '' })))
    } catch {
      toast.error("Erreur lors de l'enregistrement des notes")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Saisie de notes</h2>
          <p className="text-muted-foreground">Entrez les notes pour une classe et une matière.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/grades')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button onClick={handleSubmitAll} disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            {submitting ? 'Enregistrement...' : 'Tout valider'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paramètres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Combobox
                value={classId}
                onValueChange={setClassId}
                placeholder="Sélectionner"
                searchPlaceholder="Rechercher une classe..."
                options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Matière</Label>
              <Combobox
                value={subjectId}
                onValueChange={setSubjectId}
                placeholder="Sélectionner"
                searchPlaceholder="Rechercher une matière..."
                options={(subjects ?? []).map((s) => ({ value: s.id, label: formatSubjectLabel(s) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Combobox
                value={evaluationType}
                onValueChange={setEvaluationType}
                placeholder="Sélectionner"
                options={[
                  { value: 'exam', label: 'Examen' },
                  { value: 'test', label: 'Test' },
                  { value: 'homework', label: 'Devoir' },
                  { value: 'project', label: 'Projet' }
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note max</Label>
              <Input
                type="number"
                min="1"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coefficient</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={coefficient}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Période</Label>
              <Combobox
                value={periodId}
                onValueChange={setPeriodId}
                placeholder="Sélectionner"
                disabled={loadingPeriods}
                options={periods.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead className="w-40">Note / {maxValue}</TableHead>
                <TableHead className="w-60">Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!classId ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Sélectionnez une classe pour afficher les élèves.
                  </TableCell>
                </TableRow>
              ) : loadingStudents ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Chargement des élèves...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Aucun élève dans cette classe.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <TableRow key={entry.studentId}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">{entry.studentName}</TableCell>
                    <TableCell>
                      <Input
                        ref={(el) => setInputRef(entry.studentId, el)}
                        type="number"
                        min="0"
                        max={maxValue}
                        step="0.25"
                        placeholder={`0 - ${maxValue}`}
                        value={entry.value}
                        onChange={(e) => handleValueChange(entry.studentId, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className="h-9 w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Commentaire (optionnel)"
                        value={entry.comment}
                        onChange={(e) => handleCommentChange(entry.studentId, e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSubmitAll} disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            {submitting
              ? 'Enregistrement...'
              : `Tout valider (${entries.filter((e) => e.value !== '').length} notes)`}
          </Button>
        </div>
      )}
    </div>
  )
}
