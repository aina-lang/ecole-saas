import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { StudentEnrollment, Student, Level, Payment } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
        await saveEntity('Payment' as any, {
          id: crypto.randomUUID(),
          studentId: enrollment.studentId,
          amount,
          paidAmount: amount,
          status: 'paid',
          dueDate: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          receiptNumber: receipt || `RE-${Date.now()}`,
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
    setReceiptNumber(`RE-${Date.now()}`)
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
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.enAttente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.valides}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bloqués</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{stats.bloques}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
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
      </div>

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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune ré-inscription trouvée
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
                        <Badge variant="secondary">En attente</Badge>
                      )}
                      {enr.reinscriptionStatus === 'INSCRIT_ACTIF' && (
                        <Badge variant="default">Validé</Badge>
                      )}
                      {enr.reinscriptionStatus === 'BLOQUE' && (
                        <Badge variant="destructive">Bloqué</Badge>
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
