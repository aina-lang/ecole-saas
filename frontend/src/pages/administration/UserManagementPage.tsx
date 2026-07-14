import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import client from '@/api/client'
import { saveEntity, queryEntities } from '@/lib/db/offline'
import type { User, PaginatedResponse } from '@/types'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { getPhotoUrl } from '@/api/client'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Pencil2Icon
} from '@radix-ui/react-icons'

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
      const params: Record<string, string | number> = { page, limit }
      if (search) params.search = search
      if (roleFilter !== 'all') params.role = roleFilter
      const result = await queryEntities<UserWithMeta>('User', params)
      return { data: result, total: result.length } as PaginatedResponse<UserWithMeta>
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
        <Button onClick={() => navigate('/administration/users/new')}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Ajouter un utilisateur
        </Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !usersData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                usersData.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getPhotoUrl(user.photoUrl)} alt={user.firstName} />
                        <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.lastName}</TableCell>
                    <TableCell>{user.firstName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.phones?.map((p) => p.value).join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role] || ''} variant="secondary">
                        {user.role === 'ADMIN' && 'Admin'}
                        {user.role === 'TEACHER' && 'Enseignant'}
                        {user.role === 'SECRETARY' && 'Secrétaire'}
                        {user.role === 'PARENT' && 'Parent'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">{user.isActive ? 'Actif' : 'Inactif'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                        : 'Jamais'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/administration/users/${user.id}/edit`)}>
                          <Pencil2Icon className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={user.isActive}
                          onCheckedChange={() =>
                            toggleActiveMutation.mutate({ id: user.id, isActive: user.isActive })
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {getPageNumbers().map((p, i) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={page === p}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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
