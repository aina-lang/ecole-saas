import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { getEntityById, saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { ArrowLeftIcon, ReloadIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons'

const parentSchema = z.object({
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  isActive: z.boolean(),
})

type ParentFormValues = z.infer<typeof parentSchema>

export function ParentEditPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [editPhones, setEditPhones] = useState<string[]>([''])

  const { data: parent, isLoading: loadingParent } = useQuery({
    queryKey: ['parent', id],
    queryFn: async () => {
      const doc = await getEntityById<any>('User', id)
      return doc ?? null
    },
  })

  const { data: allStudents } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const docs = await queryEntities<Student>('Student')
      return docs ?? []
    },
  })

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (parent) {
      const phones = parent.phones?.map((p: any) => p.value) ?? (parent.phone ? [parent.phone] : [''])
      form.reset({
        firstName: parent.firstName || '',
        lastName: parent.lastName || '',
        email: parent.email || '',
        isActive: parent.isActive ?? true,
      })
      setEditPhones(phones.length ? phones : [''])
      const linked = (allStudents ?? []).filter((s) =>
        (s as any).parents?.some((p: any) => p.parentId === id || p.parent?.id === id)
      )
      setSelectedStudentIds(linked.map((s) => s.id))
    }
  }, [parent, allStudents, id, form])

  const updateMutation = useMutation({
    mutationFn: async (values: ParentFormValues) => {
      if (!id) return
      const phones = editPhones.map((p) => p.trim()).filter(Boolean)
      await saveEntity('User', {
        ...parent,
        id,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || null,
        phone: phones[0] || null,
        phones: phones.length > 0 ? phones.map((v, i) => ({ value: v, sortOrder: i })) : undefined,
        role: 'PARENT',
        isActive: values.isActive,
      })
      const currentlyLinked = (allStudents ?? []).filter((s) =>
        (s as any).parents?.some((p: any) => p.parentId === id || p.parent?.id === id)
      )
      const toUnlink = currentlyLinked.filter((s) => !selectedStudentIds.includes(s.id))
      const toLink = selectedStudentIds.filter(
        (sid) => !currentlyLinked.some((cl) => cl.id === sid)
      )
      for (const student of toUnlink) {
        await saveEntity('Student', {
          ...student,
          parents: (student as any).parents?.filter(
            (p: any) => p.parentId !== id && p.parent?.id !== id
          ) ?? [],
        })
      }
      for (const studentId of toLink) {
        const student = allStudents?.find((s) => s.id === studentId)
        if (student) {
          const parents = Array.isArray((student as any).parents) ? (student as any).parents : []
          await saveEntity('Student', {
            ...student,
            parents: [
              ...parents,
              { parentId: id, relation: 'PARENT', isPrimary: parents.length === 0 },
            ],
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] })
      queryClient.invalidateQueries({ queryKey: ['parent', id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Parent mis à jour')
      navigate(`/parents/${id}`)
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  function onSubmit(values: ParentFormValues) {
    updateMutation.mutate(values)
  }

  if (loadingParent) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!parent) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Parent introuvable</p>
        <Button variant="outline" onClick={() => navigate('/parents')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/parents/${id}`)}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Modifier le parent</h2>
          <p className="text-muted-foreground">{parent.firstName} {parent.lastName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input placeholder="Prénom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemple.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Téléphone (max 3)</label>
                {editPhones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="+261 ..."
                      value={phone}
                      onChange={(e) =>
                        setEditPhones((prev) => {
                          const next = [...prev]
                          next[index] = e.target.value
                          return next
                        })
                      }
                    />
                    {editPhones.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setEditPhones((prev) => {
                            const next = prev.filter((_, i) => i !== index)
                            return next.length ? next : ['']
                          })
                        }
                      >
                        <Cross2Icon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {editPhones.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditPhones((prev) => [...prev, ''])}
                  >
                    <PlusIcon className="mr-1 h-4 w-4" />
                    Ajouter un numéro
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'true', label: 'Actif' },
                          { value: 'false', label: 'Inactif' },
                        ]}
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(v === 'true')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Élèves liés</label>
                <Combobox
                  options={(allStudents ?? [])
                    .filter((s) => !selectedStudentIds.includes(s.id))
                    .map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedStudentIds.includes(value)) {
                      setSelectedStudentIds((prev) => [...prev, value])
                    }
                  }}
                  placeholder="Rechercher un élève..."
                  searchPlaceholder="Taper le nom..."
                  emptyText="Aucun élève trouvé"
                />
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedStudentIds.map((sid) => {
                      const s = allStudents?.find((st) => st.id === sid)
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs font-medium"
                        >
                          {s ? `${s.firstName} ${s.lastName}` : sid}
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds((prev) => prev.filter((id) => id !== sid))}
                            className="ml-0.5 text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? (
                    <>
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/parents/${id}`)}>
                  Annuler
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
