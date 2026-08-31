import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MagnifyingGlassIcon, Pencil1Icon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { queryEntities, saveEntity, deleteEntity } from '@/lib/db/pouchdb-compat'
import { loadCustomFeeNames, saveCustomFeeItem } from '@/lib/db/pouchdb'
import type { FeeStructure as FeeType, Level } from '@/types'
import type { CustomFeeItem } from '@/lib/db/pouchdb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import type { SortDirection, ColumnDef } from '@/components/ui/data-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, FilterBar } from '@/components/layout/page'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'

const feeSchema = z.object({
  label: z.string().optional(),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  dueDay: z.coerce
    .number()
    .min(1, 'Le jour doit être entre 1 et 28')
    .max(28, 'Le jour doit être entre 1 et 28'),
  description: z.string().optional(),
  levelId: z.string().optional(),
  feeType: z.enum(['TUITION', 'ANNUAL', 'OTHER']),
})

type FeeValues = z.infer<typeof feeSchema>

const FEE_TYPE_LABELS: Record<string, string> = {
  TUITION: 'Écolage',
  ANNUAL: 'Frais annuels',
  OTHER: 'Autre',
}

export function FeeStructurePage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<FeeType | null>(null)

  const { data: fees, isLoading } = useQuery({
    queryKey: ['fees'],
    queryFn: async () => {
      const items = await queryEntities<FeeType>('FeeStructure')
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

  const [customLabel, setCustomLabel] = useState('')
  const [customFeeItems, setCustomFeeItems] = useState<CustomFeeItem[]>([])
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadCustomFeeNames().then(setCustomFeeItems)
  }, [])

  const form = useForm<FeeValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: { label: '', amount: 0, dueDay: 5, description: '', levelId: '', feeType: 'TUITION' }
  })

  const createMutation = useMutation({
    mutationFn: async (values: FeeValues) => {
      await saveEntity('FeeStructure', {
        id: crypto.randomUUID(),
        ...values,
        levelId: values.levelId || null,
        isActive: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success('Frais créé')
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast.error('Erreur lors de la création')
  })

  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; data: Partial<FeeValues> }) => {
      await saveEntity('FeeStructure', {
        id: values.id,
        ...values.data,
        levelId: values.data.levelId || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success('Frais mis à jour')
      setEditingFee(null)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await saveEntity('FeeStructure', { id, isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntity('FeeStructure', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success('Frais supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function openCreateDialog() {
    setEditingFee(null)
    setCustomLabel('')
    form.reset({ amount: 0, dueDay: 5, description: '', levelId: '', feeType: 'TUITION' })
    setDialogOpen(true)
  }

  function openEditDialog(fee: FeeType) {
    setEditingFee(fee)
    setCustomLabel(fee.feeType === 'OTHER' ? fee.label : '')
    form.reset({
      amount: fee.amount,
      dueDay: fee.dueDay,
      description: fee.description ?? '',
      levelId: fee.levelId ?? '',
      feeType: fee.feeType ?? 'TUITION',
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FeeValues) {
    const label = values.feeType === 'OTHER'
      ? customLabel || 'Autre'
      : FEE_TYPE_LABELS[values.feeType] || values.feeType
    const payload = { ...values, label }
    if (editingFee) {
      updateMutation.mutate({ id: editingFee.id, data: payload })
    } else {
      if (values.feeType === 'OTHER' && customLabel && !customFeeItems.some((i) => i.name === customLabel)) {
        saveCustomFeeItem({ name: customLabel, amount: values.amount }).then(() => {
          loadCustomFeeNames().then(setCustomFeeItems)
        })
      }
      createMutation.mutate(payload)
    }
  }

  const levelOptions = (levels ?? []).map((l) => ({ value: l.id, label: l.name }))

  const levelMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const l of levels ?? []) map[l.id] = l.name
    return map
  }, [levels])

  const filtered = useMemo(() => {
    let items = fees ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((f) => f.label.toLowerCase().includes(q))
    }
    if (sortBy) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortBy as keyof FeeType] ?? ''
        const bVal = b[sortBy as keyof FeeType] ?? ''
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [fees, search, sortBy, sortDirection])

  const limit = 20
  const total = filtered.length
  const paginated = filtered.slice((page - 1) * limit, page * limit)

  const columns = [
    { key: 'label', label: 'Type de frais', sortable: true },
    {
      key: 'level',
      label: 'Niveau',
      sortable: true,
      render: (fee: FeeType) => levelMap[fee.levelId ?? ''] || <span className="text-muted-foreground">Tous</span>,
    },
    {
      key: 'amount',
      label: 'Montant',
      sortable: true,
      render: (fee: FeeType) => `${fee.amount.toLocaleString('fr-FR')} Ar`,
    },
    {
      key: 'isActive',
      label: 'Statut',
      sortable: true,
      render: (fee: FeeType) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={fee.isActive}
            onCheckedChange={(checked) => toggleMutation.mutate({ id: fee.id, isActive: checked })}
          />
          <Badge variant={fee.isActive ? 'default' : 'secondary'}>
            {fee.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      ),
    },
  ] satisfies ColumnDef<FeeType>[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Structure des frais"
        description="Définir les frais par niveau (écolage, frais annuels)."
        actions={
          <Button className="gap-2" onClick={openCreateDialog}>
            <PlusIcon className="h-4 w-4" />
            Nouveau frais
          </Button>
        }
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par type de frais..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginated}
            total={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onSortChange={(key, dir) => { setSortBy(key); setSortDirection(dir); setPage(1) }}
            sortKey={sortBy}
            sortDirection={sortDirection}
            filters={{ label: search }}
            onFilterChange={(_key, value) => { setSearch(value); setPage(1) }}
            onBulkDelete={(ids) => {
              Promise.all(ids.map((id) => deleteEntity('FeeStructure', id)))
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['fees'] })
                  toast.success(`${ids.length} frais supprimé(s)`)
                })
                .catch(() => toast.error('Erreur lors de la suppression'))
            }}
            getRowId={(fee) => fee.id}
            isLoading={isLoading}
            emptyMessage="Aucun frais défini"
            bulkDeleteLabel="frais"
            renderRowActions={(fee) => (
              <>
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(fee)}>
                  <Pencil1Icon className="h-4 w-4" />
                </Button>
                <ConfirmDialog
                  open={deleteId === fee.id}
                  onOpenChange={(open) => !open && setDeleteId(null)}
                  onConfirm={() => deleteMutation.mutate(fee.id)}
                  title="Supprimer le frais"
                  description="Êtes-vous sûr ? Cette action est irréversible."
                />
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(fee.id)}>
                  <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFee ? 'Modifier les frais' : 'Nouveau frais'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="feeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de frais</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'TUITION', label: 'Écolage' },
                          { value: 'ANNUAL', label: 'Frais annuels' },
                          { value: '__custom__', label: 'Autre (saisie libre)' },
                          ...customFeeItems.map((item) => ({
                            value: `custom_${item.name}`,
                            label: `${item.name} (${item.amount.toLocaleString()} Ar)`,
                          })),
                        ]}
                        value={
                          field.value === 'OTHER'
                            ? (editingFee?.feeType === 'OTHER' && editingFee.label
                              ? `custom_${editingFee.label}`
                              : '__custom__')
                            : field.value
                        }
                        onValueChange={(v) => {
                          if (v === '__custom__') {
                            field.onChange('OTHER')
                            setCustomLabel('')
                          } else if (v.startsWith('custom_')) {
                            const name = v.slice(7)
                            const item = customFeeItems.find((i) => i.name === name)
                            field.onChange('OTHER')
                            setCustomLabel(name)
                            if (item) form.setValue('amount', item.amount)
                          } else {
                            field.onChange(v)
                            setCustomLabel('')
                          }
                        }}
                        placeholder="Sélectionner..."
                        searchPlaceholder="Rechercher..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('feeType') === 'OTHER' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom personnalisé</label>
                  <Input
                    placeholder="Ex: Frais de transport, tenue..."
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="levelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[{ value: '__all__', label: 'Tous les niveaux' }, ...levelOptions]}
                        value={field.value || '__all__'}
                        onValueChange={(v) => field.onChange(v === '__all__' ? '' : v)}
                        placeholder="Sélectionner un niveau..."
                        searchPlaceholder="Rechercher..."
                        emptyText="Aucun niveau trouvé"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (Ar)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jour d'échéance</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={28} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description des frais..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingFee ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
