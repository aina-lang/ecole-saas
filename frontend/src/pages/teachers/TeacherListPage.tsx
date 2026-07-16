import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from '@/api/client'
import { queryEntities, deleteEntity, enrichTeachers } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'
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

export function TeacherListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: teachersData, isLoading } = useQuery<Teacher[]>({
    queryKey: ['teacher-list', search],
    queryFn: async () => {
      const all = await enrichTeachers(await queryEntities<Teacher>('Teacher'))
      if (!search.trim()) return all
      const q = search.toLowerCase()
      return all.filter((t) => {
        const t2 = t as any
        const first = (t2.user_firstName ?? '').toLowerCase()
        const last = (t2.user_lastName ?? '').toLowerCase()
        const specialty = (t2.specialty ?? '').toLowerCase()
        const email = (t2.user_email ?? '').toLowerCase()
        return first.includes(q) || last.includes(q) || specialty.includes(q) || email.includes(q)
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/teachers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-list'] })
      toast.success('Enseignant supprimé')
      setDeleteId(null)
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Enseignants</h2>
          <p className="text-muted-foreground">Liste et administration des enseignants</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['teacher-list'] })}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={() => navigate('/teachers/new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter un enseignant
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nom, prénom, spécialité, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'avatar',
                label: 'Avatar',
                render: (teacher) => {
                  const t = teacher as any
                  const initials = getInitials(t.user_firstName ?? '', t.user_lastName ?? '')
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
                render: (teacher) => {
                  const t = teacher as any
                  const first = t.user_firstName ?? ''
                  const last = t.user_lastName ?? ''
                  return `${first} ${last}`.trim() || 'Sans nom'
                },
                className: 'font-medium',
              },
              {
                key: 'email',
                label: 'Email',
                render: (teacher) => (teacher as any).user_email || '-',
              },
              {
                key: 'specialty',
                label: 'Spécialité',
                render: (teacher) => {
                  const s = (teacher as any).specialty
                  return s ? (
                    <Badge variant="secondary">{s}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )
                },
              },
              {
                key: 'phones',
                label: 'Téléphone',
                render: (teacher) => {
                  const t = teacher as any
                  const collected: string[] = []
                  for (let i = 0; i < 3; i++) {
                    const v = t[`user_phone_${i}`]
                    if (v) collected.push(v)
                  }
                  return collected.length > 0 ? collected.join(', ') : '-'
                },
              },
            ]}
            data={teachersData ?? []}
            total={(teachersData ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            onBulkDelete={(ids) => {
              Promise.all(ids.map((id) => deleteEntity('Teacher', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['teacher-list'] })
                  toast.success(`${ids.length} enseignant(s) supprimé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(teacher) => (teacher as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun enseignant trouvé"
            bulkDeleteLabel="enseignant(s)"
            renderRowActions={(teacher) => {
              const t = teacher as any
              const name = `${t.user_firstName ?? ''} ${t.user_lastName ?? ''}`.trim() || 'cet enseignant'
              return (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/teachers/${t.id}/edit`)
                    }}
                  >
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    open={deleteId === t.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={() => deleteMutation.mutate(t.id)}
                    title="Supprimer l'enseignant"
                    description={`Êtes-vous sûr de vouloir supprimer ${name} ? Cette action désactive le compte.`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(t.id)
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