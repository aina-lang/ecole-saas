import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { getDocument, putDocument } from '@/lib/db/pouchdb'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity } from '@/lib/db/pouchdb-compat'
import type { Subject } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { PlusIcon, Cross2Icon } from '@radix-ui/react-icons'
import { PhotoUpload } from '@/components/ui/photo-upload'

interface Option {
  id: string
  name: string
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  if (!options.length) {
    return <p className="text-xs text-muted-foreground">Aucune option disponible.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id)
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() =>
              onChange(active ? selected.filter((i) => i !== opt.id) : [...selected, opt.id])
            }
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent')
            }
          >
            {opt.name}
          </button>
        )
      })}
      {!selected.length && (
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      )}
    </div>
  )
}

const userFormSchema = z.object({
  email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Le nom est requis'),
  role: z.enum(['ADMIN', 'TEACHER', 'SECRETARY', 'PARENT']),
  password: z.string().min(6, 'Minimum 6 caractères').optional().or(z.literal('')),
  specialty: z.string().optional().or(z.literal(''))
})

type UserFormValues = z.infer<typeof userFormSchema>

export function UserFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const [phoneInputs, setPhoneInputs] = useState<string[]>([''])
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([])
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)

  const { data: classes } = useLocalQuery<Option>('Class')

  const { data: subjects } = useLocalQuery<Option>('Subject')

  const { data: user } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      return getEntityById<any>('User', id!)
    },
    enabled: isEditing
  })

  const defaultPassword = Math.random().toString(36).slice(2, 10)

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'TEACHER',
      password: isEditing ? '' : defaultPassword,
      specialty: ''
    }
  })

  const watchedRole = form.watch('role')

  const { data: teacherDetail } = useQuery({
    queryKey: ['teacher-detail', user?.teacher?.id],
    queryFn: async () => {
      if (!user?.teacher?.id) return null
      return getEntityById<any>('Teacher', user.teacher.id)
    },
    enabled: isEditing && !!user?.teacher?.id
  })

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) {
        setPendingPhoto(file)
        return { url: '' }
      }
      const api = window.api
      if (api?.file) {
        const buffer = await file.arrayBuffer()
        const result = await api.file.save({
          buffer,
          entityType: 'User',
          entityId: id,
          fieldName: 'photo_url',
          originalName: file.name,
          mimeType: file.type,
        })
        const localUrl = await api.file.getUrl(result.localPath)
        const existing = await getDocument('User', id)
        if (existing) {
          await putDocument('User', { ...existing, photoUrl: localUrl })
        }
        return { url: localUrl || '' }
      }
      return { url: '' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
  })

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null
      const existing = await getDocument('User', id)
      if (existing) {
        await putDocument('User', { ...existing, photoUrl: null })
      }
      return { success: true }
    },
    onSuccess: () => {
      if (!id) return
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        password: '',
        specialty: user.teacher?.specialty || ''
      })
      const parts = (user.phones ?? []).map((p: { value: string }) => p.value.trim()).filter(Boolean)
      setPhoneInputs(parts.length ? parts : [''])
    }
  }, [user, form])

  useEffect(() => {
    if (teacherDetail) {
      form.setValue('specialty', teacherDetail.specialty ?? '')
      setTeacherClassIds((teacherDetail.classes ?? []).map((c: { id: string }) => c.id))
      setTeacherSubjectIds((teacherDetail.subjects ?? []).map((s: { id: string }) => s.id))
    }
  }, [teacherDetail, form])

  function syncPhoneValue(inputs: string[]) {
    return inputs.map((p) => p.trim()).filter(Boolean)
  }

  function updatePhoneInput(index: number, value: string) {
    setPhoneInputs((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function addPhoneInput() {
    setPhoneInputs((prev) => (prev.length < 3 ? [...prev, ''] : prev))
  }

  function removePhoneInput(index: number) {
    setPhoneInputs((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : ['']
    })
  }

  const createMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const localId = crypto.randomUUID()
      const phones = syncPhoneValue(phoneInputs)
      const payload: Record<string, unknown> = {
        id: localId,
        lastName: values.lastName,
        phones
      }
      if (values.firstName) payload.firstName = values.firstName
      if (values.email) payload.email = values.email
      if (values.password) payload.password = values.password
      if (values.role === 'TEACHER') {
        await saveEntity('User', {
          ...payload,
          role: values.role
        })
        await saveEntity('Teacher', {
          ...payload,
          specialty: values.specialty || undefined,
          classIds: teacherClassIds,
          subjectIds: teacherSubjectIds
        })
      } else {
        await saveEntity('User', {
          ...payload,
          role: values.role
        })
      }
      if (pendingPhoto) {
        const api = window.api
        if (api?.file) {
          try {
            const buffer = await pendingPhoto.arrayBuffer()
            const result = await api.file.save({
              buffer,
              entityType: 'User',
              entityId: localId,
              fieldName: 'photo_url',
              originalName: pendingPhoto.name,
              mimeType: pendingPhoto.type,
            })
            const localUrl = await api.file.getUrl(result.localPath)
            const existing = await getDocument('User', localId)
            if (existing) {
              await putDocument('User', { ...existing, photoUrl: localUrl })
            }
          } catch { /* ok */ }
        }
        setPendingPhoto(null)
      }
      return localId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Utilisateur créé avec succès')
      navigate('/administration/users')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la création de l\'utilisateur'
      toast.error(Array.isArray(msg) ? msg[0] : msg)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const phones = syncPhoneValue(phoneInputs)
      const payload: Record<string, unknown> = {
        id,
        lastName: values.lastName,
        phones
      }
      if (values.firstName) payload.firstName = values.firstName
      if (values.email) payload.email = values.email
      if (values.password) payload.password = values.password
      if (values.role === 'TEACHER') {
        await saveEntity('User', {
          ...payload,
          role: values.role
        })
        await saveEntity('Teacher', {
          ...payload,
          id: user.teacher.id,
          specialty: values.specialty || undefined,
          classIds: teacherClassIds,
          subjectIds: teacherSubjectIds
        })
      } else {
        await saveEntity('User', {
          ...payload,
          role: values.role
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      toast.success('Utilisateur modifié avec succès')
      navigate('/administration/users')
    },
    onError: () => {
      toast.error('Erreur lors de la modification de l\'utilisateur')
    }
  })

  function onSubmit(values: UserFormValues) {
    if (isEditing) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isTeacher = watchedRole === 'TEACHER'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Modifier les informations de cet utilisateur'
              : 'Créez un nouveau compte utilisateur'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/administration/users')}>
          Retour à la liste
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoUpload
                src={user?.photoUrl}
                firstName={user?.firstName}
                lastName={user?.lastName}
                onUpload={(file) => photoMutation.mutateAsync(file)}
                onDelete={() => deletePhotoMutation.mutateAsync()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de famille" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email{watchedRole !== 'PARENT' ? ' *' : ''}</FormLabel>
                    <FormControl>
                      <Input placeholder="email@exemple.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'ADMIN', label: 'Administrateur' },
                          { value: 'TEACHER', label: 'Enseignant' },
                          { value: 'SECRETARY', label: 'Secrétaire' },
                          { value: 'PARENT', label: 'Parent' },
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Sélectionner un rôle"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>Téléphone (max 3)</FormLabel>
                <div className="space-y-2">
                  {phoneInputs.map((phone, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="+261 ..."
                        value={phone}
                        onChange={(e) => updatePhoneInput(index, e.target.value)}
                      />
                      {phoneInputs.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePhoneInput(index)}
                        >
                          <Cross2Icon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {phoneInputs.length < 3 && (
                    <Button type="button" variant="outline" size="sm" onClick={addPhoneInput}>
                      <PlusIcon className="mr-1 h-4 w-4" />
                      Ajouter un numéro
                    </Button>
                  )}
                </div>
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditing ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder={isEditing ? 'Laisser vide pour conserver' : '••••••••'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </CardContent>
          </Card>

          {isTeacher && (
            <Card>
              <CardHeader>
                <CardTitle>Informations enseignant</CardTitle>
                <CardDescription>
                  Configurez les informations spécifiques à l'enseignant
                </CardDescription>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spécialité</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mathématiques" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div />
                <div className="space-y-1.5">
                  <FormLabel>Classes affectées</FormLabel>
                  <MultiSelect
                    options={classes ?? []}
                    selected={teacherClassIds}
                    onChange={setTeacherClassIds}
                    placeholder="Sélectionner des classes"
                  />
                </div>
                <div className="space-y-1.5">
                  <FormLabel>Matières enseignées</FormLabel>
                  <MultiSelect
                    options={subjects ?? []}
                    selected={teacherSubjectIds}
                    onChange={setTeacherSubjectIds}
                    placeholder="Sélectionner des matières"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/administration/users')}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? 'Mettre à jour' : 'Créer l\'utilisateur'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
