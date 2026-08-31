import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { StudentEnrollment, Student, Level, Payment } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle2, Ban } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components/ui/table'

export function ReinscriptionPage() {
  const queryClient = useQueryClient()

  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [validateDialogOpen, setValidateDialogOpen] = useState(false)
  const [selectedEnrollment, setSelectedEnrollment] = useState<StudentEnrollment | null>(null)
  const [reinscriptionAmount, setReinscriptionAmount] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['studentEnrollments'],
    queryFn: async () => {
      const items = await queryEntities<any>('StudentEnrollment' as any)
      return (items ?? []) as StudentEnrollment[]
    }
  })

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const items = await queryEntities<Student>('Student')
      return items ?? []
    }
  })

  const { data: levels } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const items = await queryEntities<Level>('Level')
      return items ?? []
    }
  })

  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const items = await queryEntities<Payment>('Payment')
      return items ?? []
    }
  })

  const debtMap = useMemo(() => {
    const map = new Map<string, Payment[]>()
    if (!payments) return map
    for (const p of payments) {
      if (p.status === 'pending' || p.status === 'overdue') {
        const existing = map.get(p.studentId) ?? []
        existing.push(p)
        map.set(p.studentId, existing)
      }
    }
    return map
  }, [payments])

  const enriched = useMemo(() => {
    if (!enrollments) return []
    const studentMap = new Map(students?.map((s) => [s.id, s]) ?? [])
    const levelMap = new Map(levels?.map((l) => [l.id, l]) ?? [])

    return enrollments.map((enr) => {
      const student = studentMap.get(enr.studentId)
      const level = levelMap.get(enr.levelId)
      const debts = debtMap.get(enr.studentId) ?? []
      const totalDebt = debts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

      return {
        ...enr,
        studentName: student ? `${student.firstName ?? ''} ${student.lastName}`.trim() : '—',
        registrationNumber: student?.registrationNumber ?? '—',
        levelName: level?.name ?? '—',
        debts,
        totalDebt,
        hasDebt: debts.length > 0
      }
    })
  }, [enrollments, students, levels, debtMap])

  const stats = useMemo(() => {
    const enAttente = enriched.filter((e) => e.reinscriptionStatus === 'PRE_INSCRIT').length
    const valides = enriched.filter((e) => e.reinscriptionStatus === 'INSCRIT_ACTIF').length
    const bloques = enriched.filter((e) => e.reinscriptionStatus === 'BLOQUE').length
    return { enAttente, valides, bloques }
  }, [enriched])

  const filtered = useMemo(() => {
    let items = enriched
    if (levelFilter) {
      items = items.filter((e) => e.levelId === levelFilter)
    }
    if (statusFilter) {
      items = items.filter((e) => e.reinscriptionStatus === statusFilter)
    }
    return items
  }, [enriched, levelFilter, statusFilter])

  const uniqueLevels = useMemo(() => {
    const seen = new Set<string>()
    const result: Level[] = []
    for (const e of enriched) {
      if (!seen.has(e.levelId)) {
        seen.add(e.levelId)
        const l = levels?.find((lv) => lv.id === e.levelId)
        if (l) result.push(l)
      }
    }
    return result.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [enriched, levels])

  const updateStatus = useMutation({
    mutationFn: async ({
      enrollment,
      status,
      amount,
      receipt
    }: {
      enrollment: StudentEnrollment
      status: 'INSCRIT_ACTIF' | 'BLOQUE'
      amount?: number
      receipt?: string
    }) => {
      await saveEntity('StudentEnrollment' as any, {
        ...enrollment,
        reinscriptionStatus: status,
        updatedAt: new Date().toISOString()
      })

      if (status === 'INSCRIT_ACTIF' && amount && amount > 0) {
        // Suffixe UUID comme les autres reçus : deux postes hors ligne ne
        // peuvent pas générer le même numéro (unicité par tenant en base).
        // Un numéro saisi manuellement (reçu papier) est conservé tel quel.
        const paymentId = crypto.randomUUID()
        await saveEntity('Payment' as any, {
          id: paymentId,
          studentId: enrollment.studentId,
          amount,
          paidAmount: amount,
          status: 'paid',
          dueDate: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          receiptNumber: receipt || `RE-${Date.now()}-${paymentId.slice(0, 6).toUpperCase()}`,
          notes: 'Droit de ré-inscription',
          academicYearId: enrollment.academicYearId
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentEnrollments'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Statut de ré-inscription mis à jour')
      setValidateDialogOpen(false)
      setSelectedEnrollment(null)
      setReinscriptionAmount('')
      setReceiptNumber('')
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  })

  function openValidateDialog(enrollment: (typeof enriched)[number]) {
    setSelectedEnrollment(enrollment)
    setReinscriptionAmount('')
    setReceiptNumber(`RE-${Date.now()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`)
    setValidateDialogOpen(true)
  }

  function openBlock(enrollment: (typeof enriched)[number]) {
    if (!confirm(`Bloquer la ré-inscription de ${enrollment.studentName} ?`)) return
    updateStatus.mutate({ enrollment, status: 'BLOQUE' })
  }

  function confirmValidate() {
    if (!selectedEnrollment) return
    const amount = parseFloat(reinscriptionAmount)
    if (reinscriptionAmount && (isNaN(amount) || amount <= 0)) {
      toast.error('Montant invalide')
      return
    }
    updateStatus.mutate({
      enrollment: selectedEnrollment,
      status: 'INSCRIT_ACTIF',
      amount: amount || 0,
      receipt: receiptNumber || undefined
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ré-inscriptions"
        description="Validation des ré-inscriptions et contrôle des dettes"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ['En attente', stats.enAttente, Clock, 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', 'À valider'],
          ['Validés', stats.valides, CheckCircle2, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', 'Ré-inscription confirmée'],
          ['Bloqués', stats.bloques, Ban, 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', 'Dettes à régulariser'],
        ] as const).map(([label, value, Icon, iconClass, hint]) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-4">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', iconClass)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FilterBar>
        <div className="w-48">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tous les niveaux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les niveaux</SelectItem>
              {uniqueLevels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les statuts</SelectItem>
              <SelectItem value="PRE_INSCRIT">En attente</SelectItem>
              <SelectItem value="INSCRIT_ACTIF">Validé</SelectItem>
              <SelectItem value="BLOQUE">Bloqué</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Dettes</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollmentsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      title="Aucune ré-inscription"
                      description="Aucune ré-inscription ne correspond aux filtres."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((enr) => (
                  <TableRow key={enr.id}>
                    <TableCell>
                      <div className="font-medium">{enr.studentName}</div>
                      <div className="text-xs text-muted-foreground">{enr.registrationNumber}</div>
                    </TableCell>
                    <TableCell>{enr.levelName}</TableCell>
                    <TableCell>
                      {enr.hasDebt ? (
                        <Badge variant="destructive">
                          Bloqué — {enr.totalDebt.toLocaleString()} Ar
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Aucune dette</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {enr.reinscriptionStatus === 'PRE_INSCRIT' && (
                        <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">En attente</Badge>
                      )}
                      {enr.reinscriptionStatus === 'INSCRIT_ACTIF' && (
                        <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Validé</Badge>
                      )}
                      {enr.reinscriptionStatus === 'BLOQUE' && (
                        <Badge variant="outline" className="border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Bloqué</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {enr.reinscriptionStatus === 'PRE_INSCRIT' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => openValidateDialog(enr)}>
                            Valider ré-inscription
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => openBlock(enr)}
                          >
                            Bloquer
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la ré-inscription</DialogTitle>
            <DialogDescription>
              {selectedEnrollment && (
                <>
                  Élève : {enriched.find((e) => e.id === selectedEnrollment.id)?.studentName ?? '—'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Droit de ré-inscription (optionnel)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                placeholder="Montant en Ar"
                value={reinscriptionAmount}
                onChange={(e) => setReinscriptionAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt">Numéro de reçu</Label>
              <Input
                id="receipt"
                placeholder="RE-..."
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setValidateDialogOpen(false)
                  setSelectedEnrollment(null)
                  setReinscriptionAmount('')
                  setReceiptNumber('')
                }}
              >
                Annuler
              </Button>
              <Button onClick={confirmValidate} disabled={updateStatus.isPending}>
                Confirmer la validation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
