import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, deleteEntity } from '@/lib/db/pouchdb-compat'
import type { User, Student } from '@/types'
import { getInitials, cn } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  PlusIcon,
  Pencil2Icon,
  MagnifyingGlassIcon,
  ReloadIcon,
  TrashIcon,
} from '@radix-ui/react-icons'

export function ParentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: parents, isLoading: isLoadingParents } = useQuery({
    queryKey: ['parents', search],
    queryFn: async () => {
      const all = await queryEntities<User>('User')
      return all.filter((u) => u.role === 'PARENT')
    },
  })

  const { data: students } = useLocalQuery<Student>('Student')

  const enrichedParents = (parents ?? []).map((parent) => {
    const linkedStudents = (students ?? []).filter((s: any) =>
      (s.parents ?? []).some((p: any) => p.parentId === parent.id)
    )
    return {
      ...parent,
      studentCount: linkedStudents.length,
      students: linkedStudents,
    }
  })

  const filteredParents = enrichedParents.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('User', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] })
      toast.success('Parent supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Parents / Tuteurs</h2>
          <p className="text-muted-foreground">Gérer les comptes parents et tuteurs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['parents'] })}
            disabled={isLoadingParents}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoadingParents && 'animate-spin')} />
          </Button>
          <Button onClick={() => navigate('/parents/new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Nouveau parent
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
              placeholder="Rechercher par nom, prénom, email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'avatar',
                label: '',
                render: (parent) => {
                  const p = parent as any
                  const initials = getInitials(p.firstName || '', p.lastName || '')
                  return (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {initials}
                    </div>
                  )
                },
              },
              {
                key: 'name',
                label: 'Nom complet',
                sortable: true,
                render: (parent) => {
                  const p = parent as any
                  return `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Sans nom'
                },
                className: 'font-medium',
              },
              {
                key: 'email',
                label: 'Email',
                render: (parent) => (parent as any).email || '-',
              },
              {
                key: 'students',
                label: 'Enfants',
                render: (parent) => {
                  const p = parent as any
                  if (!p.students || p.students.length === 0) return '-'
                  return (
                    <div className="flex flex-wrap gap-1">
                      {p.students.map((s: Student) => (
                        <Badge
                          key={s.id}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => navigate(`/students/${s.id}`)}
                        >
                          {s.firstName} {s.lastName}
                        </Badge>
                      ))}
                    </div>
                  )
                },
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (parent) => {
                  const p = parent as any
                  return (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/administration/users/${p.id}/edit`)}
                      >
                        <Pencil2Icon className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        open={deleteId === p.id}
                        onOpenChange={(open) => !open && setDeleteId(null)}
                        onConfirm={() => deleteMutation.mutate(p.id)}
                        title="Supprimer le parent"
                        description={`Êtes-vous sûr de vouloir supprimer ${p.firstName} ${p.lastName} ? Les liens avec les élèves seront aussi supprimés.`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <TrashIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )
                },
              },
            ]}
            data={filteredParents}
            total={filteredParents.length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(parent) => (parent as any).id}
            isLoading={isLoadingParents}
            emptyMessage="Aucun parent trouvé"
          />
        </CardContent>
      </Card>
    </div>
  )
}