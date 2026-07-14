import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity } from '@/lib/db/offline'
import type { Teacher } from '@/types'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, ColumnDef } from '@/components/ui/data-table'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ReloadIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

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

  const { data: teachers, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<Teacher>('Teacher')

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ['teacher-contracts'],
    queryFn: () => queryEntities('TeacherContract')
  })

  const isLoading = loadingTeachers || isLoadingContracts

  const handleRefresh = () => {
    refetchTeachers()
    queryClient.invalidateQueries({ queryKey: ['teacher-contracts'] })
  }

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

      await saveEntity('TeacherContract', {
        id: crypto.randomUUID(),
        teacherId: values.teacherId,
        contractType: values.contractType,
        startDate: values.startDate,
        endDate: values.endDate || null,
        salary: Number(values.hourlyRate || values.monthlySalary || values.fixedAmount || 0),
        hoursPerWeek: values.contractType === 'HOURLY' ? Number(values.hourlyRate) : 0,
        status: values.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      })
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={() => { form.reset(); setDialogOpen(true) }}>
            Nouveau contrat
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'teacherName',
                label: 'Enseignant',
                render: (contract) => `${(contract as any).teacher?.user?.firstName} ${(contract as any).teacher?.user?.lastName}`,
                className: 'font-medium',
              },
              {
                key: 'contractType',
                label: 'Type',
                render: (contract) => contractTypeLabels[(contract as any).contractType],
              },
              {
                key: 'rate',
                label: 'Taux',
                render: (contract) => getContractInfo(contract as any),
              },
              {
                key: 'startDate',
                label: 'Début',
                render: (contract) => (contract as any).startDate?.split('T')[0],
              },
              {
                key: 'endDate',
                label: 'Fin',
                render: (contract) => (contract as any).endDate?.split('T')[0] || 'Indéfini',
              },
              {
                key: 'status',
                label: 'Statut',
                render: (contract) => (
                  <Badge variant={(contract as any).isActive ? 'default' : 'secondary'}>
                    {(contract as any).isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                ),
              },
            ]}
            data={contracts ?? []}
            total={(contracts ?? []).length}
            page={1}
            limit={100}
            onPageChange={() => {}}
            getRowId={(contract) => (contract as any).id}
            isLoading={isLoading}
            emptyMessage="Aucun contrat"
          />
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
                        <DatePicker
                          value={field.value}
                          onChange={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')}
                        />
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
                        <DatePicker
                          value={field.value}
                          onChange={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')}
                        />
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
