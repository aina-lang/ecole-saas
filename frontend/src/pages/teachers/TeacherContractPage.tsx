import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

const contractSchema = z.object({
  teacherId: z.string().min(1, 'Enseignant requis'),
  contractType: z.enum(['HOURLY', 'MONTHLY', 'FIXED']),
  hourlyRate: z.coerce.number().min(0).optional().or(z.literal('')),
  monthlySalary: z.coerce.number().min(0).optional().or(z.literal('')),
  fixedAmount: z.coerce.number().min(0).optional().or(z.literal('')),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional()
})

type ContractFormValues = z.infer<typeof contractSchema>

const contractTypeLabels: Record<string, string> = {
  HOURLY: 'Horaire',
  MONTHLY: 'Mensuel',
  FIXED: 'Forfait'
}

export function TeacherContractPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: teachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const res = await client.get('/teachers')
      const raw = res.data
      return (Array.isArray(raw) ? raw : raw.data ?? []) as Teacher[]
    }
  })

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['teacher-contracts'],
    queryFn: async () => {
      const { data } = await client.get('/teacher-contracts')
      return data as any[]
    }
  })

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      teacherId: '',
      contractType: 'HOURLY',
      hourlyRate: '',
      monthlySalary: '',
      fixedAmount: '',
      startDate: '',
      endDate: '',
      isActive: true
    }
  })

  const createMutation = useMutation({
    mutationFn: async (values: ContractFormValues) => {
      const payload: any = {
        teacherId: values.teacherId,
        contractType: values.contractType,
        startDate: values.startDate
      }
      if (values.hourlyRate) payload.hourlyRate = Number(values.hourlyRate)
      if (values.monthlySalary) payload.monthlySalary = Number(values.monthlySalary)
      if (values.fixedAmount) payload.fixedAmount = Number(values.fixedAmount)
      if (values.endDate) payload.endDate = values.endDate

      await client.post('/teacher-contracts', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-contracts'] })
      toast.success('Contrat créé')
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast.error('Erreur lors de la création')
  })

  function getContractInfo(contract: any) {
    if (contract.contractType === 'HOURLY') return `${contract.hourlyRate} XAF/h`
    if (contract.contractType === 'MONTHLY') return `${contract.monthlySalary} XAF/mois`
    return `${contract.fixedAmount} XAF`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contrats enseignants</h2>
          <p className="text-muted-foreground">Gérer les contrats des enseignants</p>
        </div>
        <Button onClick={() => { form.reset(); setDialogOpen(true) }}>
          Nouveau contrat
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enseignant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">Chargement...</TableCell>
                </TableRow>
              ) : !contracts?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">Aucun contrat</TableCell>
                </TableRow>
              ) : (
                contracts.map((contract: any) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      {contract.teacher?.user?.firstName} {contract.teacher?.user?.lastName}
                    </TableCell>
                    <TableCell>{contractTypeLabels[contract.contractType]}</TableCell>
                    <TableCell>{getContractInfo(contract)}</TableCell>
                    <TableCell>{contract.startDate?.split('T')[0]}</TableCell>
                    <TableCell>{contract.endDate?.split('T')[0] || 'Indéfini'}</TableCell>
                    <TableCell>
                      <Badge variant={contract.isActive ? 'default' : 'secondary'}>
                        {contract.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
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
            <DialogTitle>Nouveau contrat</DialogTitle>
            <DialogDescription>Créer un contrat pour un enseignant</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="teacherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enseignant</FormLabel>
                    <FormControl>
                      <Combobox
                        options={teachers?.map((t) => ({ value: t.id, label: `${t.user.firstName} ${t.user.lastName}` })) ?? []}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Sélectionner"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de contrat</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'HOURLY', label: 'Horaire' },
                          { value: 'MONTHLY', label: 'Mensuel' },
                          { value: 'FIXED', label: 'Forfait' }
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('contractType') === 'HOURLY' && (
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux horaire (XAF)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {form.watch('contractType') === 'MONTHLY' && (
                <FormField
                  control={form.control}
                  name="monthlySalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salaire mensuel (XAF)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {form.watch('contractType') === 'FIXED' && (
                <FormField
                  control={form.control}
                  name="fixedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant forfaitaire (XAF)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full">Créer le contrat</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
