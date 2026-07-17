import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEntityById, queryEntities, saveEntity, deleteEntity } from '@/lib/db/pouchdb-compat'
import { loadCustomDocNames, saveCustomDocName } from '@/lib/db/pouchdb'
import type { Student, Grade, Attendance, Payment, StudentDocument } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { StudentPhoto } from '@/components/ui/student-photo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Separator } from '@/components/ui/separator'
import { Pencil2Icon, ArrowLeftIcon, PlusIcon, TrashIcon, DownloadIcon } from '@radix-ui/react-icons'

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

const evaluationTypeLabels: Record<string, string> = {
  exam: 'Examen',
  test: 'Test',
  homework: 'Devoir',
  oral: 'Oral',
  project: 'Projet',
  controle: 'Contrôle',
  examen_blanc: 'Examen blanc',
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

  const { data: documents, refetch: refetchDocuments } = useQuery({
    queryKey: ['student-documents', id],
    queryFn: async () => {
      const items = await queryEntities<StudentDocument>('StudentDocument', { studentId: id })
      return items ?? []
    },
    enabled: !!student
  })

  const { data: parentUsers } = useQuery({
    queryKey: ['parent-users'],
    queryFn: async () => {
      const all = await queryEntities<any>('User')
      return all.filter((u) => u.role === 'PARENT')
    },
  })

  const parentMap = new Map(parentUsers?.map((u) => [u.id, u]) ?? [])

  const queryClient = useQueryClient()
  const [docDialogOpen, setDocDialogOpen] = useState(false)
  const [docFileName, setDocFileName] = useState('')
  const [docNotes, setDocNotes] = useState('')
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [customDocName, setCustomDocName] = useState('')
  const [customNames, setCustomNames] = useState<string[]>([])
  const [docFile, setDocFile] = useState<{ data: string; mime: string; name: string; size: number } | null>(null)
  const fileInputRef = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!docDialogOpen) {
      setDocFileName('')
      setDocNotes('')
      setShowOtherInput(false)
      setCustomDocName('')
      setDocFile(null)
    }
  }, [docDialogOpen])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setDocFile({
        data: reader.result as string,
        mime: file.type,
        name: file.name,
        size: file.size,
      })
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    ;(async () => {
      const names = await loadCustomDocNames()
      setCustomNames(names)
    })()
  }, [])

  const PREDEFINED_DOC_NAMES = [
    'Acte de naissance',
    'Certificat de scolarité',
    'Bulletin',
    "Photo d'identité",
    'Certificat médical',
    'Carnet de santé',
    "Fiche d'inscription",
    'Contrat de scolarité',
    'Relevé de notes',
    'Attestation',
    'Diplôme',
    'Autorisation parentale',
    'Convention de stage',
    'Autre',
  ]

  const allDocNames = [...new Set([...PREDEFINED_DOC_NAMES, ...customNames])]
  const docNameOptions = allDocNames.map((n) => ({ value: n, label: n }))

  function handleDocNameChange(value: string) {
    if (value === 'Autre') {
      setShowOtherInput(true)
      setDocFileName('')
    } else {
      setShowOtherInput(false)
      setDocFileName(value)
      setCustomDocName('')
    }
  }

  const finalFileName = showOtherInput ? customDocName : docFileName

  async function handleAddDocument() {
    const name = finalFileName
    if (!name || !id) return
    if (showOtherInput && !PREDEFINED_DOC_NAMES.includes(name)) {
      await saveCustomDocName(name)
      setCustomNames((prev) => prev.includes(name) ? prev : [...prev, name])
    }
    await saveEntity('StudentDocument', {
      studentId: id,
      fileName: name,
      notes: docNotes,
      fileData: docFile?.data,
      fileMimeType: docFile?.mime,
      fileOriginalName: docFile?.name,
      fileSize: docFile?.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setDocDialogOpen(false)
    queryClient.invalidateQueries({ queryKey: ['student-documents', id] })
  }

  function handleDownloadDocument(doc: StudentDocument) {
    if (!doc.fileData) return
    const link = document.createElement('a')
    link.href = doc.fileData
    link.download = doc.fileOriginalName || `${doc.fileName}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleDeleteDocument(docId: string) {
    await deleteEntity('StudentDocument', docId)
    setDeleteDocId(null)
    queryClient.invalidateQueries({ queryKey: ['student-documents', id] })
  }

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
                <span>Matricule: {student.registrationNumber || 'Non défini'}</span>
                <span>Classe: {student.class?.name ?? classes?.find((c: any) => c.id === student.classId)?.name ?? student.classId}</span>
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
                  <p className="font-medium">{student.registrationNumber || 'Non défini'}</p>
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
                      {student.parents.map((link: any) => {
                        const parentId = link.parent?.id ?? link.parentId
                        const parentUser = parentMap.get(parentId)
                        const name = link.parent
                          ? `${link.parent.firstName} ${link.parent.lastName}`
                          : parentUser
                            ? `${parentUser.firstName || ''} ${parentUser.lastName || ''}`.trim()
                            : parentId
                        return (
                          <li key={link.id ?? parentId}>
                            <button
                              onClick={() => navigate(`/parents/${parentId}`)}
                              className="font-medium text-primary hover:underline"
                            >
                              {name}
                            </button>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {link.relation === 'TUTEUR' ? 'Tuteur' : 'Parent'}
                              {link.isPrimary ? ' · Principal' : ''}
                            </span>
                          </li>
                        )
                      })}
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
                  <span className="text-muted-foreground">Inscrit le:</span>
                  <p className="font-medium">{formatDate(student.enrollmentDate)}</p>
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
                        <TableCell>{evaluationTypeLabels[grade.evaluationType] ?? grade.evaluationType}</TableCell>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusIcon className="mr-1 h-4 w-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouveau document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type de document</label>
                      <Combobox
                        options={docNameOptions}
                        value={showOtherInput ? '' : docFileName}
                        onValueChange={handleDocNameChange}
                        placeholder="Choisir un type..."
                        searchPlaceholder="Rechercher..."
                      />
                    </div>
                    {showOtherInput && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nom personnalisé</label>
                        <Input
                          placeholder="Saisir le nom du document..."
                          value={customDocName}
                          onChange={(e) => setCustomDocName(e.target.value)}
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                          Ce nom sera enregistré dans la base locale pour les prochaines utilisations
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fichier</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          onChange={handleFileSelect}
                          className="flex-1"
                        />
                      </div>
                      {docFile && (
                        <p className="text-xs text-muted-foreground">
                          {docFile.name} ({(docFile.size / 1024).toFixed(1)} Ko)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes (optionnel)</label>
                      <Input
                        placeholder="Ex: Original rendu aux parents"
                        value={docNotes}
                        onChange={(e) => setDocNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleAddDocument} disabled={!finalFileName || !docFile}>
                      Ajouter
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type de document</TableHead>
                      <TableHead>Fichier</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date d'ajout</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                        <TableCell>
                          {doc.fileData ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1"
                              onClick={() => handleDownloadDocument(doc)}
                            >
                              <DownloadIcon className="h-3.5 w-3.5" />
                              {doc.fileOriginalName || 'Télécharger'}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{doc.notes || '-'}</TableCell>
                        <TableCell>{formatDate(doc.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteDocId(doc.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucun document ajouté</p>
              )}
            </CardContent>
          </Card>

          <ConfirmDialog
            open={!!deleteDocId}
            onOpenChange={(o) => { if (!o) setDeleteDocId(null) }}
            title="Supprimer le document"
            description="Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible."
            confirmLabel="Supprimer"
            cancelLabel="Annuler"
            onConfirm={() => deleteDocId && handleDeleteDocument(deleteDocId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
