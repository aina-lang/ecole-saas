import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Class, Subject, Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Cross2Icon } from '@radix-ui/react-icons'

const classFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  level: z.string().min(1, 'Le niveau est requis'),
  room: z.string().optional(),
  capacity: z.coerce.number().min(1, 'La capacité minimale est 1'),
  subjectIds: z.array(z.string()).optional(),
  teacherIds: z.array(z.string()).optional()
})

type ClassFormValues = z.infer<typeof classFormSchema>

export function ClassFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const { data: classData } = useQuery({
    queryKey: ['class', id],
    queryFn: async () => {
      const { data } = await client.get(`/classes/${id}`)
      return data.data as Class & { subjectIds?: string[]; teacherIds?: string[] }
    },
    enabled: isEditing
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await client.get('/subjects')
      return data.data as Subject[]
    }
  })

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await client.get('/teachers')
      return data.data as Teacher[]
    }
  })

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      level: '',
      room: '',
      capacity: 30,
      subjectIds: [],
      teacherIds: []
    }
  })

  useEffect(() => {
    if (classData) {
      form.reset({
        name: classData.name,
        level: classData.level,
        room: classData.room || '',
        capacity: classData.capacity,
        subjectIds: classData.subjectIds || [],
        teacherIds: classData.teacherIds || []
      })
    }
  }, [classData, form])

  const createMutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      const { data } = await client.post('/classes', values)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Classe créée avec succès')
      navigate('/classes')
    },
    onError: () => {
      toast.error('Erreur lors de la création de la classe')
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      const { data } = await client.patch(`/classes/${id}`, values)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['class', id] })
      toast.success('Classe mise à jour avec succès')
      navigate('/classes')
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour')
    }
  })

  function onSubmit(values: ClassFormValues) {
    if (isEditing) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const selectedSubjectIds = form.watch('subjectIds') || []
  const selectedTeacherIds = form.watch('teacherIds') || []

  function toggleSubject(subjectId: string) {
    const current = form.getValues('subjectIds') || []
    const updated = current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId]
    form.setValue('subjectIds', updated)
  }

  function toggleTeacher(teacherId: string) {
    const current = form.getValues('teacherIds') || []
    const updated = current.includes(teacherId)
      ? current.filter((id) => id !== teacherId)
      : [...current, teacherId]
    form.setValue('teacherIds', updated)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEditing ? 'Modifier la classe' : 'Ajouter une classe'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Modifier les informations de cette classe'
              : 'Remplissez les informations pour créer une nouvelle classe'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/classes')}>
          Retour à la liste
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la classe *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: 6ème A" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un niveau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="6ème">6ème</SelectItem>
                        <SelectItem value="5ème">5ème</SelectItem>
                        <SelectItem value="4ème">4ème</SelectItem>
                        <SelectItem value="3ème">3ème</SelectItem>
                        <SelectItem value="2nde">2nde</SelectItem>
                        <SelectItem value="1ère">1ère</SelectItem>
                        <SelectItem value="Tle">Terminale</SelectItem>
                        <SelectItem value="CP">CP</SelectItem>
                        <SelectItem value="CE1">CE1</SelectItem>
                        <SelectItem value="CE2">CE2</SelectItem>
                        <SelectItem value="CM1">CM1</SelectItem>
                        <SelectItem value="CM2">CM2</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salle</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Bâtiment A, salle 12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacité maximale *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matières assignées</CardTitle>
            </CardHeader>
            <CardContent>
              {subjects && subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => {
                    const selected = selectedSubjectIds.includes(subject.id)
                    return (
                      <Badge
                        key={subject.id}
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer select-none"
                        onClick={() => toggleSubject(subject.id)}
                      >
                        {subject.name}
                        {selected && <Cross2Icon className="ml-1 h-3 w-3" />}
                      </Badge>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune matière disponible</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professeurs assignés</CardTitle>
            </CardHeader>
            <CardContent>
              {teachers && teachers.length > 0 ? (
                <div className="space-y-3">
                  {teachers.map((teacher) => {
                    const selected = selectedTeacherIds.includes(teacher.id)
                    return (
                      <div
                        key={teacher.id}
                        className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50"
                        onClick={() => toggleTeacher(teacher.id)}
                      >
                        <Checkbox checked={selected} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {teacher.user.firstName} {teacher.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{teacher.specialty}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun professeur disponible</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/classes')}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? 'Mettre à jour' : 'Créer la classe'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
