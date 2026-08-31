import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import { fileToResizedDataUrl } from '@/lib/image-utils'
import type { Student } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, FormShell, FormSection, EmptyState } from '@/components/layout/page'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PlusIcon } from '@radix-ui/react-icons'
import { Textarea } from '@/components/ui/textarea'
import { PhotoUpload } from '@/components/ui/photo-upload'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'

const studentFormSchema = z.object({
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1, 'Le nom est requis'),
  birthDate: z.string().min(1, 'La date de naissance est requise'),
  birthPlace: z.string().optional(),
  gender: z.enum(['M', 'F'], { required_error: 'Le genre est requis' }),
  nationality: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bloodType: z.string().optional(),
  medicalNotes: z.string().optional(),
  allergies: z.string().optional(),
  classId: z.string().min(1, 'La classe est requise'),
  enrollmentDate: z.string().min(1, "La date d'inscription est requise")
})

// Sections du formulaire, dans l'ordre d'affichage. Le sommaire fixe à
// gauche suit la section visible (IntersectionObserver) et permet d'y sauter ;
// une erreur de validation fait défiler jusqu'à la section concernée.
const FORM_SECTIONS = [
  { id: 'identite', label: 'Identité' },
  { id: 'parents', label: 'Parents / Tuteurs' },
  { id: 'contact', label: 'Contact' },
  { id: 'medical', label: 'Médical' },
  { id: 'scolarite', label: 'Scolarité' },
] as const

const fieldTabMap: Record<string, string> = {
  lastName: 'identite',
  firstName: 'identite',
  birthDate: 'identite',
  birthPlace: 'identite',
  gender: 'identite',
  nationality: 'identite',
  address: 'contact',
  phone: 'contact',
  email: 'contact',
  emergencyContact: 'contact',
  emergencyPhone: 'contact',
  bloodType: 'medical',
  allergies: 'medical',
  medicalNotes: 'medical',
  classId: 'scolarite',
  enrollmentDate: 'scolarite',
}

interface ParentLink {
  parentId: string
  relation: 'PARENT' | 'TUTEUR'
  isPrimary: boolean
}

type StudentFormValues = z.infer<typeof studentFormSchema>

export function StudentFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const preselectedClassId = searchParams.get('classId')
  const queryClient = useQueryClient()
  const isEditing = !!id
  const [activeTab, setActiveTab] = useState('identite')

  function scrollToSection(id: string) {
    setActiveTab(id)
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const els = FORM_SECTIONS.map((sec) => document.getElementById(`section-${sec.id}`)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveTab(visible[0].target.id.replace('section-', ''))
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const { data: classes } = useLocalQuery<any>('Class', undefined, [])

  const { data: parentUsers } = useLocalQuery<any>('User', { role: 'PARENT' }, [])

  const [parentLinks, setParentLinks] = useState<ParentLink[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [parentDialogOpen, setParentDialogOpen] = useState(false)
  const [npLastName, setNpLastName] = useState('')
  const [npFirstName, setNpFirstName] = useState('')
  const [npEmail, setNpEmail] = useState('')
  const [npPhones, setNpPhones] = useState<string[]>([''])

  const [student, setStudent] = useState<Student | null>(null)
  const [, setLoadingStudent] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    setLoadingStudent(true)
    ;(async () => {
      const data = await getEntityById<any>('Student', id!)
      if (!data) {
        toast.error('Élève introuvable localement. Vérifiez la synchronisation.')
        setLoadingStudent(false)
        return
      }
      setStudent(data as Student)
      setLoadingStudent(false)
    })()
  }, [id, isEditing])

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: '',
      birthPlace: '',
      gender: undefined,
      nationality: '',
      address: '',
      phone: '',
      email: '',
      emergencyContact: '',
      emergencyPhone: '',
      bloodType: '',
      medicalNotes: '',
      allergies: '',
      classId: preselectedClassId || '',
      enrollmentDate: new Date().toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    if (student) {
      console.log(`[StudentFormPage] Resetting form with student:`, { ...student, photoUrl: student.photoUrl })
      form.reset({
        firstName: student.firstName,
        lastName: student.lastName,
        birthDate: student.birthDate?.split('T')[0] || '',
        birthPlace: (student as any).birthPlace || '',
        gender: student.gender,
        nationality: (student as any).nationality || '',
        address: student.address || '',
        phone: (student as any).phone || '',
        email: (student as any).email || '',
        emergencyContact: (student as any).emergencyContact || '',
        emergencyPhone: (student as any).emergencyPhone || '',
        bloodType: (student as any).bloodType || '',
        medicalNotes: (student as any).medicalNotes || '',
        allergies: (student as any).allergies || '',
        classId: student.classId || '',
        enrollmentDate: (student as any).enrollmentDate?.split('T')[0] || ''
      })
      setParentLinks(
        (student.parents ?? []).map((p) => ({
          parentId: p.parent?.id ?? (p as any).parentId,
          relation: p.relation,
          isPrimary: p.isPrimary,
        }))
      )
    }
  }, [student, form])

  function addParent(parentId: string) {
    if (!parentId || parentLinks.some((l) => l.parentId === parentId)) return
    setParentLinks((prev) => [
      ...prev,
      { parentId, relation: 'PARENT', isPrimary: prev.length === 0 },
    ])
  }

  function updateParentLink(index: number, patch: Partial<ParentLink>) {
    setParentLinks((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const next = { ...l, ...patch }
        if (patch.isPrimary) {
          return next
        }
        return next
      })
    )
  }

  function setPrimary(index: number) {
    setParentLinks((prev) => prev.map((l, i) => ({ ...l, isPrimary: i === index })))
  }

  function removeParent(index: number) {
    setParentLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const createMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const localId = crypto.randomUUID()
      const year = new Date().getFullYear()
      // Dérivé de l'UUID de l'élève (8 hex ≈ 4 milliards de valeurs) : deux
      // postes hors ligne ne peuvent pas produire le même matricule, alors
      // que l'ancien tirage sur 100 000 valeurs collisionnait vite — et le
      // doublon faisait rejeter l'élève entier par la contrainte d'unicité.
      const payload: Record<string, unknown> = {
        id: localId,
        registrationNumber: `STU-${year}-${localId.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
        enrollmentDate: values.enrollmentDate || new Date().toISOString().split('T')[0],
        firstName: values.firstName || undefined,
        lastName: values.lastName,
        birthDate: values.birthDate || undefined,
        birthPlace: values.birthPlace || undefined,
        gender: values.gender,
        nationality: values.nationality || undefined,
        address: values.address || undefined,
        phoneNumber: values.phone || undefined,
        email: values.email || undefined,
        emergencyContact: values.emergencyContact || undefined,
        emergencyPhone: values.emergencyPhone || undefined,
        bloodType: values.bloodType || undefined,
        medicalNotes: values.medicalNotes || undefined,
        allergies: values.allergies || undefined,
        classId: values.classId || undefined,
      }
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k] })

      await saveEntity('Student', payload)

      if (pendingPhoto) {
        try {
          // Data URL dans le document synchronisé : la photo voyage avec
          // l'élève vers CouchDB et les autres postes (un chemin
          // local-asset:// n'existait que sur cette machine).
          const photoDataUrl = await fileToResizedDataUrl(pendingPhoto)
          await saveEntity('Student', { id: localId, photoUrl: photoDataUrl })
        } catch {
          // L'upload de photo est optionnel — l'élève est déjà créé localement.
        }
        setPendingPhoto(null)
      }

      return localId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève créé (mode hors-ligne)')
      navigate('/students')
    },
    onError: (err) => {
      console.error('Create student error:', err)
      toast.error("Erreur lors de la création de l'élève")
    }
  })

  const createParentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        lastName: npLastName.trim(),
        role: 'PARENT',
        firstName: npFirstName.trim() || undefined,
        email: npEmail.trim() || undefined,
        phones: npPhones.map((p) => p.trim()).filter(Boolean),
        tenantId: localStorage.getItem('tenantId') || undefined,
      }
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k] })
      const saved = await saveEntity('User', payload)
      return saved
    },
    onSuccess: (data) => {
      const id = data?.id ?? data?._id
      if (id) addParent(id)
      queryClient.invalidateQueries({ queryKey: ['parent-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setParentDialogOpen(false)
      setNpLastName('')
      setNpFirstName('')
      setNpEmail('')
      setNpPhones([''])
      toast.success('Parent créé et ajouté')
    },
    onError: () => {
      toast.error('Erreur lors de la création du parent')
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      // Même dérivation UUID qu'à la création (voir createMutation) pour le
      // cas d'un élève existant sans matricule.
      const regNumber = student?.registrationNumber ||
        `STU-${new Date().getFullYear()}-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
      // `null` (et non undefined/omission) pour les champs vidés : saveEntity
      // fusionne avec le document existant, donc un champ absent du patch
      // CONSERVE son ancienne valeur — seul null l'efface réellement.
      const payload: Record<string, unknown> = {
        id,
        registrationNumber: regNumber,
        firstName: values.firstName || null,
        lastName: values.lastName,
        birthDate: values.birthDate || null,
        birthPlace: values.birthPlace || null,
        gender: values.gender,
        nationality: values.nationality || null,
        address: values.address || null,
        phoneNumber: values.phone || null,
        email: values.email || null,
        emergencyContact: values.emergencyContact || null,
        emergencyPhone: values.emergencyPhone || null,
        bloodType: values.bloodType || null,
        medicalNotes: values.medicalNotes || null,
        allergies: values.allergies || null,
        classId: values.classId || null,
        enrollmentDate: values.enrollmentDate || null,
      }

      await saveEntity('Student', payload)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève mis à jour (mode hors-ligne)')
      navigate('/students')
    },
    onError: (err) => {
      console.error('Update student error:', err)
      toast.error('Erreur lors de la mise à jour')
    }
  })

  function onSubmit(values: StudentFormValues) {
    if (isEditing) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) {
        setPendingPhoto(file)
        return { url: '' }
      }
      // Data URL dans le document synchronisé (cf. createMutation).
      const photoDataUrl = await fileToResizedDataUrl(file)
      await saveEntity('Student', { id, photoUrl: photoDataUrl })
      return { url: photoDataUrl }
    },
    onSuccess: async (result) => {
      if (!id || !result?.url) return
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
    },
  })

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null
      await saveEntity('Student', { id, photoUrl: null })
      return { success: true }
    },
    onSuccess: async () => {
      if (!id) return
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/students"
        title={isEditing ? "Modifier l'élève" : 'Ajouter un élève'}
        description={
          isEditing
            ? 'Modifier les informations de cet élève'
            : 'Remplissez les informations pour inscrire un nouvel élève'
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const errorFields = Object.keys(errors)
          if (errorFields.length > 0) {
            const tab = fieldTabMap[errorFields[0]]
            if (tab) scrollToSection(tab)
          }
        })}>
          <FormShell
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => navigate('/students')}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {isEditing ? 'Mettre à jour' : "Enregistrer l'élève"}
                </Button>
              </>
            }
          >
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <nav className="hidden lg:block lg:sticky lg:top-0 space-y-1" aria-label="Sections du formulaire">
              {FORM_SECTIONS.map((sec, i) => {
                const active = activeTab === sec.id
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ' +
                      (active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                    }
                  >
                    <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' + (active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {i + 1}
                    </span>
                    {sec.label}
                  </button>
                )
              })}
            </nav>
            <div className="space-y-6">

            <section id="section-identite" className="scroll-mt-6">
              <FormSection
                title="Informations personnelles"
                description="Identité de l'élève"
                columns={2}
                aside={
                  <PhotoUpload
                    src={student?.photoUrl}
                    firstName={student?.firstName}
                    lastName={student?.lastName}
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
                          <Input {...field} placeholder="Nom de famille" />
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
                          <Input {...field} placeholder="Prénom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance *</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="birthPlace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lieu de naissance</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ville de naissance" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Genre *</FormLabel>
                        <FormControl>
                          <Combobox
                            options={[
                              { value: 'M', label: 'Masculin' },
                              { value: 'F', label: 'Féminin' },
                            ]}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationalité</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nationalité" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </FormSection>
            </section>

            <section id="section-parents" className="scroll-mt-6">
              <FormSection
                title="Parent / Tuteur"
                description="Comptes parents rattachés à cet élève"
                columns={1}
              >
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormLabel>Ajouter un parent ou tuteur</FormLabel>
                      <Combobox
                        options={(parentUsers ?? [])
                          .filter((u) => !parentLinks.some((l) => l.parentId === u.id))
                           .map((u) => ({ value: u.id, label: `${u.firstName ? `${u.firstName} ` : ''}${u.lastName}` }))}
                        value=""
                        onValueChange={(value) => {
                          if (value) addParent(value)
                        }}
                        placeholder="Sélectionner un compte parent..."
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setParentDialogOpen(true)}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  <Dialog open={parentDialogOpen} onOpenChange={setParentDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Nouveau parent / tuteur</DialogTitle>
                        <DialogDescription>
                          Créer un compte parent pour l'associer à cet élève
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nom *</label>
                          <Input
                            placeholder="Nom de famille"
                            value={npLastName}
                            onChange={(e) => setNpLastName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Prénom</label>
                          <Input
                            placeholder="Prénom"
                            value={npFirstName}
                            onChange={(e) => setNpFirstName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Email</label>
                          <Input
                            placeholder="email@exemple.com"
                            type="email"
                            value={npEmail}
                            onChange={(e) => setNpEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
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
                                  ×
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
                              + Ajouter un numéro
                            </Button>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setParentDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          disabled={!npLastName.trim() || createParentMutation.isPending}
                          onClick={() => createParentMutation.mutate()}
                        >
                          {createParentMutation.isPending ? 'Création...' : 'Créer et ajouter'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {parentLinks.length === 0 && (
                    <EmptyState
                      title="Aucun parent ou tuteur rattaché"
                      description="Sélectionnez un compte parent existant ou créez-en un nouveau."
                      className="py-8"
                    />
                  )}

                  <div className="space-y-3">
                    {parentLinks.map((link, index) => {
                      const user = (parentUsers ?? []).find((u) => u.id === link.parentId)
                      return (
                        <div
                          key={link.parentId}
                          className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                        >
                            <span className="font-medium">
                              {user ? `${user.firstName ? `${user.firstName} ` : ''}${user.lastName}` : link.parentId}
                            </span>
                          <Combobox
                            options={[
                              { value: 'PARENT', label: 'Parent' },
                              { value: 'TUTEUR', label: 'Tuteur' },
                            ]}
                            value={link.relation}
                            onValueChange={(value) =>
                              updateParentLink(index, {
                                relation: value as 'PARENT' | 'TUTEUR',
                              })
                            }
                            className="w-40"
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="primary-parent"
                              checked={link.isPrimary}
                              onChange={() => setPrimary(index)}
                            />
                            Principal
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="ml-auto"
                            onClick={() => removeParent(index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      )
                    })}
                  </div>
              </FormSection>
            </section>

            <section id="section-contact" className="scroll-mt-6">
              <FormSection title="Coordonnées" description="Adresse, téléphone et contact d'urgence" columns={2}>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Adresse complète" rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Numéro de téléphone" />
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="email@exemple.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact d'urgence</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nom du contact" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone d'urgence</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Numéro d'urgence" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </FormSection>
            </section>

            <section id="section-medical" className="scroll-mt-6">
              <FormSection title="Informations médicales" description="Groupe sanguin, allergies et notes" columns={2}>
                  <FormField
                    control={form.control}
                    name="bloodType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Groupe sanguin</FormLabel>
                        <FormControl>
                          <Combobox
                            options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
                              (g) => ({ value: g, label: g })
                            )}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allergies</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Allergies connues" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medicalNotes"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Notes médicales</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Informations médicales complémentaires"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </FormSection>
            </section>

            <section id="section-scolarite" className="scroll-mt-6">
              <FormSection title="Informations scolaires" description="Classe et date d'inscription" columns={2}>
                  <FormField
                    control={form.control}
                    name="classId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classe *</FormLabel>
                        <FormControl>
                          <Combobox
                            options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner une classe"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enrollmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date d'inscription *</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </FormSection>
            </section>
            </div>
          </div>
          </FormShell>
        </form>
      </Form>
    </div>
  )
}
