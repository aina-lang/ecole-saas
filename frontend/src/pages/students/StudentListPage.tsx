import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { deleteEntity, queryEntities, countEntities } from '@/lib/db/offline'
import type { Student, PaginatedResponse } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { StudentPhoto } from '@/components/ui/student-photo'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { PlusIcon, Pencil2Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons'

const statusLabels: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  active: { label: 'Actif', variant: 'default' },
  inactive: { label: 'Inactif', variant: 'secondary' },
  graduated: { label: 'Diplômé', variant: 'outline' },
  suspended: { label: 'Suspendu', variant: 'destructive' }
}

export function StudentListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const limit = 10

  const { data: classes } = useLocalQuery<{ id: string; name: string }>('Class')

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', search, classFilter, statusFilter, page, sortBy, sortDirection],
    queryFn: async () => {
      const offset = (page - 1) * limit
      const params: Record<string, string | number> = { limit, offset }
      if (search) params.search = search
      if (classFilter !== 'all') params.classId = classFilter
      if (statusFilter !== 'all') params.status = statusFilter
      if (sortBy) {
        params.sortBy = sortBy
        params.sortDirection = sortDirection
      }
      const [data, total] = await Promise.all([
        queryEntities<Student>('Student', params),
        countEntities<Student>('Student', params),
      ])
      return { data, total } as PaginatedResponse<Student>
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('Student', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Élève supprimé avec succès')
      setDeleteId(null)
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    }
  })

  const totalPages = studentsData ? Math.ceil(studentsData.total / limit) : 0

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
          <h2 className="text-2xl font-bold tracking-tight">Élèves</h2>
          <p className="text-muted-foreground">Gérer les élèves de l'établissement</p>
        </div>
        <Button onClick={() => navigate('/students/new')}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Ajouter un élève
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recherche et filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom ou matricule..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
            <Combobox
              className="w-[180px]"
              value={classFilter}
              onValueChange={(v) => {
                setClassFilter(v || 'all')
                setPage(1)
              }}
              placeholder="Classe"
              searchPlaceholder="Rechercher une classe..."
              options={[
                { value: 'all', label: 'Toutes les classes' },
                ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Combobox
              className="w-[150px]"
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
              placeholder="Statut"
              options={[
                { value: 'all', label: 'Tous les statuts' },
                { value: 'active', label: 'Actif' },
                { value: 'inactive', label: 'Inactif' },
                { value: 'graduated', label: 'Diplômé' },
                { value: 'suspended', label: 'Suspendu' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'photo',
                label: 'Photo',
                render: (student) => (
                  <StudentPhoto
                    src={(student as any).photoUrl}
                    alt={(student as any).firstName}
                    initials={getInitials((student as any).firstName, (student as any).lastName)}
                    className="h-12 w-12"
                    entityId={(student as any).id}
                  />
                ),
              },
              {
                key: 'registrationNumber',
                label: 'Matricule',
                sortable: true,
                className: 'font-medium',
              },
              {
                key: 'lastName',
                label: 'Nom',
                sortable: true,
              },
              {
                key: 'firstName',
                label: 'Prénom',
                sortable: true,
              },
              {
                key: 'class',
                label: 'Classe',
                render: (student) => {
                  const s = student as any
                  return classes?.find((c) => c.id === s.classId)?.name || '-'
                },
              },
              {
                key: 'status',
                label: 'Statut',
                render: (student) => {
                  const s = student as any
                  const status = statusLabels[s.status] || statusLabels.active
                  return <Badge variant={status.variant}>{status.label}</Badge>
                },
              },
            ]}
            data={studentsData?.data ?? []}
            total={studentsData?.total ?? 0}
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
            filters={{
              search,
              classId: classFilter === 'all' ? '' : classFilter,
              status: statusFilter === 'all' ? '' : statusFilter,
            }}
            onFilterChange={(key, value) => {
              if (key === 'search') setSearch(value)
              else if (key === 'classId') setClassFilter(value || 'all')
              else if (key === 'status') setStatusFilter(value || 'all')
              setPage(1)
            }}
            onRowClick={(student) => navigate(`/students/${(student as any).id}`)}
            onBulkDelete={(ids) => {
              // Bulk delete implementation
              Promise.all(ids.map(id => deleteEntity('Student', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['students'] })
                  toast.success(`${ids.length} élève(s) supprimé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(student) => (student as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun élève trouvé"
            bulkDeleteLabel="élève(s)"
            renderRowActions={(student) => {
              const s = student as any
              return (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/students/${s.id}/edit`)
                    }}
                  >
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    open={deleteId === s.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={() => deleteMutation.mutate(s.id)}
                    title="Supprimer l'élève"
                    description={`Êtes-vous sûr de vouloir supprimer ${s.firstName} ${s.lastName} ? Cette action est irréversible.`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(s.id)
                    }}
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
