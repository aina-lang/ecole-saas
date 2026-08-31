import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil1Icon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { queryEntities, saveEntity, deleteEntity } from '@/lib/db/pouchdb-compat'
import { LEVELS } from '@/lib/levels'
import type { Level } from '@/types'
import { PageHeader, FilterBar } from '@/components/layout/page'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import type { SortDirection, ColumnDef } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export function LevelsPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Level | null>(null)
  const [name, setName] = useState('')
  const [nextLevelId, setNextLevelId] = useState<string>('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: levels, isLoading } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const items = await queryEntities<Level>('Level')
      return items ?? []
    }
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await saveEntity('Level', { id: editing.id, name, nextLevelId: nextLevelId || null })
      } else {
        await saveEntity('Level', {
          id: crypto.randomUUID(),
          name,
          sortOrder: (levels?.length ?? 0),
          nextLevelId: nextLevelId || null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] })
      toast.success(editing ? 'Niveau mis à jour' : 'Niveau créé')
      setDialogOpen(false)
      setEditing(null)
      setName('')
      setNextLevelId('')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('Level', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] })
      toast.success('Niveau supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  // Ces niveaux (les vrais enregistrements Level, pas une liste figée) sont la
  // seule source utilisée ailleurs (ex: filtre par niveau des matières) —
  // ce bouton évite juste de les retaper à la main pour un nouvel
  // établissement, en partant de la nomenclature standard malgache.
  const seedMutation = useMutation({
    mutationFn: async () => {
      const ids = LEVELS.map(() => crypto.randomUUID())
      for (let i = 0; i < LEVELS.length; i++) {
        await saveEntity('Level', {
          id: ids[i],
          name: LEVELS[i],
          sortOrder: i,
          nextLevelId: i < LEVELS.length - 1 ? ids[i + 1] : null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] })
      toast.success('Niveaux standards créés')
    },
    onError: () => toast.error('Erreur lors de la création des niveaux'),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setNextLevelId('')
    setDialogOpen(true)
  }

  function openEdit(level: Level) {
    setEditing(level)
    setName(level.name)
    setNextLevelId(level.nextLevelId || '')
    setDialogOpen(true)
  }

  const filtered = useMemo(() => {
    let items = levels ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((l) => l.name.toLowerCase().includes(q))
    }
    if (sortBy) {
      items = [...items].sort((a, b) => {
        let aVal: any = (a as any)[sortBy] ?? ''
        let bVal: any = (b as any)[sortBy] ?? ''
        if (typeof aVal === 'string') aVal = aVal.toLowerCase()
        if (typeof bVal === 'string') bVal = bVal.toLowerCase()
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [levels, search, sortBy, sortDirection])

  const limit = 20
  const total = filtered.length
  const paginated = filtered.slice((page - 1) * limit, page * limit)

  const columns: ColumnDef<Level>[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'sortOrder', label: 'Ordre', sortable: true },
    { key: 'nextLevelId', label: 'Niveau supérieur', sortable: false, render: (level) => getLevelName(level.nextLevelId) },
  ]

  const nextLevelOptions = (levels ?? []).filter((l) => l.id !== editing?.id)
  const getLevelName = (id?: string) => (levels ?? []).find((l) => l.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Niveaux"
        description="Gérer les niveaux scolaires (6ème, 5ème, etc.)"
        actions={
          <>
            {!isLoading && (levels ?? []).length === 0 && (
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                Créer les niveaux standards (Madagascar)
              </Button>
            )}
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter un niveau
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un niveau..."
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
            columns={columns}
            data={paginated}
            total={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onSortChange={(key, dir) => { setSortBy(key); setSortDirection(dir); setPage(1) }}
            sortKey={sortBy}
            sortDirection={sortDirection}
            filters={{ name: search }}
            onFilterChange={(_key, value) => { setSearch(value); setPage(1) }}
            onBulkDelete={(ids) => {
              Promise.all(ids.map((id) => deleteEntity('Level', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['levels'] })
                  toast.success(`${ids.length} niveau(x) supprimé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(level) => level.id}
            isLoading={isLoading}
            emptyMessage="Aucun niveau défini"
            bulkDeleteLabel="niveau(x)"
            renderRowActions={(level) => (
              <>
                <Button variant="ghost" size="icon" onClick={() => openEdit(level)}>
                  <Pencil1Icon className="h-4 w-4" />
                </Button>
                <ConfirmDialog
                  open={deleteId === level.id}
                  onOpenChange={(open) => !open && setDeleteId(null)}
                  onConfirm={() => deleteMutation.mutate(level.id)}
                  title="Supprimer le niveau"
                  description="Cette action est irréversible."
                />
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(level.id)}>
                  <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le niveau' : 'Nouveau niveau'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du niveau</Label>
              <Input
                placeholder="Ex: 6ème, 5ème, Terminale..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Niveau supérieur (mapping)</Label>
              <p className="text-xs text-muted-foreground">
                Sélectionnez le niveau vers lequel les élèves admis passeront
              </p>
              <Select value={nextLevelId} onValueChange={setNextLevelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun (sortie du système)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun (sortie définitive)</SelectItem>
                  {nextLevelOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
                {editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
