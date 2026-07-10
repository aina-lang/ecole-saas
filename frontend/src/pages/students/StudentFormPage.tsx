import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Student } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Combobox } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
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

  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const res = await client.get('/classes')
      const raw = res.data
      return (Array.isArray(raw) ? raw : raw.data ?? []) as { id: string; name: string }[]
    }
  })

  const { data: parentUsers } = useQuery({
    queryKey: ['parent-users'],
    queryFn: async () => {
      const res = await client.get('/users', {
        params: { role: 'PARENT', limit: 200 },
      })
      const raw = res.data
      return (Array.isArray(raw) ? raw : raw.data ?? []) as Array<{ id: string; firstName: string; lastName: string }>
    },
  })

  const [parentLinks, setParentLinks] = useState<ParentLink[]>([])

  const { data: student } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await client.get(`/students/${id}`)
      return data.data as Student
    },
    enabled: isEditing
  })

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
      const payload: Record<string, unknown> = { ...values, parents: parentLinks }
      if (!payload.firstName) delete payload.firstName
      const { data } = await client.post('/students', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève créé avec succès')
      navigate('/students')
    },
    onError: () => {
      toast.error("Erreur lors de la création de l'élève")
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { data } = await client.patch(`/students/${id}`, { ...values, parents: parentLinks })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
      toast.success('Élève mis à jour avec succès')
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
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                          <Input type="date" {...field} />
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
                          <Input type="date" {...field} />
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
                  </div>

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
