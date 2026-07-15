import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import client from '@/api/client'
import { saveEntity, queryEntities, countEntities } from '@/lib/db/pouchdb-compat'
import type { User, PaginatedResponse } from '@/types'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { getInitials } from '@/lib/utils'
import { getPhotoUrl } from '@/api/client'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Pencil2Icon,
  ReloadIcon
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  TEACHER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SECRETARY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PARENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
}

const rolePermissions: Record<string, string[]> = {
  ADMIN: [
    'Gestion complète des utilisateurs',
    'Configuration de l\'établissement',
    'Accès à tous les modules',
    'Gestion des rôles et permissions',
    'Consultation des journaux d\'audit'
  ],
  TEACHER: [
    'Saisie des notes',
    'Gestion des présences',
    'Consultation des élèves',
    'Communication avec les parents',
    'Emploi du temps'
  ],
  SECRETARY: [
    'Gestion des inscriptions',
    'Gestion des dossiers élèves',
    'Gestion des paiements',
    'Planning et emploi du temps',
    'Communications administratives'
  ],
  PARENT: [
    'Consultation des notes',
    'Suivi des présences',
    'Paiements en ligne',
    'Communication avec les enseignants',
    'Informations scolaires'
  ]
}

interface UserWithMeta extends User {
  lastLoginAt?: string | null
  teacher?: { id: string; specialty?: string | null } | null
}

export function UserManagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserWithMeta | null>(null)
  const limit = 10

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page],
    queryFn: async () => {
      const offset = (page - 1) * limit
      const params: Record<string, string | number> = { limit, offset }
      if (search) params.search = search
      if (roleFilter !== 'all') params.role = roleFilter
      const [data, total] = await Promise.all([
        queryEntities<UserWithMeta>('User', params),
        countEntities<UserWithMeta>('User', params),
      ])
      return { data, total } as PaginatedResponse<UserWithMeta>
    }
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await saveEntity('User', { id, isActive: !isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Statut modifié avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la modification du statut')
    }
  })

  const totalPages = usersData ? Math.ceil(usersData.total / limit) : 0

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
          <h2 className="text-2xl font-bold tracking-tight">Gestion des utilisateurs</h2>
          <p className="text-muted-foreground">Gérer les comptes utilisateurs de l'établissement</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={() => navigate('/administration/users/new')}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter un utilisateur
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom ou email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Combobox
              options={[
                { value: 'all', label: 'Tous les rôles' },
                { value: 'ADMIN', label: 'Administrateur' },
                { value: 'TEACHER', label: 'Enseignant' },
                { value: 'SECRETARY', label: 'Secrétaire' },
                { value: 'PARENT', label: 'Parent' }
              ]}
              value={roleFilter}
              onValueChange={(v) => { setRoleFilter(v); setPage(1) }}
              placeholder="Rôle"
              className="w-[180px]"
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
                render: (user) => (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={getPhotoUrl((user as any).photoUrl)} alt={(user as any).firstName} />
                    <AvatarFallback>{getInitials((user as any).firstName, (user as any).lastName)}</AvatarFallback>
                  </Avatar>
                ),
              },
              {
                key: 'lastName',
                label: 'Nom',
                sortable: true,
                className: 'font-medium',
              },
              {
                key: 'firstName',
                label: 'Prénom',
                sortable: true,
              },
              {
                key: 'email',
                label: 'Email',
                sortable: true,
              },
              {
                key: 'phones',
                label: 'Téléphone',
                render: (user) => (user as any).phones?.map((p: any) => p.value).join(', ') || '-',
              },
              {
                key: 'role',
                label: 'Rôle',
                render: (user) => {
                  const u = user as any
                  return (
                    <Badge className={roleColors[u.role] || ''} variant="secondary">
                      {u.role === 'ADMIN' && 'Admin'}
                      {u.role === 'TEACHER' && 'Enseignant'}
                      {u.role === 'SECRETARY' && 'Secrétaire'}
                      {u.role === 'PARENT' && 'Parent'}
                    </Badge>
                  )
                },
              },
              {
                key: 'isActive',
                label: 'Statut',
                render: (user) => {
                  const u = user as any
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">{u.isActive ? 'Actif' : 'Inactif'}</span>
                    </div>
                  )
                },
              },
              {
                key: 'lastLoginAt',
                label: 'Dernière connexion',
                render: (user) => {
                  const u = user as any
                  return u.lastLoginAt
                    ? format(new Date(u.lastLoginAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                    : 'Jamais'
                },
              },
            ]}
            data={usersData?.data ?? []}
            total={usersData?.total ?? 0}
            page={page}
            limit={limit}
            onPageChange={setPage}
            filters={{
              search,
              role: roleFilter === 'all' ? '' : roleFilter,
            }}
            onFilterChange={(key, value) => {
              if (key === 'search') setSearch(value)
              else if (key === 'role') setRoleFilter(value || 'all')
              setPage(1)
            }}
            onRowClick={(user) => setSelectedUser(user as UserWithMeta)}
            onBulkDelete={(ids) => {
              Promise.all(ids.map(id => saveEntity('User', { id, isActive: false })))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['admin-users'] })
                  toast.success(`${ids.length} utilisateur(s) désactivé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(user) => (user as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun utilisateur trouvé"
            bulkDeleteLabel="utilisateur(s)"
            renderRowActions={(user) => {
              const u = user as any
              return (
                <>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/administration/users/${u.id}/edit`) }}>
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={u.isActive}
                    onCheckedChange={() => toggleActiveMutation.mutate({ id: u.id, isActive: u.isActive })}
                  />
                </>
              )
            }}
          />
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Permissions - {selectedUser.firstName} {selectedUser.lastName}</CardTitle>
            <CardDescription>
              Rôle actuel : {selectedUser.role === 'ADMIN' && 'Administrateur'}
              {selectedUser.role === 'TEACHER' && 'Enseignant'}
              {selectedUser.role === 'SECRETARY' && 'Secrétaire'}
              {selectedUser.role === 'PARENT' && 'Parent'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(rolePermissions[selectedUser.role] || []).map((perm) => (
                <li key={perm} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {perm}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
