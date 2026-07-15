import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil1Icon, PlusIcon, CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons'
import client from '@/api/client'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface FeeStructure {
  id: string
  label: string
  amount: number
  dueDay: number
  description?: string
  isActive: boolean
  createdAt: string
}

const feeSchema = z.object({
  label: z.string().min(1, 'Le libellé est requis'),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  dueDay: z.coerce
    .number()
    .min(1, 'Le jour doit être entre 1 et 28')
    .max(28, 'Le jour doit être entre 1 et 28'),
  description: z.string().optional()
})

type FeeValues = z.infer<typeof feeSchema>

export function FeeStructurePage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null)

  const { data: fees, isLoading } = useQuery({
    queryKey: ['fees'],
    queryFn: async () => {
      const items = await queryEntities<FeeStructure>('Fee')
      return items ?? []
    }
  })

  const form = useForm<FeeValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: { label: '', amount: 0, dueDay: 5, description: '' }
  })

  const createMutation = useMutation({
    mutationFn: async (values: FeeValues) => {
      await saveEntity('Fee', {
        id: crypto.randomUUID(),
        ...values,
        isActive: true,
        isMandatory: false,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success('Frais créé avec succès (mode hors-ligne)')
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast.error('Erreur lors de la création des frais')
  })

  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; data: Partial<FeeValues> }) => {
      await saveEntity('Fee', { id: values.id, ...values.data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      toast.success('Frais mis à jour (mode hors-ligne)')
      setEditingFee(null)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await saveEntity('Fee', { id, isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
    }
  })

  function openCreateDialog() {
    setEditingFee(null)
    form.reset({ label: '', amount: 0, dueDay: 5, description: '' })
    setDialogOpen(true)
  }

  function openEditDialog(fee: FeeStructure) {
    setEditingFee(fee)
    form.reset({
      label: fee.label,
      amount: fee.amount,
      dueDay: fee.dueDay,
      description: fee.description ?? ''
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FeeValues) {
    if (editingFee) {
      updateMutation.mutate({ id: editingFee.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Structure des frais</h2>
          <p className="text-muted-foreground">Définir et gérer les frais de scolarité.</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <PlusIcon className="h-4 w-4" />
          Nouveau frais
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Jour d'échéance</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun frais défini
                  </TableCell>
                </TableRow>
              ) : (
                fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.label}</TableCell>
                    <TableCell>{fee.amount.toLocaleString('fr-FR')} Ar</TableCell>
                    <TableCell>Le {fee.dueDay} de chaque mois</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {fee.description || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={fee.isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: fee.id, isActive: checked })
                          }
                        />
                        <Badge variant={fee.isActive ? 'default' : 'secondary'}>
                          {fee.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(fee)}>
                        <Pencil1Icon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Libellé</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Frais de scolarité annuels" {...field} />
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
