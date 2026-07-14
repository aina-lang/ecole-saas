import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { PlusIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import client from '@/api/client'
import { queryEntities, saveEntity } from '@/lib/db/offline'
import type { Payment, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'En attente', variant: 'outline' },
  partial: { label: 'Partiel', variant: 'secondary' },
  paid: { label: 'Payé', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' }
}

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Le montant doit être positif'),
  method: z.string().min(1, 'Le moyen de paiement est requis'),
  reference: z.string().optional()
})

type RecordPaymentValues = z.infer<typeof recordPaymentSchema>

function fetchPayments(
  params: Record<string, string>
): Promise<Payment[]> {
  return queryEntities<Payment>('Payment', params)
}

function recordPaymentFn(paymentId: string, data: RecordPaymentValues) {
  return saveEntity('Payment', {
    id: crypto.randomUUID(),
    feeId: paymentId,
    amount: data.amount,
    paymentMethod: data.method,
    transactionId: data.reference || null,
    paymentDate: new Date().toISOString(),
  })
}

async function exportCsv(params: Record<string, string>) {
  const payments = await queryEntities<any>('Payment', params)
  const students = (await queryEntities<any>('Student')).reduce((map, s) => {
    map[s.id] = `${s.firstName || ''} ${s.lastName || ''}`.trim()
    return map
  }, {} as Record<string, string>)

  const header = 'Date;Élève;Montant;Méthode;Référence;Statut'
  const rows = (payments ?? []).map((p) =>
    [
      p.paymentDate ? format(new Date(p.paymentDate), 'dd/MM/yyyy') : '',
      students[p.studentId] || p.studentId || '',
      p.amount || 0,
      p.paymentMethod || '',
      p.transactionId || '',
      p.status || 'pending',
    ].join(';'),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `paiements-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

export function PaymentListPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [searchStudent, setSearchStudent] = useState('')
  const [paymentDialog, setPaymentDialog] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => fetchPayments(filters)
  })

  const { data: studentsData } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const data = await queryEntities<Student>('Student', { limit: 200 })
      return { data: { data } } as any
    }
  })

  const form = useForm<RecordPaymentValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { amount: 0, method: '', reference: '' }
  })

  const recordMutation = useMutation({
    mutationFn: (values: RecordPaymentValues) => recordPaymentFn(paymentDialog!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Paiement enregistré')
      setPaymentDialog(null)
      form.reset()
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement du paiement")
    }
  })

  const payments = data ?? []
  const students = studentsData?.data?.data ?? []

  function getStudentName(studentId: string) {
    const s = students.find((st) => st.id === studentId)
    return s ? `${s.firstName} ${s.lastName}` : studentId
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Paiements</h2>
          <p className="text-muted-foreground">Gérer les paiements des frais de scolarité.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportCsv(filters)}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Élève</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un élève..."
                  className="pl-9"
                  value={searchStudent}
                  onChange={(e) => {
                    setSearchStudent(e.target.value)
                    setFilters((prev) => ({ ...prev, studentId: e.target.value }))
                  }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Statut</label>
              <Combobox
                options={[
                  { value: ' ', label: 'Tous' },
                  { value: 'pending', label: 'En attente' },
                  { value: 'partial', label: 'Partiel' },
                  { value: 'paid', label: 'Payé' },
                  { value: 'overdue', label: 'En retard' }
                ]}
                value={filters.status ?? ''}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
                placeholder="Tous"
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Du</label>
              <DatePicker
                value={filters.dateFrom ?? ''}
                onChange={(d) => setFilters((prev) => ({ ...prev, dateFrom: d ? format(d, 'yyyy-MM-dd') : '' }))}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Au</label>
              <DatePicker
                value={filters.dateTo ?? ''}
                onChange={(d) => setFilters((prev) => ({ ...prev, dateTo: d ? format(d, 'yyyy-MM-dd') : '' }))}
                className="w-[150px]"
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters({})
                setSearchStudent('')
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Frais</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Payé</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun paiement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {getStudentName(payment.studentId)}
                    </TableCell>
                    <TableCell>{/* TODO: fee structure label */}Frais généraux</TableCell>
                    <TableCell>{payment.amount.toLocaleString('fr-FR')} XAF</TableCell>
                    <TableCell>{payment.paidAmount.toLocaleString('fr-FR')} XAF</TableCell>
                    <TableCell>
                      {format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[payment.status]?.variant ?? 'outline'}>
                        {statusConfig[payment.status]?.label ?? payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status !== 'paid' && (
                        <Dialog
                          open={paymentDialog === payment.id}
                          onOpenChange={(open) => {
                            setPaymentDialog(open ? payment.id : null)
                            if (!open) form.reset()
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                              <PlusIcon className="h-3 w-3" />
                              Paiement
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Enregistrer un paiement</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form
                                onSubmit={form.handleSubmit((values) =>
                                  recordMutation.mutate(values)
                                )}
                                className="space-y-4"
                              >
                                <FormField
                                  control={form.control}
                                  name="amount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Montant</FormLabel>
                                      <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="method"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Moyen de paiement</FormLabel>
                                      <Combobox
                                        options={[
                                          { value: 'cash', label: 'Espèces' },
                                          { value: 'mobile', label: 'Mobile Money' },
                                          { value: 'card', label: 'Carte bancaire' },
                                          { value: 'transfer', label: 'Virement' },
                                          { value: 'check', label: 'Chèque' }
                                        ]}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Sélectionner..."
                                      />
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="reference"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Référence (optionnel)</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Numéro de référence..." {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="flex justify-end gap-3 pt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setPaymentDialog(null)
                                      form.reset()
                                    }}
                                  >
                                    Annuler
                                  </Button>
                                  <Button type="submit" disabled={recordMutation.isPending}>
                                    {recordMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
