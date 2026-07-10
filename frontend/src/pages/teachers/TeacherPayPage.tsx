import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
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
  DialogDescription
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ReloadIcon } from '@radix-ui/react-icons'

interface CalculatedPayment {
  teacherId: string
  teacherName: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  totalHours: number
  hourlyRate: number
  baseAmount: number
  attendanceRate: number
  presentDays: number
  totalDays: number
  bonusAmount: number
  deductionAmount: number
  totalAmount: number
}

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payé',
  CANCELLED: 'Annulé'
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800'
}

export function TeacherPayPage() {
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [calcResult, setCalcResult] = useState<CalculatedPayment | null>(null)
  const [calcDialogOpen, setCalcDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: teachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data } = await client.get('/teachers')
      return data.data as Teacher[]
    }
  })

  const { data: payments, isLoading } = useQuery({
    queryKey: ['teacher-payments', selectedTeacher],
    queryFn: async () => {
      const params: any = {}
      if (selectedTeacher) params.teacherId = selectedTeacher
      const { data } = await client.get('/teacher-payments', { params })
      return data as any[]
    }
  })

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post('/teacher-payments/calculate', {
        teacherId: selectedTeacher,
        periodStart,
        periodEnd
      })
      return data as CalculatedPayment
    },
    onSuccess: (data) => {
      setCalcResult(data)
      setCalcDialogOpen(true)
    },
    onError: () => toast.error('Erreur de calcul')
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!calcResult) return
      await client.post('/teacher-payments', {
        teacherId: calcResult.teacherId,
        periodLabel: calcResult.periodLabel,
        periodStart: calcResult.periodStart,
        periodEnd: calcResult.periodEnd,
        totalHours: calcResult.totalHours,
        hourlyRate: calcResult.hourlyRate,
        baseAmount: calcResult.baseAmount,
        bonusAmount: calcResult.bonusAmount,
        deductionAmount: calcResult.deductionAmount,
        totalAmount: calcResult.totalAmount
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
      toast.success('Paiement enregistré')
      setCalcDialogOpen(false)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.post(`/teacher-payments/${id}/mark-paid`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
      toast.success('Paiement marqué comme payé')
    },
    onError: () => toast.error('Erreur')
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Paiements enseignants</h2>
          <p className="text-muted-foreground">Calculer et gérer les paiements</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calculer un paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <label className="text-sm font-medium">Enseignant</label>
              <Combobox
                options={(teachers ?? []).map((t) => ({ value: t.id, label: `${t.user.firstName} ${t.user.lastName}` }))}
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
                placeholder="Sélectionner"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Début période</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Fin période</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <Button
              disabled={!selectedTeacher || !periodStart || !periodEnd || calculateMutation.isPending}
              onClick={() => calculateMutation.mutate()}
            >
              {calculateMutation.isPending ? (
                <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Calcul...</>
              ) : 'Calculer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enseignant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Heures</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Prime</TableHead>
                <TableHead>Retenue</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">Chargement...</TableCell>
                </TableRow>
              ) : !payments?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">Aucun paiement</TableCell>
                </TableRow>
              ) : (
                payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.teacher?.user?.firstName} {p.teacher?.user?.lastName}
                    </TableCell>
                    <TableCell className="text-sm">{p.periodLabel}</TableCell>
                    <TableCell>{p.totalHours}h</TableCell>
                    <TableCell>{p.baseAmount.toLocaleString()} XAF</TableCell>
                    <TableCell className="text-green-600">+{p.bonusAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">-{p.deductionAmount.toLocaleString()}</TableCell>
                    <TableCell className="font-bold">{p.totalAmount.toLocaleString()} XAF</TableCell>
                    <TableCell>
                      <Badge className={paymentStatusColors[p.status] || ''} variant="secondary">
                        {paymentStatusLabels[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === 'PENDING' && (
                        <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(p.id)}>
                          Marquer payé
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={calcDialogOpen} onOpenChange={setCalcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résultat du calcul</DialogTitle>
            <DialogDescription>{calcResult?.periodLabel}</DialogDescription>
          </DialogHeader>
          {calcResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{calcResult.teacherName}</span>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total heures</span>
                  <span>{calcResult.totalHours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taux horaire</span>
                  <span>{calcResult.hourlyRate} XAF/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assiduité</span>
                  <span>{calcResult.presentDays}/{calcResult.totalDays} jours ({calcResult.attendanceRate}%)</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>Salaire de base</span>
                  <span>{calcResult.baseAmount.toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Prime d'assiduité</span>
                  <span>+{calcResult.bonusAmount.toLocaleString()} XAF</span>
                </div>
                {calcResult.deductionAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Retenue</span>
                    <span>-{calcResult.deductionAmount.toLocaleString()} XAF</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{calcResult.totalAmount.toLocaleString()} XAF</span>
                </div>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()}>
                Enregistrer le paiement
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
