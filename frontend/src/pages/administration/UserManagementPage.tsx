import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import client from '@/api/client'
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
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
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
  Pencil2Icon,
  ReloadIcon
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

const userSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  role: z.enum(['ADMIN', 'TEACHER', 'SECRETARY', 'PARENT']),
  password: z.string().min(6, 'Minimum 6 caractères').optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  specialty: z.string().optional().or(z.literal(''))
})

type UserFormValues = z.infer<typeof userSchema>

interface UserWithMeta extends User {
  lastLoginAt?: string | null
  teacher?: { id: string; specialty?: string | null } | null
}

interface Option {
  id: string
  name: string
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder
}: {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  if (!options.length) {
    return <p className="text-xs text-muted-foreground">Aucune option disponible.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id)
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() =>
              onChange(active ? selected.filter((i) => i !== opt.id) : [...selected, opt.id])
            }
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent')
            }
          >
            {opt.name}
          </button>
        )
      })}
      {!selected.length && (
        <span className="text-xs text-muted-foreground">{placeholder}</span>
      )}
    </div>
  )
}

export function UserManagementPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<UserWithMeta | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([])
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([])
  const limit = 10

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit }
      if (search) params.search = search
      if (roleFilter !== 'all') params.role = roleFilter
      const { data } = await client.get('/users', { params })
      return data as PaginatedResponse<UserWithMeta>
    }
  })

  const { data: classes } = useQuery<Option[]>({
    queryKey: ['classes-opt'],
    queryFn: async () => {
      const res = await client.get('/classes')
      const items = (res.data.data ?? res.data) as Array<{ id: string; name: string }>
      return items.map((c) => ({ id: c.id, name: c.name }))
    }
  })

  const { data: subjects } = useQuery<Option[]>({
    queryKey: ['subjects-opt'],
    queryFn: async () => {
      const res = await client.get('/subjects')
      const items = (res.data.data ?? res.data) as Array<{ id: string; name: string }>
      return items.map((s) => ({ id: s.id, name: s.name }))
    }
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'TEACHER',
      password: '',
      phoneNumber: '',
      specialty: ''
    }
  })

  const watchedRole = form.watch('role')

  function resetTeacherState() {
    setTeacherClassIds([])
    setTeacherSubjectIds([])
  }

  async function openCreate() {
    setEditingUser(null)
    resetTeacherState()
    form.reset({
      email: '',
      firstName: '',
      lastName: '',
      role: 'TEACHER',
      password: '',
      phoneNumber: '',
      specialty: ''
    })
    setDialogOpen(true)
  }

  async function openEdit(user: UserWithMeta) {
    setEditingUser(user)
    resetTeacherState()
    form.reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserFormValues['role'],
      password: '',
      phoneNumber: user.phoneNumber ?? '',
      specialty: ''
    })

    if (user.role === 'TEACHER' && user.teacher?.id) {
      try {
        const { data } = await client.get(`/teachers/${user.teacher.id}`)
        const teacher = data.data ?? data
        form.setValue('specialty', teacher.specialty ?? '')
        setTeacherClassIds((teacher.classes ?? []).map((c: { id: string }) => c.id))
        setTeacherSubjectIds((teacher.subjects ?? []).map((s: { id: string }) => s.id))
      } catch {
        /* ignore */
      }
    }
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const baseUser = {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber || undefined
      }

      if (editingUser) {
        if (values.role === 'TEACHER' && editingUser.teacher?.id) {
          const payload: Record<string, unknown> = {
            ...baseUser,
            specialty: values.specialty || undefined,
            classIds: teacherClassIds,
            subjectIds: teacherSubjectIds
          }
          if (values.password) payload.password = values.password
          await client.patch(`/teachers/${editingUser.teacher.id}`, payload)
        } else {
          const payload: Record<string, unknown> = {
            ...baseUser,
            role: values.role,
            isActive: editingUser.isActive
          }
          if (values.password) payload.password = values.password
          await client.patch(`/users/${editingUser.id}`, payload)
        }
      } else {
        if (values.role === 'TEACHER') {
          await client.post('/teachers', {
            ...baseUser,
            password: values.password,
            specialty: values.specialty || undefined,
            classIds: teacherClassIds,
            subjectIds: teacherSubjectIds
          })
        } else {
          await client.post('/users', {
            ...baseUser,
            password: values.password,
            role: values.role
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['classes-opt'] })
      queryClient.invalidateQueries({ queryKey: ['subjects-opt'] })
      toast.success(editingUser ? 'Utilisateur modifié avec succès' : 'Utilisateur créé avec succès')
      setDialogOpen(false)
    },
    onError: () => {
      toast.error('Erreur lors de l\'enregistrement de l\'utilisateur')
    }
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await client.patch(`/users/${id}`, { isActive: !isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Statut modifié avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la modification du statut')
    }
  })

  const isTeacher = watchedRole === 'TEACHER'

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Modifiez les informations de l\'utilisateur'
                  : 'Créez un nouveau compte utilisateur'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Nom de famille" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Prénom" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemple.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="+261 ..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rôle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un rôle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADMIN">Administrateur</SelectItem>
                          <SelectItem value="TEACHER">Enseignant</SelectItem>
                          <SelectItem value="SECRETARY">Secrétaire</SelectItem>
                          <SelectItem value="PARENT">Parent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isTeacher && (
                  <div className="space-y-4 rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Informations enseignant</p>
                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Spécialité</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Mathématiques" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-1.5">
                      <FormLabel>Classes affectées</FormLabel>
                      <MultiSelect
                        options={classes ?? []}
                        selected={teacherClassIds}
                        onChange={setTeacherClassIds}
                        placeholder="Sélectionner des classes"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FormLabel>Matières enseignées</FormLabel>
                      <MultiSelect
                        options={subjects ?? []}
                        selected={teacherSubjectIds}
                        onChange={setTeacherSubjectIds}
                        placeholder="Sélectionner des matières"
                      />
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}</FormLabel>
                      <FormControl>
                        <Input placeholder={editingUser ? 'Laisser vide pour conserver' : '••••••••'} type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editingUser && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Permissions :</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {(rolePermissions[editingUser.role] || []).map((perm) => (
                        <li key={perm}>{perm}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <>
                        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      editingUser ? 'Modifier' : 'Créer'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
                <SelectItem value="TEACHER">Enseignant</SelectItem>
                <SelectItem value="SECRETARY">Secrétaire</SelectItem>
                <SelectItem value="PARENT">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !usersData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                usersData.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.lastName}</TableCell>
                    <TableCell>{user.firstName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.phoneNumber || '-'}</TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
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

      {editingUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Permissions - {editingUser.firstName} {editingUser.lastName}</CardTitle>
            <CardDescription>
              Rôle actuel : {editingUser.role === 'ADMIN' && 'Administrateur'}
              {editingUser.role === 'TEACHER' && 'Enseignant'}
              {editingUser.role === 'SECRETARY' && 'Secrétaire'}
              {editingUser.role === 'PARENT' && 'Parent'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(rolePermissions[editingUser.role] || []).map((perm) => (
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
