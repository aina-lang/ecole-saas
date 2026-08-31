import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEntityById, queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { Class, Student, Subject, Teacher } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'
import { generateBulletinsByClass } from '@/lib/pdf/bulletin'

import { PageHeader, DetailHeader, EmptyState } from '@/components/layout/page'
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
import { Pencil2Icon, PlusIcon, TrashIcon, PersonIcon } from '@radix-ui/react-icons'
import { StudentPhoto } from '@/components/ui/student-photo'
import { ExportMenu } from '@/components/ui/export-menu'
import { exportClassStudents } from '@/lib/export/exporters'

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
    queryFn: async () => getEntityById<Class & { subjects?: Subject[]; teachers?: Teacher[] }>('Class', id!),
    enabled: !!id,
  })

  // Professeurs : déduits des fiches enseignant (classIds / classes), la
  // source que remplissent les formulaires — le document Classe ne porte
  // pas cette relation.
  const { data: classTeachers } = useQuery({
    queryKey: ['class-teachers', id],
    enabled: !!id,
    queryFn: async () => {
      const all = await queryEntities<any>('Teacher')
      return all.filter((t) => !t.deletedAt && ((t.classIds ?? []).includes(id) || (t.classes ?? []).some((c: any) => c.id === id)))
    },
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

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <PageHeader backTo="/classes" title="Classe introuvable" />
        <Card>
          <CardContent>
            <EmptyState
              title="Classe introuvable"
              description="Cette classe n'existe pas ou a été supprimée."
              action={
                <Button variant="outline" onClick={() => navigate('/classes')}>
                  Retour à la liste
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const studentsNotInClass =
    allStudents?.filter((s) => !students?.some((cs) => cs.id === s.id) && !s.classId) || []

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/classes"
        title="Fiche classe"
        description="Élèves, matières et professeurs de la classe"
        actions={
          <>
            <ExportMenu onExport={(format) => exportClassStudents(id!, format)} label="Exporter la liste" />
            <ExportMenu
              formats={['pdf', 'docx']}
              onExport={(format) => generateBulletinsByClass(id!, format)}
              label="Bulletins"
            />
            <Button onClick={() => navigate(`/classes/${id}/edit`)}>
              <Pencil2Icon className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </>
        }
      />

      <DetailHeader
        title={classData.name}
        badges={<Badge variant="secondary">{classData.level}</Badge>}
        meta={
          <>
            <span>Salle : {classData.room || 'Non définie'}</span>
            <span className="inline-flex items-center gap-1">
              <PersonIcon className="h-3.5 w-3.5" />
              {(students ?? []).length} / {classData.capacity} élèves
            </span>
          </>
        }
      />

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Élèves</TabsTrigger>
          <TabsTrigger value="subjects">Matières</TabsTrigger>
          <TabsTrigger value="teachers">Professeurs</TabsTrigger>
          <TabsTrigger value="schedule">Emploi du temps</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Liste des élèves ({students?.length ?? 0})</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
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
                    <TableHead className="w-12">Photo</TableHead>
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
                        <TableCell>
                          <StudentPhoto
                            src={(student as any).photoUrl}
                            alt={student.firstName || ''}
                            initials={`${(student.firstName?.[0] || '').toUpperCase()}${(student.lastName?.[0] || '').toUpperCase()}`}
                            className="h-9 w-9"
                            entityId={student.id}
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
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          icon={<PersonIcon className="h-5 w-5" />}
                          title="Aucun élève dans cette classe"
                          description="Ajoutez un élève existant ou créez-en un nouveau."
                        />
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
              <CardTitle className="text-base">Matières enseignées</CardTitle>
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
                <EmptyState
                  title="Aucune matière assignée"
                  description="Les matières rattachées à cette classe apparaîtront ici."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Professeurs</CardTitle>
            </CardHeader>
            <CardContent>
              {classTeachers && classTeachers.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {classTeachers.map((teacher: any) => {
                    const first = teacher.user_firstName ?? teacher.user?.firstName ?? ''
                    const last = teacher.user_lastName ?? teacher.user?.lastName ?? ''
                    const subjectNames = (teacher.subjects ?? []).map((s: any) => s.name).filter(Boolean)
                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => navigate(`/teachers/${teacher.id}`)}
                        className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {`${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{`${first} ${last}`.trim()}</p>
                          <p className="truncate text-xs text-muted-foreground">{teacher.specialty || subjectNames.join(', ') || 'Enseignant'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<PersonIcon className="h-5 w-5" />}
                  title="Aucun professeur assigné"
                  description="Assignez des professeurs depuis le formulaire de la classe."
                  action={
                    <Button variant="outline" size="sm" onClick={() => navigate(`/classes/${id}/edit`)}>
                      <Pencil2Icon className="mr-2 h-4 w-4" />
                      Modifier la classe
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emploi du temps</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Emploi du temps indisponible"
                description="L'emploi du temps de cette classe n'est pas encore disponible."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
