import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, queryEntities, getEntityById } from '@/lib/db/pouchdb-compat'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

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
import { PlusIcon, Cross2Icon, ArrowLeftIcon, ReloadIcon } from '@radix-ui/react-icons'
import { PhotoUpload } from '@/components/ui/photo-upload'

const parentSchema = z.object({
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
})

type ParentFormValues = z.infer<typeof parentSchema>

export function ParentFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [npPhones, setNpPhones] = useState<string[]>([''])
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)

  const { data: students } = useLocalQuery<Student>('Student')

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: ParentFormValues) => {
      const userId = crypto.randomUUID()
      const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('tenantId') : null
      
      const phones = npPhones.map((p) => p.trim()).filter(Boolean)
      await saveEntity('User', {
        id: userId,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || null,
        phone: phones[0] || null,
        phones: phones.length > 0 ? phones.map((v, i) => ({ value: v, sortOrder: i })) : undefined,
        role: 'PARENT',
        tenantId,
        isActive: true,
      })

      for (const studentId of selectedStudentIds) {
        const existing = await queryEntities<any>('Student', { id: studentId })
        const student = existing.find((s) => s.id === studentId) || { id: studentId, parents: [] }
        const parents = Array.isArray(student.parents) ? student.parents : []
        await saveEntity('Student', {
          ...student,
          parents: [
            ...parents,
            {
              parentId: userId,
              relation: 'PARENT',
              isPrimary: parents.length === 0,
            },
          ],
        })
      }

      if (pendingPhoto) {
        const api = window.api
        if (api?.file) {
          const buffer = await pendingPhoto.arrayBuffer()
          const result = await api.file.save({
            buffer, entityType: 'User', entityId: userId,
            fieldName: 'photo_url', originalName: pendingPhoto.name, mimeType: pendingPhoto.type,
          })
          const localUrl = await api.file.getUrl((result as any).local_path)
          if (localUrl) {
            const existing = await getEntityById<any>('User', userId)
            if (existing) {
              await saveEntity('User', { ...existing, photoUrl: localUrl })
            }
          }
        }
        setPendingPhoto(null)
      }

      return userId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] })
      toast.success('Parent créé avec succès')
      navigate('/parents')
    },
    onError: () => toast.error('Erreur lors de la création du parent'),
  })

  function onSubmit(values: ParentFormValues) {
    createMutation.mutate({ ...values, studentIds: selectedStudentIds })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parents')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nouveau parent / tuteur</h2>
          <p className="text-muted-foreground">Créer un compte parent et lier à des élèves</p>
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
                      <FormLabel>Prénom *</FormLabel>
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

              <PhotoUpload
                src={null}
                firstName={form.watch('firstName')}
                lastName={form.watch('lastName')}
                onUpload={async (file) => {
                  setPendingPhoto(file)
                  return { url: '' }
                }}
                onDelete={undefined}
              />

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
                {npPhones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="+261 ..."
                      value={phone}
                      onChange={(e) =>
                        setNpPhones((prev) => {
                          const next = [...prev]
                          next[index] = e.target.value
                          return next
                        })
                      }
                    />
                    {npPhones.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setNpPhones((prev) => {
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
                {npPhones.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNpPhones((prev) => [...prev, ''])}
                  >
                    <PlusIcon className="mr-1 h-4 w-4" />
                    Ajouter un numéro
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Élèves à lier (optionnel)</label>
                <Combobox
                  options={(students ?? [])
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
                      const s = students?.find((st) => st.id === sid)
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
                <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? (
                    <>
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer le compte parent'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/parents')}>
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