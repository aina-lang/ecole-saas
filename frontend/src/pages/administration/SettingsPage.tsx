import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ReloadIcon } from '@radix-ui/react-icons'
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
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import { performSync } from '@/lib/db/sync-manager'
import { getTenantSetting, setTenantSetting } from '@/lib/tenant-settings'
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

interface PaymentConfig {
  monthlyTuition: number
  annualFee: number
  dueDay: number
}

type PeriodSystem = 'TRIMESTER' | 'SEMESTER' | 'BIMESTER'

const paymentSchema = z.object({
  monthlyTuition: z.coerce.number().min(0, 'Montant invalide'),
  annualFee: z.coerce.number().min(0, 'Montant invalide'),
  dueDay: z.coerce.number().int().min(1, 'Jour invalide').max(28, 'Maximum 28'),
})

type PaymentValues = z.infer<typeof paymentSchema>

const periodSystemLabels: Record<PeriodSystem, string> = {
  TRIMESTER: 'Trimestre (3 périodes)',
  SEMESTER: 'Semestre (2 périodes)',
  BIMESTER: 'Bimestre (5 périodes)',
}

const generalSchema = z.object({
  schoolName: z.string().min(1, 'Le nom est requis')
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
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const api = (window as any).api
      if (!api?.file) { toast.error('Upload non disponible'); return }
      const buffer = await file.arrayBuffer()
      const result = await api.file.save({
        buffer, entityType: 'School', entityId: 'logo',
        fieldName: 'logo', originalName: file.name, mimeType: file.type,
      })
      const localUrl = await api.file.getUrl((result as any).local_path)
      if (localUrl) {
        const raw = await getTenantSetting('school')
        const school = raw ? JSON.parse(raw) : {}
        await setTenantSetting('school', JSON.stringify({ ...school, logoUrl: localUrl }))
        queryClient.invalidateQueries({ queryKey: ['settings-school'] })
        toast.success('Logo mis à jour')
      }
    } catch {
      toast.error("Erreur lors de l'upload du logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  const { data: schoolData, isLoading: loadingSchool } = useQuery({
    queryKey: ['settings-school'],
    queryFn: async () => {
      try {
        const raw = await getTenantSetting('school')
        return raw ? JSON.parse(raw) as SchoolSettings : null
      } catch { return null }
    }
  })

  const { data: academicData, isLoading: loadingAcademic } = useQuery({
    queryKey: ['settings-academic'],
    queryFn: async () => {
      try {
        const raw = await getTenantSetting('academic_year')
        return raw ? JSON.parse(raw) as AcademicYear : null
      } catch { return null }
    }
  })

  const { data: periodSystem, isLoading: loadingPeriodSystem } = useQuery({
    queryKey: ['settings-period-system'],
    queryFn: async () => {
      const raw = await getTenantSetting('period_system')
      return (raw || 'TRIMESTER') as PeriodSystem
    }
  })

  const { data: paymentConfig, isLoading: loadingPayment } = useQuery({
    queryKey: ['settings-payment'],
    queryFn: async () => {
      const raw = await getTenantSetting('payment_config')
      return JSON.parse(raw || '{}') as PaymentConfig
    }
  })

  const isLoading = loadingSchool || loadingAcademic || loadingPayment

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { monthlyTuition: 0, annualFee: 0, dueDay: 15 },
  })

  const generalForm = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: { schoolName: '' }
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
    if (paymentConfig) {
      paymentForm.reset({
        monthlyTuition: paymentConfig.monthlyTuition || 0,
        annualFee: paymentConfig.annualFee || 0,
        dueDay: paymentConfig.dueDay || 15,
      })
    }
  }, [paymentConfig, paymentForm])

  useEffect(() => {
    if (schoolData) {
      generalForm.reset({
        schoolName: schoolData.schoolName
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
      const raw = await getTenantSetting('school')
      const existing = raw ? JSON.parse(raw) : {}
      await setTenantSetting('school', JSON.stringify({ ...existing, ...values }))
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
      await setTenantSetting('academic_year', JSON.stringify(values))
      const existingDoc = (await queryEntities<any>('AcademicYear' as any))?.find((y: any) => y.isCurrent)
      const academicYear = {
        id: existingDoc?.id || crypto.randomUUID(),
        _id: existingDoc?._id,
        _rev: existingDoc?._rev,
        label: values.name,
        startDate: values.startDate,
        endDate: values.endDate,
        isCurrent: true,
      }
      await saveEntity('AcademicYear' as any, academicYear)
      queryClient.invalidateQueries({ queryKey: ['settings-academic'] })
      toast.success('Année scolaire mise à jour')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSavingAcademic(false)
    }
  }

  async function handleSavePeriodSystem(system: PeriodSystem) {
    await setTenantSetting('period_system', system)
    queryClient.invalidateQueries({ queryKey: ['settings-period-system'] })
    toast.success('Système de périodes mis à jour')
  }

  async function handleSavePaymentConfig(values: PaymentValues) {
    setSavingPayment(true)
    try {
      await setTenantSetting('payment_config', JSON.stringify(values))
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
      await performSync()
      queryClient.invalidateQueries({ queryKey: ['settings-sync-info'] })
      toast.success('Synchronisation lancée')
    } catch {
      toast.error('Erreur lors de la synchronisation')
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
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm overflow-hidden">
                        {schoolData?.logoUrl ? (
                          <img src={schoolData.logoUrl} alt="Logo" className="h-full w-full rounded-lg object-contain" />
                        ) : (
                          'Aucun logo'
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button variant="outline" type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? 'Upload...' : 'Télécharger'}
                      </Button>
                    </div>
                  </div>
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



        <TabsContent value="security" className="space-y-4 mt-4">
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
