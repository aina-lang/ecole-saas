import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity, enrichTeachers } from '@/lib/db/pouchdb-compat'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
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

  const { data: teachersRaw, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<Teacher>('Teacher')

  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['enriched-teachers-pay', teachersRaw],
    queryFn: () => enrichTeachers(teachersRaw ?? []),
    enabled: !!teachersRaw,
  })

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['teacher-payments', selectedTeacher],
    queryFn: async () => {
      const filters: any = {}
      if (selectedTeacher) filters.teacherId = selectedTeacher
      return queryEntities('TeacherPayment', filters)
    }
  })

  const isLoading = isLoadingTeachers || isLoadingPayments

  const handleRefresh = () => {
    refetchTeachers()
    queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
  }

  const teacherOptions = (teachers ?? []).map((t) => {
    const first = (t as any).user_firstName || ''
    const last = (t as any).user_lastName || ''
    return { value: t.id, label: `${first} ${last}`.trim() || `Enseignant ${t.id.slice(0, 6)}` }
  })

  const calculateMutation = useMutation({
    mutationFn: async (): Promise<CalculatedPayment> => {
      const selected = teachers?.find((t) => t.id === selectedTeacher)
    const first = selected ? (selected as any).user_firstName ?? '' : ''
    const last = selected ? (selected as any).user_lastName ?? '' : ''
    const teacherName = `${first} ${last}`.trim() || 'Enseignant'

      const start = new Date(periodStart)
      const end = new Date(periodEnd)
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      const totalHours = Math.round(diffDays * 8 / 5 * 10) / 10
      const hourlyRate = 10000
      const baseAmount = Math.round(totalHours * hourlyRate)
      const totalAmount = baseAmount

      return {
        teacherId: selectedTeacher,
        teacherName,
        periodLabel: `${periodStart} → ${periodEnd}`,
        periodStart,
        periodEnd,
        totalHours,
        hourlyRate,
        baseAmount,
        attendanceRate: 100,
        presentDays: diffDays,
        totalDays: diffDays,
        bonusAmount: 0,
        deductionAmount: 0,
        totalAmount,
      }
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
        teacherName: calcResult.teacherName,
        month: new Date(calcResult.periodStart).getMonth() + 1,
        year: new Date(calcResult.periodStart).getFullYear(),
        amount: calcResult.totalAmount,
        periodStart: calcResult.periodStart,
        periodEnd: calcResult.periodEnd,
        status: 'PENDING',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-payments'] })
      toast.success('Paiement enregistré')
      setCalcDialogOpen(false)
    },
    onError: () => toast.error("Erreur lors de l'enregistrement")
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
                options={teacherOptions}
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
              key: 'teacher',
              label: 'Enseignant',
              render: (payment) => {
                const p = payment as any
                if (p.teacherName) return p.teacherName
                const t = teachers?.find((t) => t.id === p.teacherId)
                if (t) {
                  const first = (t as any).user_firstName || ''
                  const last = (t as any).user_lastName || ''
                  return `${first} ${last}`.trim() || '-'
                }
                return p.teacherId?.slice(0, 8) || '-'
              },
              className: 'font-medium',
            },
            {
              key: 'period',
              label: 'Période',
              render: (payment) => {
                const p = payment as any
                if (p.periodLabel) return p.periodLabel
                if (p.periodStart && p.periodEnd) return `${p.periodStart} → ${p.periodEnd}`
                const monthNames = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                const m = monthNames[p.month] || ''
                return m ? `${m} ${p.year || ''}`.trim() : '-'
              },
            },
              {
                key: 'amount',
                label: 'Montant',
                render: (payment) => `${(payment as any).amount ?? 0} Ar`,
                className: 'font-bold',
              },
              {
                key: 'status',
                label: 'Statut',
                render: (payment) => {
                  const p = payment as any
                  return (
                    <Badge className={paymentStatusColors[p.status] || ''} variant="secondary">
                      {paymentStatusLabels[p.status] || p.status || '-'}
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
                <Separator />
                <div className="flex justify-between">
                  <span>Salaire de base</span>
                  <span>{calcResult.baseAmount} Ar</span>
                </div>
                {calcResult.deductionAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Retenue</span>
                    <span>-{calcResult.deductionAmount} Ar</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{calcResult.totalAmount} Ar</span>
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