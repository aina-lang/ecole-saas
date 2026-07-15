import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import type { Student } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const queryClient = useQueryClient()
  const isEditing = !!id
  const [activeTab, setActiveTab] = useState('identite')

  const { data: classes } = useLocalQuery<any>('Class', undefined, [])

  const { data: parentUsers } = useLocalQuery<any>('User', { role: 'PARENT' }, [])

  const [parentLinks, setParentLinks] = useState<ParentLink[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [parentDialogOpen, setParentDialogOpen] = useState(false)
  const [npLastName, setNpLastName] = useState('')
  const [npFirstName, setNpFirstName] = useState('')
  const [npEmail, setNpEmail] = useState('')
  const [npPassword, setNpPassword] = useState('')
  const [npPhones, setNpPhones] = useState<string[]>([''])

  const [student, setStudent] = useState<Student | null>(null)
  const [loadingStudent, setLoadingStudent] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    setLoadingStudent(true)
    ;(async () => {
      let data = await getEntityById<any>('Student', id!)
      if (!data) {
        try {
          const { data: res } = await client.get(`/students/${id}`)
          data = res.data ?? res
          if (data) await saveEntity('Student', data)
        } catch { /* offline */ }
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
      classId: '',
      enrollmentDate: ''
    }
  })

  useEffect(() => {
    if (student) {
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
          parentId: p.parent.id,
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
      const payload: Record<string, unknown> = {
        id: localId,
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
        enrollmentDate: values.enrollmentDate || undefined,
      }
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k] })

      await saveEntity('Student', payload)

      if (pendingPhoto) {
        const api = window.api
        if (api?.file) {
          const buffer = await pendingPhoto.arrayBuffer()
          await api.file.save({
            buffer, entityType: 'Student', entityId: localId,
            fieldName: 'photo_url', originalName: pendingPhoto.name, mimeType: pendingPhoto.type,
          })
        }
        setPendingPhoto(null)
      }

      return localId
    },
    onSuccess: (localId) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève créé (mode hors-ligne)')
      navigate('/students')
    },
    onError: () => {
      toast.error("Erreur lors de la création de l'élève")
    }
  })

  const createParentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { lastName: npLastName.trim(), role: 'PARENT' }
      if (npFirstName.trim()) payload.firstName = npFirstName.trim()
      if (npEmail.trim()) payload.email = npEmail.trim()
      if (npPassword.trim()) payload.password = npPassword.trim()
      const phones = npPhones.map((p) => p.trim()).filter(Boolean)
      if (phones.length) payload.phones = phones
      const { data } = await client.post('/users', payload)
      return data
    },
    onSuccess: (data) => {
      const newUser = data?.data ?? data
      const id = newUser?.id ?? newUser?._id
      if (id) addParent(id)
      queryClient.invalidateQueries({ queryKey: ['parent-users'] })
      setParentDialogOpen(false)
      setNpLastName('')
      setNpFirstName('')
      setNpEmail('')
      setNpPassword('')
      setNpPhones([''])
      toast.success('Parent créé et ajouté')
    },
    onError: () => {
      toast.error('Erreur lors de la création du parent')
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const payload: Record<string, unknown> = {
        id,
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
        enrollmentDate: values.enrollmentDate || undefined,
      }
      Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k] })

      await saveEntity('Student', payload)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève mis à jour (mode hors-ligne)')
      navigate('/students')
    },
    onError: () => {
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
      const api = window.api
      if (api?.file && id) {
        const buffer = await file.arrayBuffer()
        const result = await api.file.save({
          buffer,
          entityType: 'Student',
          entityId: id,
          fieldName: 'photo_url',
          originalName: file.name,
          mimeType: file.type,
        })
        const localUrl = await api.file.getUrl(result.localPath)
        return { url: localUrl || '' }
      }
      if (!id) {
        setPendingPhoto(file)
        return { url: '' }
      }
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await client.post(`/students/${id}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const student = data.data ?? data
      return { url: student.photoUrl }
    },
    onSuccess: () => {
      if (!id) return
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
    },
  })

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!id) return null
      const { data } = await client.delete(`/students/${id}/photo`)
      return data.data ?? data
    },
    onSuccess: () => {
      if (!id) return
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Modifier l'élève" : 'Ajouter un élève'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Modifier les informations de cet élève'
              : 'Remplissez les informations pour inscrire un nouvel élève'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/students')}>
          Retour à la liste
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const errorFields = Object.keys(errors)
          if (errorFields.length > 0) {
            const tab = fieldTabMap[errorFields[0]]
            if (tab) setActiveTab(tab)
          }
        })} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="identite">Identité</TabsTrigger>
              <TabsTrigger value="parents">Parents / Tuteurs</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="medical">Médical</TabsTrigger>
              <TabsTrigger value="scolarite">Scolarité</TabsTrigger>
            </TabsList>

            <TabsContent value="identite">
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PhotoUpload
                    src={student?.photoUrl}
                    firstName={student?.firstName}
                    lastName={student?.lastName}
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle>Coordonnées</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="medical">
              <Card>
                <CardHeader>
                  <CardTitle>Informations médicales</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scolarite">
              <Card>
                <CardHeader>
                  <CardTitle>Informations scolaires</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parents">
              <Card>
                <CardHeader>
                  <CardTitle>Parent / Tuteur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormLabel>Ajouter un parent ou tuteur</FormLabel>
                      <Combobox
                        options={(parentUsers ?? [])
                          .filter((u) => !parentLinks.some((l) => l.parentId === u.id))
                          .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
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
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mot de passe</label>
                          <PasswordInput
                            placeholder="Laisser vide pour générer"
                            value={npPassword}
                            onChange={(e) => setNpPassword(e.target.value)}
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
                    <p className="text-sm text-muted-foreground">
                      Aucun parent ou tuteur rattaché.
                    </p>
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
                            {user ? `${user.firstName} ${user.lastName}` : link.parentId}
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/students')}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? 'Mettre à jour' : "Enregistrer l'élève"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
