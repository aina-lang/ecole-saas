import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import type { User, Student } from '@/types'
import { StudentPhoto } from '@/components/ui/student-photo'
import { getInitials } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil2Icon, PersonIcon } from '@radix-ui/react-icons'
import { ExportMenu } from '@/components/ui/export-menu'
import { exportParentProfile } from '@/lib/export/exporters'
import { PageHeader, DetailHeader, InfoGrid, EmptyState } from '@/components/layout/page'

export function ParentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data: parent, isLoading } = useQuery({
    queryKey: ['parent', id],
    queryFn: async () => {
      const doc = await getEntityById<User>('User', id!)
      return doc ?? null
    },
    // `id` vient de useParams() : sans ce garde, la requête partirait avec
    // undefined sur une URL malformée.
    enabled: !!id,
  })

  const { data: allStudents, isFetching: fetchingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const docs = await queryEntities<Student>('Student')
      return docs ?? []
    },
    staleTime: 30_000,
  })

  const linkedStudents = useMemo(() => {
    if (!allStudents) return undefined
    return allStudents.filter((s) =>
      (s as any).parents?.some((p: any) => p.parentId === id || p.parent?.id === id)
    )
  }, [allStudents, id])

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
  const allPhones = [
    ...new Set(
      [(parent as any).phone, ...(parent.phones?.map((p: any) => p.value) ?? [])].filter(Boolean),
    ),
  ] as string[]

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/parents"
        title="Fiche parent"
        description="Coordonnées, compte et élèves rattachés"
        actions={
          <>
            <ExportMenu onExport={(format) => exportParentProfile(id!, format)} label="Exporter la fiche" />
            <Button onClick={() => navigate(`/parents/${id}/edit`)}>
              <Pencil2Icon className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </>
        }
      />

      <DetailHeader
        avatar={
          <StudentPhoto
            className="h-20 w-20 text-2xl"
            src={parent.photoUrl}
            alt={`${parent.firstName} ${parent.lastName}`}
            initials={initials}
            fallbackClassName="text-2xl font-medium"
          />
        }
        title={`${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim()}
        subtitle={parent.email || 'Email non renseigné'}
        badges={
          <>
            <Badge variant="secondary">
              {parent.role === 'PARENT' ? 'Parent' : parent.role === 'TUTEUR' ? 'Tuteur' : parent.role}
            </Badge>
            <Badge variant={parent.isActive ? 'default' : 'secondary'}>
              {parent.isActive ? 'Actif' : 'Inactif'}
            </Badge>
          </>
        }
        meta={
          <span>
            {linkedStudents ? `${linkedStudents.length} élève(s) lié(s)` : 'Élèves liés : chargement...'}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoGrid
              columns={2}
              items={[
                { label: 'Email', value: parent.email },
                { label: 'Téléphone', value: allPhones.length > 0 ? allPhones.join(' / ') : null },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compte</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoGrid
              columns={2}
              items={[
                {
                  label: 'Statut',
                  value: (
                    <Badge variant={parent.isActive ? 'default' : 'secondary'}>
                      {parent.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  ),
                },
                {
                  label: 'Rôle',
                  value: parent.role === 'PARENT' ? 'Parent' : parent.role === 'TUTEUR' ? 'Tuteur' : parent.role,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Élèves liés {linkedStudents ? `(${linkedStudents.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fetchingStudents ? (
            <p className="py-4 text-center text-muted-foreground">Chargement...</p>
          ) : linkedStudents && linkedStudents.length > 0 ? (
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
            <EmptyState
              icon={<PersonIcon className="h-5 w-5" />}
              title="Aucun élève lié"
              description="Ce parent n'est rattaché à aucun élève pour le moment."
              action={
                <Button variant="outline" size="sm" onClick={() => navigate(`/parents/${id}/edit`)}>
                  Lier des élèves
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
