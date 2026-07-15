import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Student, Grade, Attendance, Payment } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { StudentPhoto } from '@/components/ui/student-photo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Pencil2Icon, ArrowLeftIcon } from '@radix-ui/react-icons'

const statusLabels: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  active: { label: 'Actif', variant: 'default' },
  inactive: { label: 'Inactif', variant: 'secondary' },
  graduated: { label: 'Diplômé', variant: 'outline' },
  suspended: { label: 'Suspendu', variant: 'destructive' }
}

const genderLabel: Record<string, string> = {
  M: 'Masculin',
  F: 'Féminin'
}

export function StudentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const doc = await getEntityById<Student>('Student', id)
      console.log('STUDENT_DETAIL doc', doc)
      return doc
    }
  })

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const docs = await queryEntities<any>('Class')
      console.log('CLASSES docs', docs)
      return docs
    },
    enabled: !!student
  })

  const { data: grades } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: async () => {
      const items = await queryEntities<Grade>('Grade', { studentId: id })
      return items ?? []
    },
    enabled: !!student
  })

  const { data: attendance } = useQuery({
    queryKey: ['student-attendance', id],
    queryFn: async () => queryEntities<Attendance>('Attendance', { studentId: id }),
    enabled: !!student
  })

  const { data: payments } = useQuery({
    queryKey: ['student-payments', id],
    queryFn: async () => {
      const items = await queryEntities<Payment>('Payment', { studentId: id })
      return items ?? []
    },
    enabled: !!student
  })

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Élève introuvable</p>
        <Button variant="outline" onClick={() => navigate('/students')}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  const status = statusLabels[student.status] || statusLabels.active
  const initials = getInitials(student.firstName, student.lastName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/students')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button onClick={() => navigate(`/students/${id}/edit`)}>
          <Pencil2Icon className="mr-2 h-4 w-4" />
          Modifier
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <StudentPhoto
              src={student.photoUrl}
              alt={student.firstName}
              initials={initials}
              className="h-32 w-32"
              entityId={student.id}
              fallbackClassName="text-3xl"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">
                  {student.firstName} {student.lastName}
                </h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Matricule: {student.registrationNumber}</span>
                <span>Classe: {student.class?.name ?? student.classId}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="grades">Notes</TabsTrigger>
          <TabsTrigger value="attendance">Présences</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nom:</span>
                  <p className="font-medium">{student.lastName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prénom:</span>
                  <p className="font-medium">{student.firstName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de naissance:</span>
                  <p className="font-medium">{formatDate(student.birthDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Genre:</span>
                  <p className="font-medium">{genderLabel[student.gender]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Matricule:</span>
                  <p className="font-medium">{student.registrationNumber}</p>
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
                {student.address && (
                  <div>
                    <span className="text-muted-foreground">Adresse:</span>
                    <p className="font-medium">{student.address}</p>
                  </div>
                )}
                {(student as any).phone && (
                  <div>
                    <span className="text-muted-foreground">Téléphone:</span>
                    <p className="font-medium">{(student as any).phone}</p>
                  </div>
                )}
                {student.parents && student.parents.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Parent(s) / Tuteur(s):</span>
                    <ul className="mt-1 space-y-1">
                      {student.parents.map((link) => (
                        <li key={link.id} className="font-medium">
                          {link.parent.firstName} {link.parent.lastName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {link.relation === 'TUTEUR' ? 'Tuteur' : 'Parent'}
                            {link.isPrimary ? ' · Principal' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!student.address &&
                  (!student.parents || student.parents.length === 0) && (
                    <p className="text-muted-foreground italic">Aucune information de contact</p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scolarité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Classe:</span>
                  <p className="font-medium">{student.class?.name ?? classes?.find((c: any) => c.id === student.classId)?.name ?? student.classId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut:</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Inscrit le:</span>
                  <p className="font-medium">{formatDate(student.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {grades && grades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Coefficient</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((grade) => (
                      <TableRow key={grade.id}>
                        <TableCell>{grade.subjectId}</TableCell>
                        <TableCell>
                          {grade.value}/{grade.maxValue}
                        </TableCell>
                        <TableCell>{grade.coefficient}</TableCell>
                        <TableCell className="capitalize">{grade.evaluationType}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucune note enregistrée</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Présences</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance && attendance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Justification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'present'
                                ? 'default'
                                : record.status === 'late'
                                  ? 'secondary'
                                  : record.status === 'excused'
                                    ? 'outline'
                                    : 'destructive'
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.justification || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune présence enregistrée
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Paiements</CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Montant total</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.amount.toLocaleString()} FCFA</TableCell>
                        <TableCell>{payment.paidAmount.toLocaleString()} FCFA</TableCell>
                        <TableCell>{formatDate(payment.dueDate)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === 'paid'
                                ? 'default'
                                : payment.status === 'partial'
                                  ? 'secondary'
                                  : payment.status === 'overdue'
                                    ? 'destructive'
                                    : 'outline'
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucun paiement enregistré</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">Aucun document disponible</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
