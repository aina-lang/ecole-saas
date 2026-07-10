import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import { LEVELS } from '@/lib/levels'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  PlusIcon,
  Pencil2Icon,
  TrashIcon,
  ReloadIcon
} from '@radix-ui/react-icons'

interface Subject {
  id: string
  name: string
  code: string | null
  level?: string | null
  coefficient: number
  classId?: string | null
  class?: { id: string; name: string } | null
}

const subjectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().optional().or(z.literal('')),
  level: z.string().optional().or(z.literal('')),
  coefficient: z.coerce.number().min(0, 'Coefficient invalide').default(1),
  classId: z.string().optional().or(z.literal('__none__'))
})

type SubjectFormValues = z.infer<typeof subjectSchema>

export function SubjectsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Subject | null>(null)
  const [open, setOpen] = useState(false)

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await client.get('/subjects')
      const items = res.data.data ?? res.data
      return Array.isArray(items) ? items : []
    }
  })

  const { data: classes } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['classes-opt'],
    queryFn: async () => {
      const res = await client.get('/classes')
      const items = res.data.data ?? res.data
      return (Array.isArray(items) ? items : []).map((c: any) => ({ id: c.id, name: c.name }))
    }
  })

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', code: '', coefficient: 1, classId: '' }
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', code: '', level: '__none__', coefficient: 1, classId: '__none__' })
    setOpen(true)
  }

  function openEdit(subject: Subject) {
    setEditing(subject)
    form.reset({
      name: subject.name,
      code: subject.code ?? '',
      level: subject.level ?? '__none__',
      coefficient: subject.coefficient,
      classId: subject.classId ?? '__none__'
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SubjectFormValues) => {
      const payload = {
        name: values.name,
        code: values.code || undefined,
        level: values.level && values.level !== '__none__' ? values.level : undefined,
        coefficient: values.coefficient,
        classId: values.classId && values.classId !== '__none__' ? values.classId : undefined
      }
      if (editing) {
        await client.patch(`/subjects/${editing.id}`, payload)
      } else {
        await client.post('/subjects', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success(editing ? 'Matière modifiée' : 'Matière créée')
      setOpen(false)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/subjects/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Matière supprimée')
    },
    onError: () => toast.error('Erreur lors de la suppression')
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Matières</h2>
          <p className="text-muted-foreground">Gérer les matières et leurs coefficients</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une matière
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la matière' : 'Ajouter une matière'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Modifiez les informations de la matière' : 'Créez une nouvelle matière'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mathématiques" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: MATH" {...field} />
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
                      <FormLabel>Niveau</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un niveau" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>
                              {lvl}
                            </SelectItem>
                          ))}
                          <SelectItem value="__none__">Aucun</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coefficient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coefficient</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe (optionnel)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Aucune (générale)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Aucune (générale)</SelectItem>
                          {(classes ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <>
                        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : editing ? (
                      'Modifier'
                    ) : (
                      'Créer'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Coefficient</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !subjects?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucune matière
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>{subject.code || '-'}</TableCell>
                    <TableCell>{subject.level || '-'}</TableCell>
                    <TableCell>{subject.coefficient}</TableCell>
                    <TableCell>{subject.class?.name || 'Générale'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(subject)}>
                          <Pencil2Icon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(subject.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
