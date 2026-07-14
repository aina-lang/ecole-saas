import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { saveEntity, deleteEntity } from '@/lib/db/offline'
import { LEVELS } from '@/lib/levels'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { TrashIcon, PlusIcon, Pencil2Icon, ReloadIcon } from '@radix-ui/react-icons'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

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

  const { data: subjects, loading: isLoading } = useLocalQuery<Subject>('Subject')

  const { data: classes } = useLocalQuery<{ id: string; name: string }>('Class')

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
      const payload: Record<string, unknown> = {
        name: values.name,
        code: values.code || undefined,
        level: values.level && values.level !== '__none__' ? values.level : undefined,
        coefficient: values.coefficient,
        classId: values.classId && values.classId !== '__none__' ? values.classId : undefined
      }
      if (editing) {
        payload.id = editing.id
      }
      await saveEntity('Subject', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success(editing ? 'Matière modifiée' : 'Matière créée')
      setOpen(false)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const [deleteId, setDeleteId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('Subject', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Matière supprimée')
      setDeleteId(null)
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['subjects'] })}>
            <ReloadIcon className="h-4 w-4" />
          </Button>
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
                      <FormControl>
                        <Combobox
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v || '__none__')}
                          placeholder="Sélectionner un niveau"
                          searchPlaceholder="Rechercher un niveau..."
                          options={[
                            { value: '__none__', label: 'Aucun' },
                            ...LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
                          ]}
                        />
                      </FormControl>
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
                      <FormControl>
                        <Combobox
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v || '__none__')}
                          placeholder="Aucune (générale)"
                          searchPlaceholder="Rechercher une classe..."
                          options={[
                            { value: '__none__', label: 'Aucune (générale)' },
                            ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                          ]}
                        />
                      </FormControl>
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
    </div>

    <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Nom',
                sortable: true,
                className: 'font-medium',
              },
              {
                key: 'code',
                label: 'Code',
                render: (subject) => (subject as any).code || '-',
              },
              {
                key: 'level',
                label: 'Niveau',
                render: (subject) => (subject as any).level || '-',
              },
              {
                key: 'coefficient',
                label: 'Coefficient',
                sortable: true,
              },
              {
                key: 'class',
                label: 'Classe',
                render: (subject) => (subject as any).class?.name || 'Générale',
              },
            ]}
            data={subjects ?? []}
            total={(subjects ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(subject) => (subject as any).id}
            isLoading={isLoading}
            emptyMessage="Aucune matière"
            bulkDeleteLabel="matière(s)"
            renderRowActions={(subject) => {
              const s = subject as any
              return (
                <>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    open={deleteId === s.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={() => deleteMutation.mutate(s.id)}
                    title="Supprimer la matière"
                    description={`Êtes-vous sûr de vouloir supprimer la matière "${s.name}" ? Cette action est irréversible.`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <TrashIcon className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
