import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Class, Student, Subject, Teacher } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Pencil2Icon, ArrowLeftIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons'

export function ClassDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [removeStudentId, setRemoveStudentId] = useState<string | null>(null)

  const { data: classData, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: async () => {
      const { data } = await client.get(`/classes/${id}`)
      return (data.data ?? data) as Class & {
        subjects?: Subject[]
        teachers?: Teacher[]
      }
    }
  })

  const { data: students } = useQuery({
    queryKey: ['class-students', id],
    queryFn: async () => {
      const { data } = await client.get('/students', {
        params: { classId: id }
      })
      return (data.data ?? data) as Student[]
    },
    enabled: !!id
  })

  const { data: allStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      const { data } = await client.get('/students', {
        params: { limit: 100 }
      })
      return (data.data ?? data) as Student[]
    },
    enabled: addStudentOpen
  })

  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await client.post(`/classes/${id}/students`, { studentId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', id] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success('Élève ajouté à la classe')
      setAddStudentOpen(false)
      setSelectedStudentId('')
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de l'élève")
    }
  })

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await client.delete(`/classes/${id}/students/${studentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', id] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success('Élève retiré de la classe')
      setRemoveStudentId(null)
    },
    onError: () => toast.error("Erreur lors du retrait de l'élève")
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
        <Button onClick={() => navigate(`/classes/${id}/edit`)}>
          <Pencil2Icon className="mr-2 h-4 w-4" />
          Modifier
        </Button>
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
              <CardTitle>Liste des élèves</CardTitle>
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
                        label: `${student.firstName} ${student.lastName} (${student.registrationNumber})`,
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
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
                        <TableCell className="font-medium">{student.registrationNumber}</TableCell>
                        <TableCell>{student.lastName}</TableCell>
                        <TableCell>{student.firstName}</TableCell>
                        <TableCell>
                          <ConfirmDialog
                            open={removeStudentId === student.id}
                            onOpenChange={(open) => !open && setRemoveStudentId(null)}
                            onConfirm={() => removeStudentMutation.mutate(student.id)}
                            title="Retirer l'élève"
                            description={`Êtes-vous sûr de vouloir retirer ${student.firstName} ${student.lastName} de cette classe ?`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoveStudentId(student.id)}
                          >
                            <Cross2Icon className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Aucun élève dans cette classe
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
