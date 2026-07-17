import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { queryEntities, deleteEntity, saveEntity, countEntities } from '@/lib/db/pouchdb-compat'
import { LEVELS } from '@/lib/levels'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { TrashIcon, PlusIcon, Pencil2Icon, ReloadIcon } from '@radix-ui/react-icons'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

interface Subject {
  id: string
  name: string
  code: string | null
  level?: string | null
  coefficient: number
}

const subjectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().optional().or(z.literal('')),
  level: z.string().optional().or(z.literal('')),
  coefficient: z.coerce.number().min(0, 'Coefficient invalide').default(1),
})

type SubjectFormValues = z.infer<typeof subjectSchema>

export function SubjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [open, setOpen] = useState(false)
  const limit = 10

  const { data: subjectsData, isLoading } = useQuery({
    queryKey: ['subjects', search, page, sortBy, sortDirection],
    queryFn: async () => {
      const offset = (page - 1) * limit
      const params: Record<string, string | number> = { limit, offset }
      if (search) params.search = search
      if (sortBy) {
        params.sortBy = sortBy
        params.sortDirection = sortDirection
      }
      const [data, total] = await Promise.all([
        queryEntities<Subject>('Subject', params),
        countEntities('Subject', 'search' in params ? { ...params, limit: undefined, offset: undefined } : params),
      ])
      return { data, total } as { data: Subject[]; total: number }
    },
  })

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', code: '', coefficient: 1, level: '__none__' }
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', code: '', level: '__none__', coefficient: 1 })
    setOpen(true)
  }

  function openEdit(subject: Subject) {
    setEditing(subject)
    form.reset({
      name: subject.name,
      code: subject.code ?? '',
      level: subject.level ?? '__none__',
      coefficient: subject.coefficient,
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

  const totalPages = subjectsData ? Math.ceil((subjectsData.total || 0) / limit) : 0

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('ellipsis')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i)
      }
      if (page < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Matières</h2>
          <p className="text-muted-foreground">Gérer les matières et leurs coefficients</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['subjects'] })}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={openCreate}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter une matière
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou code..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

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
                sortable: true,
                render: (subject) => (subject as any).code || '-',
              },
              {
                key: 'level',
                label: 'Niveau',
                sortable: true,
                render: (subject) => (subject as any).level || '-',
              },
              {
                key: 'coefficient',
                label: 'Coefficient',
                sortable: true,
              },
            ]}
            data={subjectsData?.data ?? []}
            total={subjectsData?.total ?? 0}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onSortChange={(key, direction) => {
              setSortBy(key)
              setSortDirection(direction)
              setPage(1)
            }}
            sortKey={sortBy}
            sortDirection={sortDirection}
            filters={{ search }}
            onFilterChange={() => {}}
            onBulkDelete={(ids) => {
              Promise.all(ids.map((id) => deleteEntity('Subject', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['subjects'] })
                  toast.success(`${ids.length} matière(s) supprimée(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
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

      <Dialog open={open} onOpenChange={setOpen}>
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
  )
}