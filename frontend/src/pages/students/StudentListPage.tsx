import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Student, PaginatedResponse } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { PlusIcon, MagnifyingGlassIcon, Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'

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
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const limit = 10

  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const { data } = await client.get('/classes')
      return (data.data ?? data) as { id: string; name: string }[]
    }
  })

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', search, classFilter, statusFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit
      }
      if (search) params.search = search
      if (classFilter !== 'all') params.classId = classFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const { data } = await client.get('/students', { params })
      return data as PaginatedResponse<Student>
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/students/${id}`)
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !studentsData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Aucun élève trouvé
                  </TableCell>
                </TableRow>
              ) : (
                studentsData.data.map((student) => {
                  const status = statusLabels[student.status] || statusLabels.active
                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/students/${student.id}`)}
                    >
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.photoUrl || undefined} alt={student.firstName} />
                          <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{student.registrationNumber}</TableCell>
                      <TableCell>{student.lastName}</TableCell>
                      <TableCell>{student.firstName}</TableCell>
                      <TableCell>
                        {classes?.find((c) => c.id === student.classId)?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/students/${student.id}/edit`)}
                          >
                            <Pencil2Icon className="h-4 w-4" />
                          </Button>
                          <AlertDialog
                            open={deleteId === student.id}
                            onOpenChange={(open) => !open && setDeleteId(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(student.id)}
                              >
                                <TrashIcon className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer l'élève</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer {student.firstName}{' '}
                                  {student.lastName} ? Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeleteId(null)}>
                                  Annuler
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(student.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
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
    </div>
  )
}
