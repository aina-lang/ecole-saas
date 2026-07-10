import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowUpDown, Edit, Trash2, Plus, Search } from 'lucide-react'

import client from '@/api/client'
import type { Grade, PaginatedResponse, Subject } from '@/types'
import { cn } from '@/lib/utils'
import { formatSubjectLabel } from '@/lib/subject'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

interface GradeWithDetails extends Grade {
  student?: { id: string; firstName: string; lastName: string }
  subject?: { id: string; name: string; code: string | null; level: string | null; class?: { id: string; name: string } | null }
  createdAt?: string
}

interface ClassOption {
  id: string
  name: string
}

interface SubjectOption extends Subject {}

const evaluationTypeLabels: Record<string, string> = {
  exam: 'Examen',
  test: 'Test',
  homework: 'Devoir',
  project: 'Projet'
}

const evaluationTypeVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    exam: 'default',
    test: 'secondary',
    homework: 'outline',
    project: 'destructive'
  }

export function GradeListPage() {
  const queryClient = useQueryClient()

  const [classId, setClassId] = useState<string>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [semester, setSemester] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const limit = 10

  const { data: classes } = useQuery<ClassOption[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await client.get('/classes')
      return res.data.data ?? res.data
    }
  })

  const { data: subjects } = useQuery<SubjectOption[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await client.get('/subjects')
      return (res.data.data ?? res.data) as SubjectOption[]
    }
  })

  const { data: gradesResponse, isLoading } = useQuery<PaginatedResponse<GradeWithDetails>>({
    queryKey: ['grades', classId, subjectId, semester, page, sortBy, sortOrder],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit,
        sortBy,
        sortOrder
      }
      if (classId) params.classId = classId
      if (subjectId) params.subjectId = subjectId
      if (semester) params.semester = semester
      const res = await client.get('/grades', { params })
      return res.data.data ?? res.data
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/grades/${id}`)
    },
    onSuccess: () => {
      toast.success('Note supprimée avec succès')
      queryClient.invalidateQueries({ queryKey: ['grades'] })
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    }
  })

  const grades = gradesResponse?.data ?? []
  const total = gradesResponse?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  function SortHeader({ column, children }: { column: string; children: React.ReactNode }) {
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(column)}>
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </TableHead>
    )
  }

  function renderPageButtons() {
    const buttons: React.ReactNode[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    if (start > 1) {
      buttons.push(
        <PaginationItem key="1">
          <PaginationLink onClick={() => setPage(1)}>1</PaginationLink>
        </PaginationItem>
      )
      if (start > 2) {
        buttons.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        )
      }
    }

    for (let i = start; i <= end; i++) {
      buttons.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={i === page} onClick={() => setPage(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>
      )
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        )
      }
      buttons.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setPage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      )
    }

    return buttons
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notes</h2>
          <p className="text-muted-foreground">Consultez et gérez les notes des élèves.</p>
        </div>
        <Button asChild>
          <Link to="/grades/entry">
            <Plus className="mr-2 h-4 w-4" />
            Saisie de notes
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Combobox
                value={classId}
                onValueChange={(v) => {
                  setClassId(v || 'all')
                  setPage(1)
                }}
                placeholder="Classe"
                searchPlaceholder="Rechercher une classe..."
                options={[
                  { value: 'all', label: 'Toutes les classes' },
                  ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div className="w-48">
              <Combobox
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v || 'all')
                  setPage(1)
                }}
                placeholder="Matière"
                searchPlaceholder="Rechercher une matière..."
                options={[
                  { value: 'all', label: 'Toutes les matières' },
                  ...(subjects ?? []).map((s) => ({ value: s.id, label: formatSubjectLabel(s) })),
                ]}
              />
            </div>
            <div className="w-40">
              <Combobox
                value={semester}
                onValueChange={(v) => {
                  setSemester(v)
                  setPage(1)
                }}
                placeholder="Semestre"
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: '1', label: 'Semestre 1' },
                  { value: '2', label: 'Semestre 2' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader column="student">Élève</SortHeader>
                <SortHeader column="subject">Matière</SortHeader>
                <SortHeader column="value">Note</SortHeader>
                <TableHead>/ Max</TableHead>
                <SortHeader column="coefficient">Coefficient</SortHeader>
                <SortHeader column="evaluationType">Type</SortHeader>
                <SortHeader column="createdAt">Date</SortHeader>
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
              ) : grades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Aucune note trouvée.
                  </TableCell>
                </TableRow>
              ) : (
                grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell className="font-medium">
                      {grade.student
                        ? `${grade.student.lastName} ${grade.student.firstName}`
                        : grade.studentId}
                    </TableCell>
                    <TableCell>{grade.subject ? formatSubjectLabel(grade.subject) : grade.subjectId}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'font-semibold',
                          grade.value >= grade.maxValue * 0.8
                            ? 'text-green-600'
                            : grade.value >= grade.maxValue * 0.5
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        )}
                      >
                        {grade.value}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{grade.maxValue}</TableCell>
                    <TableCell>{grade.coefficient}</TableCell>
                    <TableCell>
                      <Badge variant={evaluationTypeVariants[grade.evaluationType] ?? 'outline'}>
                        {evaluationTypeLabels[grade.evaluationType] ?? grade.evaluationType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {grade.createdAt
                        ? format(new Date(grade.createdAt), 'dd MMM yyyy', { locale: fr })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/grades/entry?edit=${grade.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog
                          open={deleteId === grade.id}
                          onOpenChange={(open) => {
                            if (!open) setDeleteId(null)
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setDeleteId(grade.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette note ? Cette action est
                                irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(grade.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {renderPageButtons()}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
