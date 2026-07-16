import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Student } from '@/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
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

const parentSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  relation: z.enum(['PARENT', 'TUTEUR']),
  studentIds: z.array(z.string()).optional(),
})

type ParentFormValues = z.infer<typeof parentSchema>

export function ParentFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const presetRelation = (searchParams.get('relation') as 'PARENT' | 'TUTEUR') || 'PARENT'
  const [showPassword, setShowPassword] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  const { data: students } = useLocalQuery<Student>('Student')

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      relation: presetRelation,
      studentIds: [],
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: ParentFormValues) => {
      const userId = crypto.randomUUID()
      const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('tenantId') : null
      
      await saveEntity('User', {
        id: userId,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || null,
        role: 'PARENT',
        tenantId,
        isActive: true,
        passwordHash: values.password || Math.random().toString(36).slice(2, 10) + 'A1!',
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
              relation: values.relation,
              isPrimary: parents.length === 0,
            },
          ],
        })
      }
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
    <div className="space-y-6 max-w-2xl">
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

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+261 ..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <PasswordInput
                          placeholder="••••••••"
                          {...field}
                          className="pr-20"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? 'Masquer' : 'Afficher'}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relation</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'PARENT', label: 'Parent' },
                          { value: 'TUTEUR', label: 'Tuteur' },
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
                name="studentIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Élèves à lier (optionnel)</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2 rounded-lg border p-2">
                        {(students ?? []).map((s) => {
                          const checked = selectedStudentIds.includes(s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentIds((prev) =>
                                  checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                )
                              }}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs transition-colors',
                                checked
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-accent'
                              )}
                            >
                              {s.firstName} {s.lastName}
                            </button>
                          )
                        })}
                        {!students?.length && (
                          <span className="text-xs text-muted-foreground">Aucun élève disponible</span>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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