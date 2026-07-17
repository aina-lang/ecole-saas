import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ReloadIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons'
import client from '@/api/client'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface SchoolSettings {
  schoolName: string
  logoUrl: string | null
  primaryColor: string
}

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  periods: { id: string; name: string; startDate: string; endDate: string }[]
  holidays: { id: string; name: string; startDate: string; endDate: string }[]
}

interface SyncDevice {
  id: string
  deviceName: string
  deviceType: string
  lastSyncAt: string | null
  isOnline: boolean
}

interface SecuritySettings {
  twoFactorEnabled: boolean
}

interface PaymentConfig {
  monthlyTuition: number
  annualFee: number
  dueDay: number
}

type PeriodSystem = 'TRIMESTER' | 'SEMESTER' | 'BIMESTER'

const periodSystemLabels: Record<PeriodSystem, string> = {
  TRIMESTER: 'Trimestre (3 périodes)',
  SEMESTER: 'Semestre (2 périodes)',
  BIMESTER: 'Bimestre (5 périodes)',
}

const generalSchema = z.object({
  schoolName: z.string().min(1, 'Le nom est requis'),
  primaryColor: z.string().min(1, 'La couleur est requise')
})

type GeneralValues = z.infer<typeof generalSchema>

const academicYearSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().min(1, 'La date de fin est requise')
})

type AcademicYearValues = z.infer<typeof academicYearSchema>

const securitySchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string().min(6, 'Minimum 6 caractères')
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

type SecurityValues = z.infer<typeof securitySchema>

export const SettingsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savingAcademic, setSavingAcademic] = useState(false)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  const { data: schoolData, isLoading: loadingSchool } = useQuery({
    queryKey: ['settings-school'],
    queryFn: async () => {
      try {
        const raw = await (window as any).api?.settings?.get?.('school')
        return raw ? JSON.parse(raw) as SchoolSettings : null
      } catch { return null }
    }
  })

  const { data: academicData, isLoading: loadingAcademic } = useQuery({
    queryKey: ['settings-academic'],
    queryFn: async () => {
      try {
        const raw = await (window as any).api?.settings?.get?.('academic_year')
        return raw ? JSON.parse(raw) as AcademicYear : null
      } catch { return null }
    }
  })

  const { data: syncDevices, isLoading: loadingDevices } = useQuery({
    queryKey: ['settings-sync-devices'],
    queryFn: async (): Promise<SyncDevice[]> => {
      try {
        const devices = await (window as any).api?.sync?.getDevices?.()
        return Array.isArray(devices) ? devices : []
      } catch { return [] }
    }
  })

  const { data: syncInfo, isLoading: loadingSyncInfo } = useQuery({
    queryKey: ['settings-sync-info'],
    queryFn: async (): Promise<{ lastSyncAt: string | null; pendingCount: number; online: boolean }> => {
      try {
        const info = await (window as any).api?.sync?.getStatus?.()
        return info ?? { lastSyncAt: null, pendingCount: 0, online: navigator.onLine }
      } catch { return { lastSyncAt: null, pendingCount: 0, online: navigator.onLine } }
    }
  })

  const { data: securityData, isLoading: loadingSecurity } = useQuery({
    queryKey: ['settings-security'],
    queryFn: async () => {
      try {
        const raw = await (window as any).api?.settings?.get?.('security')
        return raw ? JSON.parse(raw) as SecuritySettings : { twoFactorEnabled: false }
      } catch { return { twoFactorEnabled: false } }
    }
  })

  const { data: periodSystem, isLoading: loadingPeriodSystem } = useQuery({
    queryKey: ['settings-period-system'],
    queryFn: async () => {
      const raw = await (window as any).api?.settings?.get?.('period_system')
      return (raw || 'TRIMESTER') as PeriodSystem
    }
  })

  const { data: paymentConfig, isLoading: loadingPayment } = useQuery({
    queryKey: ['settings-payment'],
    queryFn: async () => {
      const raw = await (window as any).api?.settings?.get?.('payment_config')
      return JSON.parse(raw || '{}') as PaymentConfig
    }
  })

  const isLoading = loadingSchool || loadingAcademic || loadingDevices || loadingSyncInfo || loadingSecurity || loadingPeriodSystem || loadingPayment

  const generalForm = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: { schoolName: '', primaryColor: '#2563eb' }
  })

  const academicForm = useForm<AcademicYearValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { name: '', startDate: '', endDate: '' }
  })

  const securityForm = useForm<SecurityValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  })

  useEffect(() => {
    if (schoolData) {
      generalForm.reset({
        schoolName: schoolData.schoolName,
        primaryColor: schoolData.primaryColor
      })
    }
  }, [schoolData, generalForm])

  useEffect(() => {
    if (academicData) {
      academicForm.reset({
        name: academicData.name,
        startDate: academicData.startDate?.split('T')[0] || '',
        endDate: academicData.endDate?.split('T')[0] || ''
      })
    }
  }, [academicData, academicForm])

  async function handleSaveGeneral(values: GeneralValues) {
    setSavingGeneral(true)
    try {
      await (window as any).api?.settings?.set?.('school', JSON.stringify(values))
      queryClient.invalidateQueries({ queryKey: ['settings-school'] })
      toast.success('Paramètres généraux enregistrés')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSavingGeneral(false)
    }
  }

  async function handleSaveAcademic(values: AcademicYearValues) {
    setSavingAcademic(true)
    try {
      await (window as any).api?.settings?.set?.('academic_year', JSON.stringify(values))
      queryClient.invalidateQueries({ queryKey: ['settings-academic'] })
      toast.success('Année scolaire mise à jour')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSavingAcademic(false)
    }
  }

  async function handleSavePeriodSystem(system: PeriodSystem) {
    await (window as any).api?.settings?.set?.('period_system', system)
    queryClient.invalidateQueries({ queryKey: ['settings-period-system'] })
    toast.success('Système de périodes mis à jour')
  }

  async function handleSavePaymentConfig(values: PaymentConfig) {
    setSavingPayment(true)
    try {
      await (window as any).api?.settings?.set?.('payment_config', JSON.stringify(values))
      queryClient.invalidateQueries({ queryKey: ['settings-payment'] })
      toast.success('Configuration des paiements enregistrée')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleForceSync() {
    try {
      await (window as any).api?.sync?.forceSync?.()
      queryClient.invalidateQueries({ queryKey: ['settings-sync-info'] })
      toast.success('Synchronisation lancée')
    } catch {
      toast.error('Erreur lors de la synchronisation')
    }
  }

  async function handleToggle2fa(enabled: boolean) {
    try {
      await (window as any).api?.settings?.set?.('security', JSON.stringify({ twoFactorEnabled: enabled }))
      queryClient.invalidateQueries({ queryKey: ['settings-security'] })
      toast.success(enabled ? '2FA activée' : '2FA désactivée')
    } catch {
      toast.error('Erreur lors de la modification')
    }
  }

  async function handleChangePassword(values: SecurityValues) {
    setSavingSecurity(true)
    try {
      await client.put('/admin/settings/security/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })
      securityForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Mot de passe modifié avec succès')
    } catch {
      toast.error('Erreur lors du changement de mot de passe')
    } finally {
      setSavingSecurity(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Paramètres</h2>
          <p className="text-muted-foreground">Configurer les paramètres de l'établissement</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="academic">Année scolaire</TabsTrigger>
          <TabsTrigger value="payment">Paiements</TabsTrigger>
          <TabsTrigger value="sync">Synchronisation</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Nom de l'établissement et configuration de base</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generalForm}>
                <form id="general-form" onSubmit={generalForm.handleSubmit(handleSaveGeneral)} className="space-y-4">
                  <FormField
                    control={generalForm.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'établissement</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: École Internationale de Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Logo de l'établissement</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                        {schoolData?.logoUrl ? (
                          <img src={schoolData.logoUrl} alt="Logo" className="h-full w-full rounded-lg object-contain" />
                        ) : (
                          'Aucun logo'
                        )}
                      </div>
                      <Button variant="outline" type="button" disabled>
                        Télécharger
                      </Button>
                    </div>
                  </div>
                  <FormField
                    control={generalForm.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Couleur principale</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              className="h-9 w-16 rounded-md border border-input bg-transparent px-1"
                              {...field}
                            />
                            <span className="font-mono text-sm text-muted-foreground">{field.value}</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" form="general-form" disabled={savingGeneral}>
                {savingGeneral ? (
                  <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : 'Enregistrer'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Année scolaire en cours</CardTitle>
              <CardDescription>Gérer l'année scolaire, les périodes et les congés</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...academicForm}>
                <form id="academic-form" onSubmit={academicForm.handleSubmit(handleSaveAcademic)} className="space-y-4">
                  <FormField
                    control={academicForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'année scolaire</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 2025-2026" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={academicForm.control}
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
                      control={academicForm.control}
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
                </form>
              </Form>

              <Separator />

              <div className="space-y-3">
                <Label>Système de périodes</Label>
                <p className="text-sm text-muted-foreground">
                  Définit le découpage de l'année scolaire en périodes d'évaluation
                </p>
                <Select
                  value={periodSystem || 'TRIMESTER'}
                  onValueChange={(v) => handleSavePeriodSystem(v as PeriodSystem)}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['TRIMESTER', 'SEMESTER', 'BIMESTER'] as PeriodSystem[]).map((s) => (
                      <SelectItem key={s} value={s}>{periodSystemLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Périodes</Label>
                  <Button variant="outline" size="sm" disabled>+ Ajouter</Button>
                </div>
                {academicData?.periods?.length ? (
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Période</TableHead>
                          <TableHead>Début</TableHead>
                          <TableHead>Fin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {academicData.periods.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>{format(new Date(p.startDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell>{format(new Date(p.endDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune période définie</p>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Congés</Label>
                  <Button variant="outline" size="sm" disabled>+ Ajouter</Button>
                </div>
                {academicData?.holidays?.length ? (
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Congé</TableHead>
                          <TableHead>Début</TableHead>
                          <TableHead>Fin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {academicData.holidays.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-medium">{h.name}</TableCell>
                            <TableCell>{format(new Date(h.startDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                            <TableCell>{format(new Date(h.endDate), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun congé défini</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" form="academic-form" disabled={savingAcademic}>
                {savingAcademic ? (
                  <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : 'Enregistrer'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des paiements</CardTitle>
              <CardDescription>Définir les montants d'écolage mensuel et des frais annuels</CardDescription>
            </CardHeader>
            <CardContent>
              <form id="payment-form" onSubmit={(e) => { e.preventDefault(); handleSavePaymentConfig({ monthlyTuition: Number((e.target as any).monthlyTuition.value) || 0, annualFee: Number((e.target as any).annualFee.value) || 0, dueDay: Number((e.target as any).dueDay.value) || 15 }) }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyTuition">Écolage mensuel (Ar)</Label>
                  <Input
                    id="monthlyTuition"
                    name="monthlyTuition"
                    type="number"
                    min="0"
                    step="100"
                    defaultValue={paymentConfig?.monthlyTuition || 0}
                    placeholder="Ex: 25000"
                  />
                  <p className="text-sm text-muted-foreground">Montant mensuel par élève</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualFee">Frais scolaires annuels (Ar)</Label>
                  <Input
                    id="annualFee"
                    name="annualFee"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={paymentConfig?.annualFee || 0}
                    placeholder="Ex: 150000"
                  />
                  <p className="text-sm text-muted-foreground">Frais d'inscription ou frais fixes par année</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDay">Jour d'échéance</Label>
                  <Input
                    id="dueDay"
                    name="dueDay"
                    type="number"
                    min="1"
                    max="28"
                    defaultValue={paymentConfig?.dueDay || 15}
                  />
                  <p className="text-sm text-muted-foreground">Jour du mois pour les échéances de paiement</p>
                </div>
              </form>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" form="payment-form" disabled={savingPayment}>
                {savingPayment ? (
                  <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : 'Enregistrer'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>État de la synchronisation</CardTitle>
              <CardDescription>Appareils connectés et statut de synchronisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${syncInfo?.online ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{syncInfo?.online ? 'En ligne' : 'Hors ligne'}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Dernière synchronisation : {syncInfo?.lastSyncAt
                    ? format(new Date(syncInfo.lastSyncAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                    : 'Jamais'}
                </div>
                <Badge variant="outline">{syncInfo?.pendingCount ?? 0} en attente</Badge>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Appareils connectés</Label>
                  <Button onClick={handleForceSync}>
                    <ReloadIcon className="mr-2 h-4 w-4" />
                    Forcer la synchronisation
                  </Button>
                </div>
                {syncDevices?.length ? (
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Appareil</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Dernière synchronisation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncDevices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell className="font-medium">{device.deviceName}</TableCell>
                            <TableCell className="text-muted-foreground">{device.deviceType}</TableCell>
                            <TableCell>
                              {device.isOnline ? (
                                <span className="flex items-center gap-1 text-green-600"><CheckCircledIcon className="h-4 w-4" /> En ligne</span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600"><CrossCircledIcon className="h-4 w-4" /> Hors ligne</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {device.lastSyncAt
                                ? format(new Date(device.lastSyncAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                                : 'Jamais'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun appareil connecté</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentification à deux facteurs (2FA)</CardTitle>
              <CardDescription>Renforcez la sécurité de votre compte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Authentification à deux facteurs</Label>
                  <p className="text-sm text-muted-foreground">
                    Activez une couche de sécurité supplémentaire pour votre compte
                  </p>
                </div>
                <Switch
                  checked={securityData?.twoFactorEnabled ?? false}
                  onCheckedChange={handleToggle2fa}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changer le mot de passe</CardTitle>
              <CardDescription>Mettez à jour votre mot de passe régulièrement</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...securityForm}>
                <form id="security-form" onSubmit={securityForm.handleSubmit(handleChangePassword)} className="space-y-4">
                  <FormField
                    control={securityForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe actuel</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={securityForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nouveau mot de passe</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="Minimum 6 caractères" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={securityForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer le mot de passe</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="Répétez le mot de passe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" form="security-form" disabled={savingSecurity}>
                {savingSecurity ? (
                  <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : 'Changer le mot de passe'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
