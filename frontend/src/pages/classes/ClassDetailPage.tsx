import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Class, Student, Subject, Teacher } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Pencil2Icon, ArrowLeftIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'

async function generateBulletinHtml(classId: string): Promise<string> {
  const [classData, students, grades, subjects] = await Promise.all([
    getEntityById<any>('Class', classId),
    queryEntities<any>('Student', { classId }),
    queryEntities<any>('Grade'),
    queryEntities<any>('Subject'),
  ])

  const gradeMap: Record<string, any[]> = {}
  for (const g of grades) {
    if (!gradeMap[g.studentId]) gradeMap[g.studentId] = []
    gradeMap[g.studentId].push(g)
  }
  const subjectMap: Record<string, any> = {}
  for (const s of subjects) subjectMap[s.id] = s

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bulletins - ${classData?.name || ''}</title>
<style>
  @page { margin: 15mm; }
  body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; color: #333; }
  .bulletin { page-break-after: always; max-width: 800px; margin: 0 auto 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
  h1 { text-align: center; color: #1a365d; font-size: 22px; margin-bottom: 5px; }
  .school { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
  .student-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f7fafc; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th { background: #edf2f7; font-weight: 600; color: #2d3748; }
  .footer { text-align: center; color: #a0aec0; font-size: 11px; margin-top: 30px; }
  .average { text-align: right; font-weight: bold; font-size: 16px; margin-top: 15px; padding: 10px; background: #ebf8ff; border-radius: 6px; }
</style></head><body>`

  for (const student of (students ?? [])) {
    const studentGrades = gradeMap[student.id] || []
    const avg = studentGrades.length > 0
      ? (studentGrades.reduce((s, g) => s + (g.value || 0) * (g.coefficient || 1), 0) /
         studentGrades.reduce((s, g) => s + (g.coefficient || 1), 0)).toFixed(2)
      : '—'

    html += `<div class="bulletin">
      <h1>Bulletin de Notes</h1>
      <div class="school">${classData?.name || ''} — Année scolaire ${new Date().getFullYear()}/${new Date().getFullYear() + 1}</div>
      <div class="student-info">
        <div><strong>Élève :</strong> ${student.firstName || ''} ${student.lastName || ''}</div>
        <div><strong>Matricule :</strong> ${student.registrationNumber || '—'}</div>
      </div>
      <table><thead><tr><th>Matière</th><th>Note</th><th>Coeff.</th><th>Moyenne</th></tr></thead><tbody>`

    const bySubject: Record<string, { values: number[]; coeff: number }> = {}
    for (const g of studentGrades) {
      if (!bySubject[g.subjectId]) bySubject[g.subjectId] = { values: [], coeff: g.coefficient || 1 }
      bySubject[g.subjectId].values.push(g.value || 0)
    }

    for (const [subjId, data] of Object.entries(bySubject)) {
      const subj = subjectMap[subjId]
      const subjAvg = (data.values.reduce((a, b) => a + b, 0) / data.values.length).toFixed(2)
      html += `<tr><td>${subj?.name || subjId}</td><td>${data.values.join(', ')}</td><td>${data.coeff}</td><td><strong>${subjAvg}</strong></td></tr>`
    }

    html += `</tbody></table>
      <div class="average">Moyenne générale : <strong>${avg}/20</strong></div>
      <div class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')} · École SaaS</div>
    </div>`
  }

  html += '</body></html>'
  return html
}

export function ClassDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [removeStudentId, setRemoveStudentId] = useState<string | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)

  const { data: classData, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: async () => getEntityById<Class & { subjects?: Subject[]; teachers?: Teacher[] }>('Class', id)
  })

  const { data: students } = useQuery({
    queryKey: ['class-students', id],
    queryFn: async () => queryEntities<Student>('Student', { classId: id }),
    enabled: !!id
  })

  const { data: allStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => queryEntities<Student>('Student'),
    enabled: addStudentOpen
  })

  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await saveEntity('Student', { id: studentId, classId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', id] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success('Élève ajouté à la classe (mode hors-ligne)')
      setAddStudentOpen(false)
      setSelectedStudentId('')
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de l'élève")
    }
  })

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await saveEntity('Student', { id: studentId, classId: null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', id] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success('Élève retiré de la classe (mode hors-ligne)')
      setRemoveStudentId(null)
    },
    onError: () => toast.error("Erreur lors du retrait de l'élève")
  })

  const bulkRemoveMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      for (const sid of studentIds) {
        await saveEntity('Student', { id: sid, classId: null })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', id] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success(`${selectedRowIds.size} élève(s) retiré(s) de la classe`)
      setSelectedRowIds(new Set())
      setBulkRemoveOpen(false)
    },
    onError: () => toast.error("Erreur lors du retrait en masse des élèves")
  })

  function toggleSelectAll() {
    if (selectedRowIds.size === (students?.length ?? 0)) {
      setSelectedRowIds(new Set())
    } else {
      setSelectedRowIds(new Set((students ?? []).map((s) => s.id)))
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generateBulletinsMutation = useMutation({
    mutationFn: async () => {
      const html = await generateBulletinHtml(id!)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      window.URL.revokeObjectURL(url)
      return true
    },
    onSuccess: () => {
      toast.success('Bulletins générés (consultez le nouvel onglet)')
    },
    onError: () => toast.error('Erreur lors de la génération des bulletins')
  })

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Classe introuvable</p>
        <Button variant="outline" onClick={() => navigate('/classes')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  const studentsNotInClass =
    allStudents?.filter((s) => !students?.some((cs) => cs.id === s.id) && !s.classId) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/classes')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate(`/classes/${id}/edit`)}>
            <Pencil2Icon className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button
            variant="outline"
            onClick={() => generateBulletinsMutation.mutate()}
            disabled={generateBulletinsMutation.isPending}
          >
            {generateBulletinsMutation.isPending ? 'Génération...' : 'Générer les bulletins'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{classData.name}</h3>
                <Badge variant="secondary">{classData.level}</Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Salle: {classData.room || 'Non définie'}</span>
                <span>
                  Capacité: {classData.studentCount || 0}/{classData.capacity}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Élèves</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
          <TabsTrigger value="teachers">Professeurs</TabsTrigger>
          <TabsTrigger value="schedule">Emploi du temps</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Liste des élèves ({students?.length ?? 0})</CardTitle>
              <div className="flex items-center gap-2">
                {selectedRowIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkRemoveOpen(true)}
                  >
                    <TrashIcon className="mr-2 h-4 w-4" />
                    Retirer ({selectedRowIds.size})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/students/new?classId=${id}`)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Nouvel élève
                </Button>
                <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Ajouter un élève
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un élève à la classe</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Combobox
                      value={selectedStudentId}
                      onValueChange={setSelectedStudentId}
                      placeholder="Sélectionner un élève"
                      searchPlaceholder="Rechercher un élève..."
                       options={studentsNotInClass.map((student) => ({
                         value: student.id,
                         label: `${student.firstName ? `${student.firstName} ` : ''}${student.lastName} (${student.registrationNumber})`,
                       }))}
                    />
                    <Button
                      className="w-full"
                      disabled={!selectedStudentId || addStudentMutation.isPending}
                      onClick={() => addStudentMutation.mutate(selectedStudentId)}
                    >
                      Ajouter
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRowIds.size > 0 && selectedRowIds.size === (students?.length ?? 0)}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students && students.length > 0 ? (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRowIds.has(student.id)}
                            onCheckedChange={() => toggleSelectOne(student.id)}
                            aria-label={`Sélectionner ${student.firstName ? `${student.firstName} ` : ''}${student.lastName}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{student.registrationNumber}</TableCell>
                        <TableCell>{student.lastName}</TableCell>
                        <TableCell>{student.firstName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/students/${student.id}/edit`)}
                            >
                              <Pencil2Icon className="h-4 w-4" />
                            </Button>
                            <ConfirmDialog
                              open={removeStudentId === student.id}
                              onOpenChange={(open) => !open && setRemoveStudentId(null)}
                              onConfirm={() => removeStudentMutation.mutate(student.id)}
                              title="Retirer l'élève"
                              description={`Êtes-vous sûr de vouloir retirer ${student.firstName ? `${student.firstName} ` : ''}${student.lastName} de cette classe ?`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemoveStudentId(student.id)}
                            >
                              <TrashIcon className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Aucun élève dans cette classe
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <ConfirmDialog
            open={bulkRemoveOpen}
            onOpenChange={setBulkRemoveOpen}
            onConfirm={() => bulkRemoveMutation.mutate(Array.from(selectedRowIds))}
            title={`Retirer ${selectedRowIds.size} élève(s)`}
            description={`Êtes-vous sûr de vouloir retirer ${selectedRowIds.size} élève(s) de cette classe ? Cette action peut être annulée en les réajoutant.`}
          />
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Matières enseignées</CardTitle>
            </CardHeader>
            <CardContent>
              {classData.subjects && classData.subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {classData.subjects.map((subject) => (
                    <Badge key={subject.id} variant="secondary">
                      {formatSubjectLabel(subject)} (Coeff: {subject.coefficient})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune matière assignée à cette classe
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Professeurs</CardTitle>
            </CardHeader>
            <CardContent>
              {classData.teachers && classData.teachers.length > 0 ? (
                <div className="space-y-3">
                  {classData.teachers.map((teacher) => (
                    <div key={teacher.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {teacher.user.firstName} {teacher.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{teacher.specialty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun professeur assigné à cette classe
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Emploi du temps</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                L'emploi du temps n'est pas encore disponible
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
