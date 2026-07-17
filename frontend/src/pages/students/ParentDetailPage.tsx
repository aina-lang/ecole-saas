import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import type { User, Student } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil2Icon, ArrowLeftIcon } from '@radix-ui/react-icons'

export function ParentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data: parent, isLoading } = useQuery({
    queryKey: ['parent', id],
    queryFn: async () => {
      const doc = await getEntityById<User>('User', id)
      return doc ?? null
    },
  })

  const { data: linkedStudents } = useQuery({
    queryKey: ['parent-students', id],
    queryFn: async () => {
      const all = await queryEntities<Student>('Student')
      return all.filter((s) =>
        (s as any).parents?.some((p: any) => p.parentId === id || p.parent?.id === id)
      )
    },
    enabled: !!parent,
  })

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!parent) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Parent introuvable</p>
        <Button variant="outline" onClick={() => navigate('/parents')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  const initials = getInitials(parent.firstName || '', parent.lastName || '')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/parents')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button onClick={() => navigate(`/parents/${id}/edit`)}>
          <Pencil2Icon className="mr-2 h-4 w-4" />
          Modifier
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-medium text-primary">
              {initials}
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-2xl font-bold">
                {parent.firstName} {parent.lastName}
              </h3>
              <p className="text-muted-foreground">{parent.email || 'Email non renseigné'}</p>
              <Badge variant="secondary">
                {parent.role === 'PARENT' ? 'Parent' : parent.role === 'TUTEUR' ? 'Tuteur' : parent.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p className="font-medium">{parent.email || 'Non renseigné'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Téléphone:</span>
              <p className="font-medium">
                {(parent as any).phone || (parent.phones?.[0]?.value) || 'Non renseigné'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Statut:</span>
              <Badge variant={parent.isActive ? 'default' : 'secondary'} className="ml-2">
                {parent.isActive ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Élèves liés ({linkedStudents?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedStudents && linkedStudents.length > 0 ? (
            <div className="space-y-2">
              {linkedStudents.map((student) => {
                const link = (student as any).parents?.find(
                  (p: any) => p.parentId === id || p.parent?.id === id
                )
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {student.registrationNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {link?.relation === 'TUTEUR' ? 'Tuteur' : 'Parent'}
                        {link?.isPrimary ? ' · Principal' : ''}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/students/${student.id}`)}
                      >
                        Voir
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Aucun élève lié à ce parent
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
