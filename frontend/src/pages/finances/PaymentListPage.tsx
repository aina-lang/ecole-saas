import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Download, RotateCw } from 'lucide-react'
import { PlusIcon, MagnifyingGlassIcon, Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'
import { queryEntities, deleteEntity, saveEntity, countEntities } from '@/lib/db/pouchdb-compat'
import { useLocalQuery } from '@/lib/db/hooks'
import type { Payment, Student } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

async function exportCsv(
  payments: Payment[],
  students: Record<string, string>
) {
  const header = 'Date;Élève;Montant;Méthode;Référence;Statut'
  const rows = (payments ?? []).map((p) =>
    [
      p.dueDate ? format(new Date(p.dueDate), 'dd/MM/yyyy') : '',
      students[p.studentId] || p.studentId || '',
      p.amount || 0,
      '-',
      '-',
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [paymentDialog, setPaymentDialog] = useState<string | null>(null)

  const { data: studentsRaw, loading: loadingStudents } = useLocalQuery<Student>('Student')
  const studentsMap = ((studentsRaw ?? []) as any[]).reduce((map, s) => {
    const first = s.firstName ?? (s as any).user_firstName ?? ''
    const last = s.lastName ?? (s as any).user_lastName ?? ''
    map[s.id] = `${first} ${last}`.trim()
    return map
  }, {} as Record<string, string>)

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', search, statusFilter, dateFrom, dateTo, sortBy, sortDirection],
    queryFn: async () => {
      let results = await queryEntities<Payment>('Payment')

      if (search.trim()) {
        const q = search.toLowerCase()
        results = results.filter((p) => {
          const name = (studentsMap[p.studentId] || '').toLowerCase()
          return name.includes(q) || (p.studentId || '').toLowerCase().includes(q)
        })
      }
      if (statusFilter !== 'all') {
        results = results.filter((p) => p.status === statusFilter)
      }
      if (dateFrom) {
        const from = new Date(dateFrom).getTime()
        results = results.filter((p) => p.dueDate && new Date(p.dueDate).getTime() >= from)
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime()
        results = results.filter((p) => p.dueDate && new Date(p.dueDate).getTime() <= to)
      }
      if (sortBy) {
        results = [...results].sort((a: any, b: any) => {
          const aVal = a[sortBy] ?? ''
          const bVal = b[sortBy] ?? ''
          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
          return 0
        })
      }

      const total = results.length
      return { data: results, total } as { data: Payment[]; total: number }
    },
  })

  const form = useForm<RecordPaymentValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { amount: 0, method: '', reference: '' }
  })

  const recordMutation = useMutation({
    mutationFn: (values: RecordPaymentValues) =>
      saveEntity('Payment', {
        id: paymentDialog,
        amountPaid: (payment as any).amount,
        paidAmount: values.amount,
        method: values.method,
        transactionId: values.reference || null,
        paymentDate: new Date().toISOString(),
      }),
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntity('Payment', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Paiement supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const payments = paymentsData?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Paiements</h2>
          <p className="text-muted-foreground">Gérer les paiements des frais de scolarité</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
            disabled={isLoading}
          >
            <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportCsv(payments, studentsMap)}
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recherche et filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom d'élève ou matricule..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Combobox
              className="w-[150px]"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v || 'all')}
              placeholder="Statut"
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'pending', label: 'En attente' },
                { value: 'partial', label: 'Partiel' },
                { value: 'paid', label: 'Payé' },
                { value: 'overdue', label: 'En retard' },
              ]}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Du</label>
              <DatePicker value={dateFrom} onChange={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Au</label>
              <DatePicker value={dateTo} onChange={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')} className="w-[140px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Élève',
                sortable: true,
                render: (payment) => {
                  const p = payment as any
                  return studentsMap[p.studentId] || '-'
                },
                className: 'font-medium',
              },
              {
                key: 'amount',
                label: 'Montant',
                sortable: true,
                render: (payment) => `${(payment as any).amount ?? 0} Ar`,
              },
              {
                key: 'paidAmount',
                label: 'Payé',
                sortable: true,
                render: (payment) => `${(payment as any).paidAmount ?? 0} Ar`,
              },
              {
                key: 'dueDate',
                label: 'Échéance',
                sortable: true,
                render: (payment) => {
                  const p = payment as any
                  return p.dueDate ? format(new Date(p.dueDate), 'dd/MM/yyyy', { locale: fr }) : '-'
                },
              },
              {
                key: 'status',
                label: 'Statut',
                sortable: true,
                render: (payment) => {
                  const p = payment as any
                  const cfg = statusConfig[p.status] || statusConfig.pending
                  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
                },
              },
            ]}
            data={payments}
            total={payments.length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            onSortChange={(key, dir) => {
              setSortBy(key)
              setSortDirection(dir)
            }}
            sortKey={sortBy}
            sortDirection={sortDirection}
            filters={{ search, statusFilter }}
            onFilterChange={() => {}}
            onBulkDelete={(ids) => {
              Promise.all(ids.map((id) => deleteEntity('Payment', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['payments'] })
                  toast.success(`${ids.length} paiement(s) supprimé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(payment) => (payment as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun paiement trouvé"
            bulkDeleteLabel="paiement(s)"
            renderRowActions={(payment) => {
              const p = payment as any
              return (
                <>
                  {p.status !== 'paid' && (
                    <Dialog open={paymentDialog === p.id} onOpenChange={(open) => { setPaymentDialog(open ? p.id : null); if (!open) form.reset() }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Enregistrer un paiement">
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enregistrer un paiement</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit((v) => recordMutation.mutate(v))} className="space-y-4">
                            <FormField control={form.control} name="amount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Montant</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="method" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Moyen de paiement</FormLabel>
                                <FormControl>
                                  <Combobox options={[
                                    { value: 'cash', label: 'Espèces' },
                                    { value: 'mvola', label: 'Mvola' },
                                    { value: 'airtel_money', label: 'Airtel Money' },
                                    { value: 'orange_money', label: 'Orange Money' },
                                    { value: 'transfer', label: 'Virement' },
                                    { value: 'check', label: 'Chèque' }
                                  ]} value={field.value} onValueChange={field.onChange} placeholder="Sélectionner..." />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="reference" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Référence (optionnel)</FormLabel>
                                <FormControl><Input placeholder="Numéro..." {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={recordMutation.isPending}>
                              {recordMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/finances/payments/${p.id}`)}>
                    <Pencil2Icon className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    open={deleteId === p.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={() => deleteMutation.mutate(p.id)}
                    title="Supprimer le paiement"
                    description="Êtes-vous sûr ? Cette action est irréversible."
                  />
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                    <TrashIcon className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}