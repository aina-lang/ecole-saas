import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { fileToResizedDataUrl } from '@/lib/image-utils'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import client, { extractErrorMessage } from '@/api/client'
import { CredentialsDialog, type Credentials } from '@/components/credentials-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { PageHeader, FormShell, FormSection } from '@/components/layout/page'

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

// À la création, ce formulaire générique ne doit servir qu'à créer des comptes
// de staff (Admin/Secrétaire) : les enseignants et parents ont chacun leur
// propre formulaire dédié (TeacherFormPage, ParentFormPage) avec leurs champs
// spécifiques — les proposer ici aussi ne faisait que dupliquer ces flux.
// En modification, on garde tous les rôles pour ne pas casser l'édition d'un
// compte enseignant/parent existant créé via son propre formulaire.
const CREATE_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'SECRETARY', label: 'Secrétaire' },
]
const ALL_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'TEACHER', label: 'Enseignant' },
  { value: 'SECRETARY', label: 'Secrétaire' },
  { value: 'PARENT', label: 'Parent' },
]

const userFormSchema = z.object({
  email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Le nom est requis'),
  role: z.enum(['ADMIN', 'TEACHER', 'SECRETARY', 'PARENT']),
  specialty: z.string().optional().or(z.literal(''))
})

type UserFormValues = z.infer<typeof userFormSchema>

export function UserFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const isEditing = !!id
  const currentUserId = useAuthStore((s) => s.user?.id)
  // Son propre compte : le rôle ne se change pas soi-même (un admin qui se
  // rétrograde par erreur se verrouillerait hors de l'administration).
  const isOwnAccount = isEditing && !!currentUserId && id === currentUserId

  const [phoneInputs, setPhoneInputs] = useState<string[]>([''])
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([])
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const { data: classesRaw } = useLocalQuery<Option & { level?: string | null; deletedAt?: string | null }>('Class')
  const { data: subjectsRaw } = useLocalQuery<Option & { level?: string | null; deletedAt?: string | null }>('Subject')
  const { data: levels } = useLocalQuery<{ id: string; name: string; sortOrder?: number }>('Level')

  // Classes triées par niveau, libellé « 6ème A · 6ème » ; matières nommées
  // avec leur niveau (une matière existe par niveau) et limitées aux niveaux
  // des classes cochées.
  const levelOrder = new Map((levels ?? []).map((l) => [l.name, l.sortOrder ?? 0]))
  const classes: Option[] = (classesRaw ?? [])
    .filter((c) => !c.deletedAt)
    .sort((a, b) => (levelOrder.get(a.level ?? '') ?? 99) - (levelOrder.get(b.level ?? '') ?? 99) || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.level && !c.name.includes(c.level) ? `${c.name} · ${c.level}` : c.name }))
  const selectedLevels = new Set((classesRaw ?? []).filter((c) => teacherClassIds.includes(c.id)).map((c) => c.level ?? ''))
  const subjects: Option[] = (subjectsRaw ?? [])
    .filter((s) => !s.deletedAt && (selectedLevels.size === 0 || selectedLevels.has(s.level ?? '')))
    .sort((a, b) => (levelOrder.get(a.level ?? '') ?? 99) - (levelOrder.get(b.level ?? '') ?? 99) || a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.level ? `${s.name} · ${s.level}` : s.name }))

  const { data: user } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      return getEntityById<any>('User', id!)
    },
    enabled: isEditing
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'ADMIN',
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
      // Data URL dans le document synchronisé (propagation multi-postes).
      const photoDataUrl = await fileToResizedDataUrl(file)
      await saveEntity('User', { id, photoUrl: photoDataUrl })
      return { url: photoDataUrl }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
  })

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null
      await saveEntity('User', { id, photoUrl: null })
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
    mutationFn: async (values: UserFormValues): Promise<{ id: string; credentials: Credentials | null }> => {
      const phones = syncPhoneValue(phoneInputs)
      const name = `${values.firstName ?? ''} ${values.lastName}`.trim()

      // EN LIGNE avec un e-mail : le serveur crée le compte, génère un mot de
      // passe temporaire (affiché ici, envoyé par e-mail) et propage le
      // document vers les postes. Le mot de passe ne transite jamais par un
      // document synchronisé.
      let serverId: string | null = null
      let credentials: Credentials | null = null
      if (values.email && navigator.onLine) {
        try {
          const { data } = await client.post('/users', {
            email: values.email,
            firstName: values.firstName || undefined,
            lastName: values.lastName,
            role: values.role,
            phones,
          })
          serverId = data.id
          if (data.temporaryPassword) {
            credentials = { name, email: data.email, password: data.temporaryPassword, emailed: !!data.credentialsEmailed }
          }
        } catch (err: any) {
          // Serveur injoignable : on retombe sur la création locale (hors ligne).
          if (err?.response) throw err
        }
      }

      const localId = serverId ?? crypto.randomUUID()
      const payload: Record<string, unknown> = {
        id: localId,
        lastName: values.lastName,
        phones
      }
      if (values.firstName) payload.firstName = values.firstName
      if (values.email) payload.email = values.email
      // Ne JAMAIS mettre le mot de passe dans le document PouchDB : il serait
      // répliqué en clair vers CouchDB et tous les postes du tenant.
      await saveEntity('User', { ...payload, role: values.role })
      if (values.role === 'TEACHER') {
        await saveEntity('Teacher', {
          ...payload,
          id: crypto.randomUUID(),
          userId: localId,
          specialty: values.specialty || null,
          classIds: teacherClassIds,
          subjectIds: teacherSubjectIds
        })
      }
      if (pendingPhoto) {
        try {
          // Data URL dans le document synchronisé (propagation multi-postes).
          const photoDataUrl = await fileToResizedDataUrl(pendingPhoto)
          await saveEntity('User', { id: localId, photoUrl: photoDataUrl })
        } catch { /* ok */ }
        setPendingPhoto(null)
      }
      return { id: localId, credentials }
    },
    onSuccess: ({ credentials }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      if (credentials) {
        setCredentials(credentials)
      } else {
        toast.success('Utilisateur créé', {
          description: navigator.onLine
            ? 'Sans e-mail, aucun mot de passe n’a été généré : définissez-le via le bouton clé.'
            : 'Créé hors ligne : le mot de passe se définira en ligne (bouton clé).',
        })
        navigate('/administration/users')
      }
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
      // Ne JAMAIS mettre le mot de passe dans le document PouchDB : il serait
      // répliqué en clair vers CouchDB et tous les postes du tenant. La
      // définition d'un mot de passe passe par le serveur (en ligne).
      if (values.role === 'TEACHER') {
        await saveEntity('User', {
          ...payload,
          role: values.role
        })
        // Fiche enseignant : existante (mise à jour) ou créée à la volée quand
        // un compte passe au rôle Enseignant (conversion d'un admin/secrétaire).
        await saveEntity('Teacher', {
          ...payload,
          id: user.teacher?.id ?? crypto.randomUUID(),
          userId: id,
          user_firstName: values.firstName || null,
          user_lastName: values.lastName,
          user_email: values.email || null,
          specialty: values.specialty || null,
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
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Erreur lors de la modification de l'utilisateur"))
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
      <PageHeader
        backTo="/administration/users"
        title={isEditing ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
        description={
          isEditing
            ? 'Modifier les informations de cet utilisateur'
            : 'Créez un nouveau compte utilisateur'
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormShell
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => navigate('/administration/users')}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {isEditing ? 'Mettre à jour' : 'Enregistrer'}
                </Button>
              </>
            }
          >
            <FormSection
              title="Informations personnelles"
              description="Identité et coordonnées du compte"
              columns={2}
              aside={
                <PhotoUpload
                  src={user?.photoUrl}
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  onUpload={(file) => photoMutation.mutateAsync(file)}
                  onDelete={() => deletePhotoMutation.mutateAsync()}
                />
              }
            >
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
                render={({ field }) => {
                  // Enseignant/Parent ne sont plus proposés à la sélection (ils ont
                  // leurs propres formulaires dédiés) — mais si on édite un compte
                  // existant qui a déjà ce rôle, on le garde affichable pour ne pas
                  // vider silencieusement le sélecteur.
                  const currentRoleOption = ALL_ROLE_OPTIONS.find((o) => o.value === field.value)
                  // En modification, « Enseignant » est proposé pour convertir un
                  // compte créé par erreur comme admin/secrétaire (la fiche
                  // enseignant est créée à l'enregistrement).
                  const baseOptions = isEditing
                    ? [...CREATE_ROLE_OPTIONS, { value: 'TEACHER', label: 'Enseignant' }]
                    : CREATE_ROLE_OPTIONS
                  const roleOptions =
                    currentRoleOption && !baseOptions.some((o) => o.value === field.value)
                      ? [...baseOptions, currentRoleOption]
                      : baseOptions
                  return (
                    <FormItem>
                      <FormLabel>Rôle *</FormLabel>
                      <FormControl>
                        <Combobox
                          options={roleOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Sélectionner un rôle"
                          disabled={isOwnAccount}
                        />
                      </FormControl>
                      {isOwnAccount && (
                        <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre rôle.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
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
              {/* Pas de champ mot de passe : ce formulaire écrit un document
                  local synchronisé — un mot de passe y serait répliqué en
                  clair. Les identifiants se définissent en ligne. */}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Le mot de passe du compte se définit en ligne (via le serveur) —
                le compte créé ici ne peut pas se connecter tant qu'aucun mot de
                passe n'a été défini.
              </p>
            </FormSection>

            {isTeacher && (
              <FormSection
                title="Informations enseignant"
                description="Configurez les informations spécifiques à l'enseignant"
                columns={2}
              >
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
              </FormSection>
            )}
          </FormShell>
        </form>
      </Form>
      <CredentialsDialog credentials={credentials} onClose={() => { setCredentials(null); navigate('/administration/users') }} />
    </div>
  )
}
