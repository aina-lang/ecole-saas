import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, deleteEntity } from '@/lib/db/pouchdb-compat'
import type { Class } from '@/types'
import { cn } from '@/lib/utils'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { PlusIcon, PersonIcon, ReloadIcon, TrashIcon, Pencil2Icon } from '@radix-ui/react-icons'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ExportMenu } from '@/components/ui/export-menu'
import { exportClassList } from '@/lib/export/exporters'

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
  const { data: allStudents } = useQuery({
    queryKey: ['all-students-for-counts'],
    queryFn: () => queryEntities<any>('Student'),
    staleTime: 60_000,
  })

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of (allStudents ?? [])) {
      if (s.classId) {
        map.set(s.classId, (map.get(s.classId) || 0) + 1)
      }
    }
    return map
  }, [allStudents])

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
      <PageHeader
        title="Classes"
        description="Gérer les classes de l'établissement"
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoadingRaw}
              aria-label="Rafraîchir"
            >
              <ReloadIcon className={cn('h-4 w-4', isLoadingRaw && 'animate-spin')} />
            </Button>
            <ExportMenu onExport={(format) => exportClassList(format)} size="default" />
            <Button onClick={() => navigate('/classes/new')}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une classe
            </Button>
          </>
        }
      />

      <FilterBar>
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
          <span className="text-sm text-muted-foreground">Trier par :</span>
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
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {allSelected ? 'Désélectionner tout' : 'Tout sélectionner'}
          </Button>
        )}
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Supprimer ({selectedIds.size})
          </Button>
        )}
      </FilterBar>

      {isLoadingRaw ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : pageClasses.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Aucune classe trouvée"
              description={search.trim() ? 'Aucune classe ne correspond à votre recherche.' : 'Commencez par créer votre première classe.'}
              action={
                <Button onClick={() => navigate('/classes/new')}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Créer la première classe
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageClasses.map((cls) => {
              const selected = selectedIds.has(cls.id)
              return (
                <Card
                  key={cls.id}
                  className={cn(
                    'group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md',
                    selected && 'ring-2 ring-primary'
                  )}
                >
                  <div
                    className="flex flex-1 cursor-pointer flex-col p-5"
                    onClick={() => navigate(`/classes/${cls.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={selected}
                        onCheckedChange={() => toggleSelect(cls.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Sélectionner ${cls.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold leading-tight">{cls.name}</h3>
                        <p className="text-sm text-muted-foreground">{cls.level || 'Niveau non défini'}</p>
                      </div>
                      {cls.room && (
                        <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
                          {cls.room}
                        </Badge>
                      )}
                    </div>

                    {(() => {
                      const count = studentCountByClass.get(cls.id) ?? 0
                      const capacity = Number(cls.capacity) || 0
                      const ratio = capacity ? Math.min(count / capacity, 1) : 0
                      const full = capacity > 0 && count >= capacity
                      return (
                        <div className="mt-5">
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <PersonIcon className="h-4 w-4" />
                              Effectif
                            </span>
                            <span className="font-medium tabular-nums">
                              {count}
                              <span className="text-muted-foreground"> / {capacity || '—'}</span>
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full transition-all', full ? 'bg-red-500' : ratio >= 0.9 ? 'bg-amber-500' : 'bg-primary')}
                              style={{ width: `${ratio * 100}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {capacity === 0
                              ? 'Capacité non définie'
                              : full
                                ? 'Classe complète'
                                : `${capacity - count} place${capacity - count > 1 ? 's' : ''} disponible${capacity - count > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-primary hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/students/new?classId=${cls.id}`)
                      }}
                    >
                      <PlusIcon className="mr-1.5 h-4 w-4" />
                      Ajouter un élève
                    </Button>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Modifier"
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
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteId(cls.id)
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
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