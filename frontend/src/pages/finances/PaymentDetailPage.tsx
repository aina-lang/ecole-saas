import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { getEntityById, saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Payment, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'En attente', variant: 'outline' },
  partial: { label: 'Partiel', variant: 'secondary' },
  paid: { label: 'Payé', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulé', variant: 'outline' },
  refunded: { label: 'Remboursé', variant: 'secondary' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente' },
  { value: 'partial', label: 'Partiel' },
  { value: 'paid', label: 'Payé' },
  { value: 'overdue', label: 'En retard' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'refunded', label: 'Remboursé' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'mvola', label: 'Mvola' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
]

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => getEntityById<Payment>('Payment', id!),
    enabled: !!id,
  })

  const { data: students } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => queryEntities<Student>('Student'),
  })

  const student = students?.find((s: any) => s.id === payment?.studentId)
  const studentName = student
    ? `${student.firstName ?? (student as any).user_firstName ?? ''} ${student.lastName ?? (student as any).user_lastName ?? ''}`
    : payment?.studentId || '-'

  const [form, setForm] = useState({
    amount: 0,
    paidAmount: 0,
    status: 'pending',
    paymentMethod: '',
    reference: '',
    dueDate: '',
    notes: '',
  })

  useEffect(() => {
    if (payment) {
      setForm({
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        status: payment.status,
        paymentMethod: payment.paymentMethod || '',
        reference: payment.reference || '',
        dueDate: payment.dueDate?.split('T')[0] || '',
        notes: payment.notes || '',
      })
    }
  }, [payment])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveEntity('Payment', { ...payment, ...form, id: payment!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Paiement mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  if (isLoading) {
    return <div className="flex h-48 items-center justify-center text-muted-foreground">Chargement...</div>
  }

  if (!payment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/finances/payments')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground">Paiement introuvable</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finances/payments')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Modifier le paiement</h2>
          <p className="text-muted-foreground">
            {studentName} — {payment.dueDate ? format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: fr }) : '-'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détails du paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={statusConfig[form.status]?.variant || 'outline'}>
              {statusConfig[form.status]?.label || form.status}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Montant dû</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Montant payé</Label>
              <Input
                type="number"
                value={form.paidAmount}
                onChange={(e) => setForm((f) => ({ ...f, paidAmount: +e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Statut</Label>
            <Combobox
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v || 'pending' }))}
              options={STATUS_OPTIONS}
              placeholder="Sélectionner un statut"
            />
          </div>

          <div className="space-y-2">
            <Label>Moyen de paiement</Label>
            <Combobox
              value={form.paymentMethod}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v || '' }))}
              options={PAYMENT_METHODS}
              placeholder="Sélectionner..."
            />
          </div>

          <div className="space-y-2">
            <Label>Référence</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Numéro de reçu ou référence"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes optionnelles"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
