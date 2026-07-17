import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, deleteEntity, countEntities } from '@/lib/db/pouchdb-compat'
import type { Class } from '@/types'
import { cn } from '@/lib/utils'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { PlusIcon, PersonIcon, ReaderIcon, ReloadIcon, TrashIcon, Pencil2Icon } from '@radix-ui/react-icons'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export function ClassListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const limit = 9

  const { data: classesRaw, loading: isLoadingRaw, refetch } = useLocalQuery<Class>('Class')

  const sortedAndFiltered = (classesRaw ?? []).filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (c.name ?? '').toLowerCase().includes(q) || (c.level ?? '').toLowerCase().includes(q)
  }).sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? ''
    const bVal = (b as any)[sortBy] ?? ''
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / limit))
  const safePage = Math.min(page, totalPages)
  const pageClasses = sortedAndFiltered.slice((safePage - 1) * limit, safePage * limit)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('Class', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] })
      queryClient.invalidateQueries({ queryKey: ['class'] })
      toast.success('Classe supprimée')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteEntity('Class', id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] })
      queryClient.invalidateQueries({ queryKey: ['class'] })
      toast.success(`${selectedIds.size} classe(s) supprimée(s)`)
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === pageClasses.length && pageClasses.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageClasses.map((c) => c.id)))
    }
  }

  const allSelected = pageClasses.length > 0 && pageClasses.every((c) => selectedIds.has(c.id))
  const someSelected = pageClasses.some((c) => selectedIds.has(c.id)) && !allSelected

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('ellipsis')
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
        pages.push(i)
      }
      if (safePage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Classes</h2>
          <p className="text-muted-foreground">Gérer les classes de l'établissement</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoadingRaw}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoadingRaw && 'animate-spin')} />
          </Button>
          <Button onClick={() => navigate('/classes/new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter une classe
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une classe..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trier par:</span>
              <Combobox
                className="w-[220px]"
                placeholder="Nom (A-Z)"
                value={`${sortBy}:${sortDirection}`}
                onValueChange={(val) => {
                  const [key, dir] = val.split(':')
                  if (key) setSortBy(key)
                  if (dir) setSortDirection(dir as 'asc' | 'desc')
                }}
                options={[
                  { value: 'name:asc', label: 'Nom (A-Z)' },
                  { value: 'name:desc', label: 'Nom (Z-A)' },
                  { value: 'level:asc', label: 'Niveau (A-Z)' },
                  { value: 'level:desc', label: 'Niveau (Z-A)' },
                  { value: 'capacity:asc', label: 'Capacité (croissant)' },
                  { value: 'capacity:desc', label: 'Capacité (décroissant)' },
                ]}
              />
            </div>
            {pageClasses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {allSelected ? 'Désélectionner tout' : 'Tout sélectionner'}
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Supprimer ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoadingRaw ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : pageClasses.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
          <p>Aucune classe trouvée</p>
          <Button onClick={() => navigate('/classes/new')}>Créer la première classe</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageClasses.map((cls) => {
              const selected = selectedIds.has(cls.id)
              return (
                <Card
                  key={cls.id}
                  className={cn(
                    'relative transition-shadow hover:shadow-md',
                    selected && 'ring-2 ring-primary'
                  )}
                >
                  <div className="absolute left-3 top-3 z-10">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(cls.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div
                    className="cursor-pointer p-6 pt-10"
                    onClick={() => navigate(`/classes/${cls.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{cls.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{cls.level}</p>
                        </div>
                        <Badge variant="outline">{cls.room || 'Salle N/D'}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <PersonIcon className="h-4 w-4" />
                          <span>
                            {cls.studentCount || 0} / {cls.capacity}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ReaderIcon className="h-4 w-4" />
                          <span>Enseignants</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/students/new?classId=${cls.id}`)
                          }}
                        >
                          <PlusIcon className="mr-2 h-4 w-4" />
                          Ajouter un élève
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                  <div className="flex items-center justify-end gap-1 border-t p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/classes/${cls.id}/edit`)
                      }}
                    >
                      <Pencil2Icon className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      open={deleteId === cls.id}
                      onOpenChange={(open) => !open && setDeleteId(null)}
                      onConfirm={() => deleteMutation.mutate(cls.id)}
                      title="Supprimer la classe"
                      description={`Êtes-vous sûr de vouloir supprimer la classe "${cls.name}" ? Cette action est irréversible.`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(cls.id)
                      }}
                    >
                      <TrashIcon className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    className={cn(safePage <= 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
                {getPageNumbers().map((p, i) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`e-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={safePage === p}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    className={cn(safePage >= totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title={`Supprimer ${selectedIds.size} classe(s)`}
        description={`Êtes-vous sûr de vouloir supprimer ${selectedIds.size} classe(s) ? Cette action est irréversible.`}
      />
    </div>
  )
}