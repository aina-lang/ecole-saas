import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { saveEntity, queryEntities, deleteEntity } from '@/lib/db/pouchdb-compat'
import type { User, PaginatedResponse } from '@/types'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { getInitials } from '@/lib/utils'
import { StudentPhoto } from '@/components/ui/student-photo'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Pencil2Icon,
  ReloadIcon,
  TrashIcon
} from '@radix-ui/react-icons'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SetPasswordDialog } from '@/components/set-password-dialog'
import { KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, FilterBar } from '@/components/layout/page'

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
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [passwordFor, setPasswordFor] = useState<{ id: string; name: string } | null>(null)
  const limit = 10

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page, currentUserId],
    queryFn: async () => {
      const params: Record<string, string | number> = {}
      if (search) params.search = search
      if (roleFilter !== 'all') params.role = roleFilter
      const allUsers = await queryEntities<UserWithMeta>('User', params)
      // Son propre compte n'apparaît pas ici (il se gère via le menu Profil) :
      // on ne se désactive, ne se supprime ni ne se rétrograde soi-même.
      const filtered = allUsers.filter((u) => u.role !== 'PARENT' && u.role !== 'TEACHER' && u.id !== currentUserId)
      // Compte fondateur de l'établissement = premier administrateur créé :
      // il n'est ni supprimable ni désactivable (le serveur le garantit aussi).
      const founder = allUsers
        .filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
        .sort((a, b) => String((a as any).createdAt ?? '').localeCompare(String((b as any).createdAt ?? '')))[0]
      const total = filtered.length
      const offset = (page - 1) * limit
      const data = filtered.slice(offset, offset + limit)
      return { data, total, founderId: founder?.id ?? null } as PaginatedResponse<UserWithMeta> & { founderId: string | null }
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteEntity('User', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Utilisateur supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })



  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des utilisateurs"
        description="Gérer les comptes utilisateurs de l'établissement"
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
              disabled={isLoading}
              aria-label="Rafraîchir"
            >
              <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button onClick={() => navigate('/administration/users/new')}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter un utilisateur
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            { value: 'SECRETARY', label: 'Secrétaire' },
          ]}
          value={roleFilter}
          onValueChange={(v) => { setRoleFilter(v); setPage(1) }}
          placeholder="Rôle"
          className="w-[180px]"
        />
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'photo',
                label: 'Photo',
                render: (user) => (
                  <StudentPhoto
                    className="h-12 w-12"
                    src={(user as any).photoUrl}
                    alt={(user as any).firstName}
                    initials={getInitials((user as any).firstName, (user as any).lastName)}
                  />
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
              const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'cet utilisateur'
              const isFounder = u.id === (usersData as any)?.founderId
              return (
                <>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/administration/users/${u.id}/edit`) }}>
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Définir le mot de passe"
                    aria-label="Définir le mot de passe"
                    onClick={(e) => { e.stopPropagation(); setPasswordFor({ id: u.id, name }) }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  {isFounder ? (
                    <span className="flex h-10 items-center px-2 text-xs text-muted-foreground" title="Compte fondateur de l'établissement — protégé">
                      Fondateur
                    </span>
                  ) : (
                    <>
                      <div className="flex h-10 items-center px-1" title={u.isActive ? 'Compte actif' : 'Compte désactivé'}>
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={() => toggleActiveMutation.mutate({ id: u.id, isActive: u.isActive })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(u.id) }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <ConfirmDialog
                    open={deleteId === u.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={() => deleteMutation.mutate(u.id)}
                    title="Supprimer l'utilisateur"
                    description={`Êtes-vous sûr de vouloir supprimer définitivement ${name} ? Cette action est irréversible.`}
                    confirmLabel="Supprimer"
                    cancelLabel="Annuler"
                  />
                </>
              )
            }}
          />
        </CardContent>
      </Card>

      <SetPasswordDialog
        open={!!passwordFor}
        onOpenChange={(o) => !o && setPasswordFor(null)}
        userId={passwordFor?.id ?? null}
        userName={passwordFor?.name ?? ''}
        isSelf={!!passwordFor && passwordFor.id === currentUserId}
      />

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
