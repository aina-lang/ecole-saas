import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
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
import { cn } from '@/lib/utils'

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

  const { data: teachers, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<Teacher>('Teacher')

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['teacher-payments', selectedTeacher],
    queryFn: async () => {
      const filters: any = {}
      if (selectedTeacher) filters.teacherId = selectedTeacher
      return queryEntities('TeacherPayment', filters)
    }
  })

  const isLoading = loadingTeachers || isLoadingPayments

  const handleRefresh = () => {
    refetchTeachers()
    queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
  }

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post('/teacher-payments/calculate', {
        teacherId: selectedTeacher,
        periodStart,
        periodEnd
      })
      const result = data as CalculatedPayment
      await saveEntity('TeacherPayment', {
        id: crypto.randomUUID(),
        teacherId: result.teacherId,
        month: new Date(result.periodStart).getMonth() + 1,
        year: new Date(result.periodStart).getFullYear(),
        amount: result.totalAmount,
        status: 'PENDING',
      })
      return result
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
      await saveEntity('TeacherPayment', {
        id: crypto.randomUUID(),
        teacherId: calcResult.teacherId,
        month: new Date(calcResult.periodStart).getMonth() + 1,
        year: new Date(calcResult.periodStart).getFullYear(),
        amount: calcResult.totalAmount,
        status: 'PENDING',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
      toast.success('Paiement enregistré (mode hors-ligne)')
      setCalcDialogOpen(false)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      await saveEntity('TeacherPayment', { id, status: 'PAID' })
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
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
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
              <DatePicker
                value={periodStart}
                onChange={(d) => setPeriodStart(d ? format(d, 'yyyy-MM-dd') : '')}
                className="w-[180px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fin période</label>
              <DatePicker
                value={periodEnd}
                onChange={(d) => setPeriodEnd(d ? format(d, 'yyyy-MM-dd') : '')}
                className="w-[180px]"
              />
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
          <DataTable
            columns={[
              {
                key: 'teacherName',
                label: 'Enseignant',
                sortable: true,
                className: 'font-medium',
              },
              {
                key: 'periodLabel',
                label: 'Période',
                sortable: true,
              },
              {
                key: 'totalHours',
                label: 'Heures',
                sortable: true,
                render: (payment) => `${(payment as any).totalHours}h`,
              },
              {
                key: 'baseAmount',
                label: 'Base',
                sortable: true,
                render: (payment) => `${(payment as any).baseAmount.toLocaleString()} Ar`,
              },
              {
                key: 'bonusAmount',
                label: 'Prime',
                sortable: true,
                render: (payment) => `+${(payment as any).bonusAmount.toLocaleString()}`,
                className: 'text-green-600',
              },
              {
                key: 'deductionAmount',
                label: 'Retenue',
                sortable: true,
                render: (payment) => `-${(payment as any).deductionAmount.toLocaleString()}`,
                className: 'text-red-600',
              },
              {
                key: 'totalAmount',
                label: 'Total',
                sortable: true,
                render: (payment) => <span className="font-bold">{(payment as any).totalAmount.toLocaleString()} Ar</span>,
              },
              {
                key: 'status',
                label: 'Statut',
                sortable: true,
                render: (payment) => {
                  const p = payment as any
                  return (
                    <Badge className={paymentStatusColors[p.status] || ''} variant="secondary">
                      {paymentStatusLabels[p.status] || p.status}
                    </Badge>
                  )
                },
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (payment) => {
                  const p = payment as any
                  return p.status === 'PENDING' ? (
                    <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(p.id)}>
                      Marquer payé
                    </Button>
                  ) : null
                },
              },
            ]}
            data={payments ?? []}
            total={(payments ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(payment) => (payment as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun paiement"
          />
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
                  <span>{calcResult.hourlyRate} Ar/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assiduité</span>
                  <span>{calcResult.presentDays}/{calcResult.totalDays} jours ({calcResult.attendanceRate}%)</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>Salaire de base</span>
                  <span>{calcResult.baseAmount.toLocaleString()} Ar</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Prime d'assiduité</span>
                  <span>+{calcResult.bonusAmount.toLocaleString()} Ar</span>
                </div>
                {calcResult.deductionAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Retenue</span>
                    <span>-{calcResult.deductionAmount.toLocaleString()} Ar</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{calcResult.totalAmount.toLocaleString()} Ar</span>
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
