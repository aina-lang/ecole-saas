import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { getEntityById, saveEntity } from '@/lib/db/pouchdb-compat'
import { useLocalQuery } from '@/lib/db/hooks'
import { LEVELS } from '@/lib/levels'
import type { Class, Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'

const classFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  level: z.string().min(1, 'Le niveau est requis'),
  room: z.string().optional(),
  capacity: z.coerce.number().min(1, 'La capacité minimale est 1'),
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
      return getEntityById<Class & { teacherIds?: string[] }>('Class', id!)
    },
    enabled: isEditing
  })

  const { data: teachers } = useLocalQuery<Teacher>('Teacher')

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      level: '',
      room: '',
      capacity: 30,
      teacherIds: []
    }
  })

  useEffect(() => {
    if (classData) {
      const teacherIds = (classData.teachers ?? []).map((t: any) => t.id)
      form.reset({
        name: classData.name,
        level: classData.level,
        room: classData.room || '',
        capacity: classData.capacity,
        teacherIds
      })
      setSelectedTeacherIds(teacherIds)
    }
  }, [classData])

  const createMutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      await saveEntity('Class', values)
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
      await saveEntity('Class', { ...values, id })
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
    const data = {
      ...values,
      teacherIds: selectedTeacherIds,
    }
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])

  function toggleTeacher(teacherId: string) {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    )
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
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
                    <FormControl>
                      <Combobox
                        options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Sélectionner un niveau"
                        className="w-full"
                      />
                    </FormControl>
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
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleTeacher(teacher.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                            {(teacher as any).user_firstName || (teacher as any).user?.firstName || ''} {(teacher as any).user_lastName || (teacher as any).user?.lastName || ''}
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
