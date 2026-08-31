import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { queryEntities, deleteEntity, saveEntity, countEntities } from '@/lib/db/pouchdb-compat'
import { cn } from '@/lib/utils'
import type { Level } from '@/types'

import { PageHeader, FilterBar } from '@/components/layout/page'
import { Card, CardContent } from '@/components/ui/card'
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
  DialogTitle
} from '@/components/ui/dialog'
import { TrashIcon, PlusIcon, Pencil2Icon, ReloadIcon } from '@radix-ui/react-icons'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

interface Subject {
  id: string
  name: string
  code: string | null
  level?: string | null
  levelId?: string | null
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

  const { data: levels } = useQuery({
    queryKey: ['levels'],
    queryFn: () => queryEntities<Level>('Level'),
  })

  // Seule source de vérité pour les niveaux : les vrais enregistrements Level
  // (gérés dans Administration > Niveaux). Avant, une liste figée servait de
  // repli quand aucun Level n'existait encore, ce qui pouvait enregistrer une
  // matière avec un niveau texte libre jamais relié à un vrai Level (levelId
  // resté null pour toujours, même après création du Level correspondant).
  const levelOptions = useMemo(() => {
    return [...(levels ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({ value: l.id, label: l.name }))
  }, [levels])

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
      // Le Combobox est maintenant indexé par id de Level (pas par nom) —
      // c'était le bug qui empêchait le niveau existant de s'afficher
      // pré-sélectionné à l'édition.
      level: subject.levelId ?? '__none__',
      coefficient: subject.coefficient,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SubjectFormValues) => {
      const selectedId = values.level && values.level !== '__none__' ? values.level : undefined
      const levelEntity = selectedId ? levels?.find((l) => l.id === selectedId) : undefined
      const payload: Record<string, unknown> = {
        name: values.name,
        code: values.code || undefined,
        level: levelEntity?.name,
        levelId: levelEntity?.id || null,
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



  return (
    <div className="space-y-6">
      <PageHeader
        title="Matières"
        description="Gérer les matières et leurs coefficients"
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['subjects'] })}
              disabled={isLoading}
              aria-label="Rafraîchir"
            >
              <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une matière
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
      </FilterBar>

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
                render: (subject) => {
                  const s = subject as any
                  const lvl = levels?.find((l) => l.id === s.levelId || l.name === s.level)
                  return lvl?.name ?? s.level ?? '-'
                },
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
                          ...levelOptions,
                        ]}
                      />
                    </FormControl>
                    {levelOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Aucun niveau défini — créez-les d'abord dans Administration &gt; Niveaux.
                      </p>
                    )}
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