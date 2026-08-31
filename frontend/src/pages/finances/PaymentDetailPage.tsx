import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { getEntityById, saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import type { Payment, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { PageHeader, DetailHeader, InfoGrid, FormShell, FormSection } from '@/components/layout/page'

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
      <div className="space-y-6">
        <PageHeader backTo="/finances/payments" title="Paiement introuvable" description="Ce paiement n'existe pas ou a été supprimé." />
      </div>
    )
  }

  const dueDateLabel = payment.dueDate ? format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: fr }) : '-'
  const remaining = Math.max((form.amount || 0) - (form.paidAmount || 0), 0)
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === form.paymentMethod)?.label

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/finances/payments"
        title="Modifier le paiement"
        description={`${studentName} — ${dueDateLabel}`}
      />

      <FormShell
        hint="Les modifications sont enregistrées localement puis synchronisées."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/finances/payments')}>
              Annuler
            </Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <DetailHeader
          title={studentName}
          badges={
            <Badge variant={statusConfig[form.status]?.variant || 'outline'}>
              {statusConfig[form.status]?.label || form.status}
            </Badge>
          }
          meta={
            <>
              <span>Échéance : {dueDateLabel}</span>
              <span>Montant dû : {(form.amount || 0).toLocaleString('fr-FR')} Ar</span>
              <span>Payé : {(form.paidAmount || 0).toLocaleString('fr-FR')} Ar</span>
            </>
          }
        />

        <FormSection title="Récapitulatif" description="Situation actuelle du paiement.">
          <div className="sm:col-span-2">
            <InfoGrid
              columns={3}
              items={[
                { label: 'Montant dû', value: `${(form.amount || 0).toLocaleString('fr-FR')} Ar` },
                { label: 'Montant payé', value: `${(form.paidAmount || 0).toLocaleString('fr-FR')} Ar` },
                { label: 'Reste à payer', value: `${remaining.toLocaleString('fr-FR')} Ar` },
                { label: 'Moyen de paiement', value: methodLabel },
                { label: 'Référence', value: form.reference },
                { label: 'Payé le', value: payment.paidAt ? format(new Date(payment.paidAt), 'dd/MM/yyyy', { locale: fr }) : '' },
              ]}
            />
          </div>
        </FormSection>

        <FormSection title="Montants et échéance" description="Montant dû, montant déjà réglé et date limite.">
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
          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
        </FormSection>

        <FormSection title="Règlement" description="Statut, moyen de paiement et référence.">
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
        </FormSection>
      </FormShell>
    </div>
  )
}
