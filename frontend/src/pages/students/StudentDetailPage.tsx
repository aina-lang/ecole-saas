import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEntityById, queryEntities, saveEntity, deleteEntity } from '@/lib/db/pouchdb-compat'
import {
  loadCustomDocNames,
  saveCustomDocName,
  loadCustomFeeNames,
  saveCustomFeeItem
} from '@/lib/db/pouchdb'
import type { CustomFeeItem } from '@/lib/db/pouchdb'
import type { Student, Grade, Attendance, Payment, StudentDocument, FeeStructure } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { evalTypeToLabel } from '@/lib/evaluation-types'
import { StudentPhoto } from '@/components/ui/student-photo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogFooter
} from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Separator } from '@/components/ui/separator'
import {
  Pencil2Icon,
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  GearIcon
} from '@radix-ui/react-icons'
import { PrinterIcon } from 'lucide-react'
import { printPdf } from '@/lib/print-pdf'
import { getSchoolSettings } from '@/lib/school-settings'

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

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => queryEntities<any>('Subject'),
  })

  const subjectNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (subjects) {
      subjects.forEach((s: any) => map.set(s.id, s.name))
    }
    return map
  }, [subjects])

  const { data: attendance } = useQuery({
    queryKey: ['student-attendance', id],
    queryFn: async () => queryEntities<Attendance>('Attendance', { studentId: id }),
    enabled: !!student
  })

  const { data: payments, refetch: refetchPayments } = useQuery({
    queryKey: ['student-payments', id],
    queryFn: async () => {
      const items = await queryEntities<Payment>('Payment', { studentId: id })
      return items ?? []
    },
    enabled: !!student
  })

  const { data: dbFees } = useQuery({
    queryKey: ['student-fees', student?.classId],
    queryFn: async () => {
      const [allFees, allClasses] = await Promise.all([
        queryEntities<FeeStructure>('FeeStructure'),
        queryEntities<any>('Class'),
      ])
      const studentClass = allClasses?.find((c: any) => c.id === student?.classId)
      const levelId = studentClass?.levelId
      const filtered = (allFees ?? []).filter(
        (f) => f.isActive !== false && (!f.levelId || (levelId && f.levelId === levelId))
      )
      return { all: allFees ?? [], filtered: filtered.length > 0 ? filtered : (allFees ?? []).filter((f) => f.isActive !== false) }
    },
    enabled: !!student,
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
    }
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
  const [docFile, setDocFile] = useState<{
    data: string
    mime: string
    name: string
    size: number
  } | null>(null)
  const fileInputRef = useState<HTMLInputElement | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentFeeId, setPaymentFeeId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('espèces')
  const [paymentReference, setPaymentReference] = useState('')
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [showOtherFee, setShowOtherFee] = useState(false)
  const [paymentFeeDisabled, setPaymentFeeDisabled] = useState(false)
  const [viewPayment, setViewPayment] = useState<Payment | null>(null)
  const [customFeeName, setCustomFeeName] = useState('')
  const [customFeeAmount, setCustomFeeAmount] = useState('')
  const [customFeeItems, setCustomFeeItems] = useState<CustomFeeItem[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const savePaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      await saveEntity('Payment', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-payments', id] })
      setPaymentDialogOpen(false)
      setPaymentFeeId('')
      setPaymentAmount('')
      setPaymentReference('')
      setShowOtherFee(false)
      setCustomFeeName('')
      setCustomFeeAmount('')
      toast.success('Paiement enregistré')
    },
    onError: () => toast.error("Erreur lors de l'enregistrement du paiement")
  })

  useEffect(() => {
    if (!docDialogOpen) {
      setDocFileName('')
      setDocNotes('')
      setShowOtherInput(false)
      setCustomDocName('')
      setDocFile(null)
    }
  }, [docDialogOpen])

  useEffect(() => {
    if (!paymentDialogOpen) {
      setShowOtherFee(false)
      setCustomFeeName('')
      setCustomFeeAmount('')
      setSelectedMonths([])
      setSelectedYear(new Date().getFullYear())
    }
  }, [paymentDialogOpen])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setDocFile({
        data: reader.result as string,
        mime: file.type,
        name: file.name,
        size: file.size
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

  useEffect(() => {
    ;(async () => {
      const items = await loadCustomFeeNames()
      setCustomFeeItems(items)
    })()
  }, [])

  const allFees = useMemo(() => {
    const fees: (FeeStructure & { id: string })[] = [...(dbFees?.filtered ?? [])]
    const dbLabels = new Set(fees.map((f) => f.label.toLowerCase()))
    for (const item of customFeeItems) {
      if (!dbLabels.has(item.name.toLowerCase())) {
        fees.push({
          id: `custom_${item.name}`,
          label: item.name,
          amount: item.amount,
          dueDay: 15,
          feeType: 'OTHER',
          isActive: true,
        })
      }
    }
    return fees
  }, [dbFees, customFeeItems])

  const feeLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of dbFees?.all ?? []) {
      map[f.id] = f.label
    }
    for (const item of customFeeItems) {
      map[`custom_${item.name}`] = item.name
    }
    return map
  }, [dbFees, customFeeItems])

  const selectedFee = useMemo(() => {
    if (!paymentFeeId || paymentFeeId === '__custom__') return null
    return allFees.find((f) => f.id === paymentFeeId) ?? null
  }, [paymentFeeId, allFees])

  const academicMonths = useMemo(() => {
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const months: { value: string; label: string }[] = []
    for (let m = 0; m < 12; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, '0')}`
      months.push({ value: key, label: `${monthNames[m]} ${selectedYear}` })
    }
    return months
  }, [selectedYear])

  const totalDue = useMemo(() => {
    return allFees.reduce((s, f) => {
      if (f.id === 'monthly') return s + f.amount * 12
      return s + f.amount
    }, 0)
  }, [allFees])

  const paidMonthKeys = useMemo(() => {
    const monthlyPayments = (payments ?? []).filter((p) => p.feeStructureId === 'monthly')
    return new Set(monthlyPayments.flatMap((p) => {
      const m = p.notes?.match(/^(\d{4}-\d{2})$/)
      return m ? [m[1]] : []
    }))
  }, [payments])

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
    'Autre'
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
      setCustomNames((prev) => (prev.includes(name) ? prev : [...prev, name]))
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
      updatedAt: new Date().toISOString()
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

  async function handleRecordPayment() {
    if (!id || !paymentAmount) return

    if (selectedFee?.feeType === 'TUITION' && selectedMonths.length > 0) {
      const monthlyTuition = selectedFee.amount
      await Promise.all(selectedMonths.map((monthKey) => {
        const dueDate = new Date()
        dueDate.setDate(selectedFee.dueDay || 15)
        if (dueDate < new Date()) dueDate.setMonth(dueDate.getMonth() + 1)
        return saveEntity('Payment', {
          id: crypto.randomUUID(),
          studentId: id,
          feeStructureId: selectedFee.id,
          amount: monthlyTuition,
          paidAmount: monthlyTuition,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'paid',
          paymentMethod,
          reference: paymentReference || undefined,
          receiptNumber: `REC-${Date.now()}-${monthKey}`,
          paidAt: new Date().toISOString(),
          notes: monthKey,
        })
      }))
      queryClient.invalidateQueries({ queryKey: ['student-payments', id] })
      setPaymentDialogOpen(false)
      setPaymentFeeId('')
      setPaymentAmount('')
      setPaymentReference('')
      setShowOtherFee(false)
      setCustomFeeName('')
      setCustomFeeAmount('')
      setSelectedMonths([])
      setSelectedYear(new Date().getFullYear())
      toast.success(`${selectedMonths.length} mois payés`)
      return
    }

    let feeId = paymentFeeId
    let payAmount = Number(paymentAmount)
    let notes = paymentReference || undefined

    if (paymentFeeId === '__custom__' || !paymentFeeId) {
      const name = customFeeName || `libre_${Date.now()}`
      const amount = customFeeAmount ? Number(customFeeAmount) : payAmount
      feeId = `custom_${name}`
      payAmount = amount
      if (name && !customFeeItems.some((i) => i.name === name)) {
        saveCustomFeeItem({ name, amount }).then(() =>
          setCustomFeeItems((prev) => [...prev, { name, amount }])
        )
      }
    } else if (selectedFee?.feeType === 'ANNUAL') {
      notes = `Année: ${new Date().getFullYear()}`
    }
    const dueDate = new Date()
    dueDate.setDate(selectedFee?.dueDay || 15)
    if (dueDate < new Date()) dueDate.setMonth(dueDate.getMonth() + 1)
    savePaymentMutation.mutate({
      id: crypto.randomUUID(),
      studentId: id,
      feeStructureId: feeId,
      amount: payAmount,
      paidAmount: payAmount,
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'paid',
      paymentMethod,
      reference: paymentReference || undefined,
      receiptNumber: `REC-${Date.now()}`,
      paidAt: new Date().toISOString(),
      notes,
    } as any)
  }

  function formatNotes(text: string | undefined) {
    if (!text) return '-'
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    return text
      .replace(/(\d{4})-(\d{2})/g, (_, y, m) => `${monthNames[parseInt(m) - 1]} ${y}`)
      .replace(/^Année: (\d{4})$/, 'Année $1')
  }

  async function handlePrintReceipt(payment: Payment) {
    const school = await getSchoolSettings()
    const fee = allFees.find((f) => f.id === payment.feeStructureId)
    const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim()
    const className =
      student?.class?.name ?? classes?.find((c: any) => c.id === student?.classId)?.name ?? ''
    const logoHtml = school.logoDataUrl
      ? `<img src="${school.logoDataUrl}" alt="Logo" style="height:50px;width:auto;display:block;margin:0 auto 8px" />`
      : ''
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Reçu de paiement</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#333}
  .school-header{ text-align:center; margin-bottom:24px; }
  .school-header h1{ margin:0; font-size:22px; color:#1a365d; }
  .header{text-align:center;margin-bottom:20px}
  .header h2{margin:0;font-size:20px}
  .info{margin-bottom:20px}
  .info table{width:100%;border-collapse:collapse}
  .info td{padding:4px 8px}
  .info td:first-child{font-weight:bold;width:160px}
  .divider{border-top:2px solid #333;margin:20px 0}
  .details{width:100%;border-collapse:collapse;margin-bottom:20px}
  .details th,.details td{border:1px solid #ddd;padding:10px;text-align:left}
  .details th{background:#f5f5f5}
  .total{text-align:right;font-size:18px;font-weight:bold;margin-top:16px}
  .footer{text-align:center;margin-top:40px;color:#999;font-size:12px}
</style></head><body>
  <div class="school-header">${logoHtml}<h1>${school.schoolName}</h1></div>
  <div class="header">
    <h2>REÇU DE PAIEMENT</h2>
    <p>Année académique ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</p>
  </div>
  <div class="divider"></div>
  <div class="info">
    <table>
      <tr><td>Numéro de reçu</td><td>${payment.receiptNumber || payment.id.slice(0, 8)}</td></tr>
      <tr><td>Date de paiement</td><td>${formatDate(payment.paidAt || payment.dueDate)}</td></tr>
      <tr><td>Élève</td><td>${studentName}</td></tr>
      <tr><td>Classe</td><td>${className}</td></tr>
      <tr><td>Matricule</td><td>${student?.registrationNumber || 'N/A'}</td></tr>
    </table>
  </div>
  <div class="divider"></div>
  <table class="details">
    <thead><tr><th>Libellé</th><th>Montant</th></tr></thead>
    <tbody><tr><td>${fee?.label || 'Frais de scolarité'}</td><td>${payment.amount.toLocaleString()} Ar</td></tr></tbody>
  </table>
  <div class="total">Total payé : ${payment.paidAmount.toLocaleString()} Ar</div>
  <div class="footer">
    <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    <p>${school.schoolName} — Merci de votre confiance</p>
  </div>
</body></html>`
    const ok = await printPdf(html, `Reçu ${payment.receiptNumber || payment.id.slice(0, 8)}.pdf`)
    if (!ok) {
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close(); win.onload = () => win.print() }
      else toast.error('Popup bloquée. Autorisez les popups pour imprimer le reçu.')
    }
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
                <span>
                  Classe:{' '}
                  {student.class?.name ??
                    classes?.find((c: any) => c.id === student.classId)?.name ??
                    student.classId}
                </span>
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
                {!student.address && (!student.parents || student.parents.length === 0) && (
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
                  <p className="font-medium">
                    {student.class?.name ??
                      classes?.find((c: any) => c.id === student.classId)?.name ??
                      student.classId}
                  </p>
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
                        <TableCell>{subjectNameMap.get(grade.subjectId) ?? grade.subjectId}</TableCell>
                        <TableCell>
                          {grade.value}/{grade.maxValue}
                        </TableCell>
                        <TableCell>{grade.coefficient}</TableCell>
                        <TableCell>
                          {evalTypeToLabel(grade.evaluationType)}
                        </TableCell>
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

        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total dû
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {totalDue.toLocaleString()} Ar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total payé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {(payments ?? []).reduce((s, p) => s + p.paidAmount, 0).toLocaleString()} Ar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reste à payer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  {Math.max(0, totalDue - (payments ?? []).reduce((s, p) => s + p.paidAmount, 0)).toLocaleString()}{' '}
                  Ar
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Frais de scolarité</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/administration/settings')}
                >
                  <GearIcon className="mr-1 h-3 w-3" />
                  Configurer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Payé</TableHead>
                    <TableHead>Reste</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun frais défini
                      </TableCell>
                    </TableRow>
                  ) : (
                    allFees.map((fee) => {
                      const feePayments = (payments ?? []).filter(
                        (p) => p.feeStructureId === fee.id
                      )
                      if (fee.feeType === 'TUITION') {
                        const monthlyRate = fee.amount
                        const totalMonths = 12
                        const paidMonths = new Set(
                          feePayments.flatMap((p) => {
                            const m = p.notes?.match(/^(\d{4}-\d{2})$/)
                            return m ? [m[1]] : []
                          })
                        )
                        const paidCount = paidMonths.size
                        const paid = paidCount * monthlyRate
                        const rest = (totalMonths - paidCount) * monthlyRate
                        const status = paidCount >= totalMonths ? 'paid' : paidCount > 0 ? 'partial' : 'pending'
                        return (
                          <TableRow key={fee.id}>
                            <TableCell className="font-medium">
                              {fee.label}
                              <span className="ml-2 text-xs text-muted-foreground">({paidCount}/{totalMonths} mois)</span>
                            </TableCell>
                            <TableCell>{monthlyRate.toLocaleString()} Ar/mois</TableCell>
                            <TableCell>{paid.toLocaleString()} Ar</TableCell>
                            <TableCell className={rest > 0 ? 'text-destructive font-medium' : 'text-green-600'}>
                              {rest > 0 ? `${rest.toLocaleString()} Ar` : '0 Ar'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === 'paid' ? 'default' : status === 'partial' ? 'secondary' : 'outline'}>
                                {status === 'paid' ? 'Payé' : status === 'partial' ? 'Partiel' : 'En attente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" disabled={rest <= 0} onClick={() => {
                                setPaymentFeeId(fee.id)
                                setPaymentAmount(String(rest > 0 ? monthlyRate : 0))
                                setShowOtherFee(false)
                                setPaymentFeeDisabled(true)
                                setPaymentDialogOpen(true)
                              }}>
                                <PlusIcon className="mr-1 h-3 w-3" />
                                {rest <= 0 ? 'Payé' : 'Payer'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      }
                      const paid = feePayments.reduce((s, p) => s + p.paidAmount, 0)
                      const rest = fee.amount - paid
                      const status = paid >= fee.amount ? 'paid' : paid > 0 ? 'partial' : 'pending'
                      const isCustom = fee.id.startsWith('custom_')
                      return (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.label}</TableCell>
                          <TableCell>{fee.amount.toLocaleString()} Ar</TableCell>
                          <TableCell>{paid.toLocaleString()} Ar</TableCell>
                          <TableCell
                            className={rest > 0 ? 'text-destructive font-medium' : 'text-green-600'}
                          >
                            {rest.toLocaleString()} Ar
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                status === 'paid'
                                  ? 'default'
                                  : status === 'partial'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {status === 'paid'
                                ? 'Payé'
                                : status === 'partial'
                                  ? 'Partiel'
                                  : 'En attente'}
                            </Badge>
                          </TableCell>
                           <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rest <= 0}
                              onClick={() => {
                                setPaymentFeeDisabled(true)
                                if (isCustom) {
                                  setPaymentFeeId(fee.id)
                                  setCustomFeeName(fee.label)
                                  setCustomFeeAmount(String(fee.amount))
                                  setPaymentAmount(String(rest))
                                  setShowOtherFee(true)
                                } else {
                                  setPaymentFeeId(fee.id)
                                  setPaymentAmount(String(rest))
                                  setShowOtherFee(false)
                                }
                                setPaymentDialogOpen(true)
                              }}
                            >
                              <PlusIcon className="mr-1 h-3 w-3" />
                              {rest <= 0 ? 'Payé' : 'Payer'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historique des paiements</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setPaymentFeeId('')
                  setPaymentAmount('')
                  setShowOtherFee(true)
                  setPaymentFeeDisabled(false)
                  setPaymentDialogOpen(true)
                }}
              >
                <PlusIcon className="mr-1 h-3 w-3" />
                Nouveau paiement
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="max-w-[200px]">Notes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Reçu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Aucun paiement enregistré
                      </TableCell>
                    </TableRow>
                  ) : (
                    (payments ?? [])
                      .sort(
                        (a, b) =>
                          new Date(b.paidAt || b.dueDate).getTime() -
                          new Date(a.paidAt || a.dueDate).getTime()
                      )
                      .map((payment) => {
                        return (
                          <TableRow key={payment.id} className="cursor-pointer" onClick={() => setViewPayment(payment)}>
                            <TableCell>{formatDate(payment.paidAt || payment.dueDate)}</TableCell>
                            <TableCell>
                              {feeLabelMap[payment.feeStructureId ?? ''] ||
                                (payment.feeStructureId === 'monthly' ? 'Écolage mensuel' :
                                 payment.feeStructureId === 'annual' ? 'Frais annuels' :
                                 payment.feeStructureId?.replace(/^custom_/, '') || 'Frais de scolarité')}
                            </TableCell>
                            <TableCell>{payment.paidAmount.toLocaleString()} Ar</TableCell>
                            <TableCell>{payment.paymentMethod || '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {payment.reference || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={formatNotes(payment.notes)}>
                              {formatNotes(payment.notes)}
                            </TableCell>
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
                                {payment.status === 'paid'
                                  ? 'Payé'
                                  : payment.status === 'partial'
                                    ? 'Partiel'
                                    : payment.status === 'overdue'
                                      ? 'En retard'
                                      : 'En attente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handlePrintReceipt(payment) }}
                                title="Imprimer le reçu"
                              >
                                <PrinterIcon className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Enregistrer un paiement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frais</label>
                      <Combobox
                        disabled={paymentFeeDisabled}
                        options={[
                          { value: '__custom__', label: 'Autre (montant libre)' },
                          ...(dbFees?.filtered ?? []).map((f) => ({
                            value: f.id,
                            label: `${f.label} (${f.amount.toLocaleString()} Ar)`
                          })),
                          ...customFeeItems.map((item) => ({
                            value: `custom_${item.name}`,
                            label: `${item.name} (${item.amount.toLocaleString()} Ar)`
                          })),
                        ]}
                        value={
                          paymentFeeId === '__custom__' || !paymentFeeId ? '__custom__' : paymentFeeId
                        }
                        onValueChange={(v) => {
                          setPaymentFeeId(v)
                          setShowOtherFee(v === '__custom__')
                          if (v === '__custom__' || !v) {
                            setPaymentAmount('')
                            setCustomFeeName('')
                            setCustomFeeAmount('')
                          } else if (v.startsWith('custom_')) {
                            const item = customFeeItems.find((i) => `custom_${i.name}` === v)
                            if (item) {
                              setCustomFeeName(item.name)
                              setCustomFeeAmount(String(item.amount))
                              setPaymentAmount(String(item.amount))
                            }
                          } else {
                            const fee = allFees.find((f) => f.id === v)
                            if (fee) setPaymentAmount(String(fee.amount))
                          }
                        }}
                        placeholder="Sélectionner..."
                        searchPlaceholder="Rechercher..."
                      />
                      {showOtherFee && (
                        <div className="space-y-2 mt-2">
                          <label className="text-sm font-medium">Nom personnalisé</label>
                          <Input
                            placeholder="Ex: Frais de transport..."
                            value={customFeeName}
                            onChange={(e) => setCustomFeeName(e.target.value)}
                            autoFocus
                          />
                          <label className="text-sm font-medium mt-2">Montant dû (Ar)</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={customFeeAmount}
                            onChange={(e) => setCustomFeeAmount(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">Ce nom et montant seront enregistrés pour les prochains paiements</p>
                        </div>
                      )}
                      {selectedFee?.feeType === 'TUITION' && academicMonths.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Année</label>
                            <Input
                              type="number"
                              value={selectedYear}
                              onChange={(e) => {
                                const y = parseInt(e.target.value) || new Date().getFullYear()
                                setSelectedYear(y)
                              }}
                              className="w-24 h-8 text-sm"
                              min={2000}
                              max={2100}
                            />
                          </div>
                          <label className="text-sm font-medium">Mois à payer</label>
                          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded-md p-2">
                            {academicMonths.map((m) => {
                              const checked = selectedMonths.includes(m.value)
                              const alreadyPaid = paidMonthKeys.has(m.value)
                              return (
                                <label key={m.value} className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 ${alreadyPaid ? 'text-muted-foreground line-through cursor-not-allowed' : 'cursor-pointer hover:bg-accent'}`}>
                                  <Checkbox
                                    checked={checked || alreadyPaid}
                                    disabled={alreadyPaid}
                                    onCheckedChange={() => {
                                      if (alreadyPaid) return
                                      const next = checked
                                        ? selectedMonths.filter((v) => v !== m.value)
                                        : [...selectedMonths, m.value]
                                      setSelectedMonths(next)
                                      const monthlyTuition = selectedFee?.amount || 0
                                      setPaymentAmount(String(next.length * monthlyTuition))
                                    }}
                                  />
                                  {m.label}
                                </label>
                              )
                            })}
                          </div>
                          {selectedMonths.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {selectedMonths.map((key) => {
                                const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
                                const [y, m] = key.split('-')
                                const label = `${monthNames[parseInt(m) - 1]} ${y}`
                                return (
                                  <Badge key={key} variant="secondary" className="cursor-pointer gap-1" onClick={() => {
                                    const next = selectedMonths.filter((v) => v !== key)
                                    setSelectedMonths(next)
                                    const monthlyTuition = selectedFee?.amount || 0
                                    setPaymentAmount(String(next.length * monthlyTuition))
                                  }}>
                                    {label}
                                    <span className="text-xs ml-1">&times;</span>
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                          {selectedMonths.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {selectedMonths.length} mois × {(selectedFee?.amount || 0).toLocaleString()} Ar ={' '}
                              <strong>{(selectedMonths.length * (selectedFee?.amount || 0)).toLocaleString()} Ar</strong>
                            </p>
                          )}
                        </div>
                      )}
                  </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Montant (Ar)</label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode de paiement</label>
                  <Combobox
                    options={[
                      { value: 'espèces', label: 'Espèces' },
                      { value: 'virement', label: 'Virement bancaire' },
                      { value: 'mobile', label: 'Mobile money' },
                      { value: 'chèque', label: 'Chèque' }
                    ]}
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    placeholder="Sélectionner..."
                  />
                </div>
                {paymentMethod && paymentMethod !== 'espèces' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Référence (optionnel)</label>
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Numéro de transaction..."
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={!paymentAmount || savePaymentMutation.isPending}
                >
                  {savePaymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!viewPayment} onOpenChange={(o) => !o && setViewPayment(null)}>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Détails du paiement</DialogTitle>
              </DialogHeader>
              {viewPayment && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Reçu n°</span>
                    <span className="font-medium">{viewPayment.receiptNumber || viewPayment.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">{formatDate(viewPayment.paidAt || viewPayment.dueDate)}</span>
                    <span className="text-muted-foreground">Libellé</span>
                    <span className="font-medium">
  {feeLabelMap[viewPayment.feeStructureId ?? ''] ||
    (viewPayment.feeStructureId === 'monthly' ? 'Écolage mensuel' :
     viewPayment.feeStructureId === 'annual' ? 'Frais annuels' :
     viewPayment.feeStructureId?.replace(/^custom_/, '') || 'Frais de scolarité')}
</span>
                    <span className="text-muted-foreground">Montant payé</span>
                    <span className="font-medium">{viewPayment.paidAmount.toLocaleString()} Ar</span>
                    {viewPayment.amount !== viewPayment.paidAmount && (
                      <>
                        <span className="text-muted-foreground">Montant dû</span>
                        <span className="font-medium">{viewPayment.amount.toLocaleString()} Ar</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Mode de paiement</span>
                    <span className="font-medium capitalize">{viewPayment.paymentMethod || '-'}</span>
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-medium">{viewPayment.reference || '-'}</span>
                    <span className="text-muted-foreground">Statut</span>
                    <span className="font-medium">
                      <Badge variant={viewPayment.status === 'paid' ? 'default' : viewPayment.status === 'partial' ? 'secondary' : viewPayment.status === 'overdue' ? 'destructive' : 'outline'}>
                        {viewPayment.status === 'paid' ? 'Payé' : viewPayment.status === 'partial' ? 'Partiel' : viewPayment.status === 'overdue' ? 'En retard' : 'En attente'}
                      </Badge>
                    </span>
                    {viewPayment.notes && (
                      <>
                        <span className="text-muted-foreground">Notes</span>
                        <span className="font-medium">{formatNotes(viewPayment.notes)}</span>
                      </>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setViewPayment(null); handlePrintReceipt(viewPayment) }}>
                      <PrinterIcon className="mr-1 h-3 w-3" />
                      Imprimer le reçu
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                          Ce nom sera enregistré dans la base locale pour les prochaines
                          utilisations
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fichier</label>
                      <div className="flex items-center gap-2">
                        <Input type="file" onChange={handleFileSelect} className="flex-1" />
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
            onOpenChange={(o) => {
              if (!o) setDeleteDocId(null)
            }}
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
