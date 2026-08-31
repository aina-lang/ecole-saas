import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fileToSquareLogoDataUrl } from '@/lib/image-utils'
import { ReloadIcon } from '@radix-ui/react-icons'
import client from '@/api/client'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import { getTenantSetting, setTenantSetting } from '@/lib/tenant-settings'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PageHeader, FormSection } from '@/components/layout/page'
import { UpdatesCard } from '@/components/layout/UpdatesCard'

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
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoDragOver, setLogoDragOver] = useState(false)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      // Data URL plutôt que fichier sur disque : survit aux redémarrages
      // (l'index des fichiers était en mémoire volatile) et alimente
      // directement les PDF (bulletins, reçus).
      // Carré normalisé : affichage net dans tous les cadres carrés de l'app.
      const logoDataUrl = await fileToSquareLogoDataUrl(file, 256)
      const raw = await getTenantSetting('school')
      const school = raw ? JSON.parse(raw) : {}
      await setTenantSetting('school', JSON.stringify({ ...school, logoUrl: logoDataUrl }))
      queryClient.invalidateQueries({ queryKey: ['settings-school'] })
      toast.success('Logo mis à jour')
    } catch {
      toast.error("Erreur lors de l'upload du logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    try {
      const raw = await getTenantSetting('school')
      const school = raw ? JSON.parse(raw) : {}
      await setTenantSetting('school', JSON.stringify({ ...school, logoUrl: '' }))
      queryClient.invalidateQueries({ queryKey: ['settings-school'] })
      toast.success('Logo retiré')
    } catch {
      toast.error('Erreur lors de la suppression du logo')
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

  const { data: periodSystem } = useQuery({
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
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Configurer les paramètres de l'établissement"
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Rafraîchir"
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="academic">Année scolaire</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-6">
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(handleSaveGeneral)}>
              <FormSection
                title="Informations générales"
                description="Nom de l'établissement et configuration de base"
                columns={2}
              >
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
                <div className="space-y-2 sm:col-span-2">
                  <Label>Logo de l'établissement</Label>
                  <div className="flex items-start gap-5">
                    {/* La vignette EST le contrôle : clic ou dépôt d'image, survol
                        pour l'indication — même langage que la photo d'identité. */}
                    <div
                      role="button"
                      tabIndex={uploadingLogo ? -1 : 0}
                      aria-label={schoolData?.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                      onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logoInputRef.current?.click() } }}
                      onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true) }}
                      onDragLeave={() => setLogoDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault(); setLogoDragOver(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file && logoInputRef.current) {
                          const dt = new DataTransfer(); dt.items.add(file)
                          logoInputRef.current.files = dt.files
                          logoInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                        }
                      }}
                      className={cn(
                        'group relative flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted/60 transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        schoolData?.logoUrl ? 'border-transparent bg-card' : 'border-dashed border-border hover:border-primary/60 hover:bg-accent',
                        logoDragOver && 'border-primary bg-accent',
                        uploadingLogo && 'cursor-wait',
                      )}
                    >
                      {schoolData?.logoUrl ? (
                        <>
                          <img src={schoolData.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100">
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-xs font-medium">Changer</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 px-2 text-center text-muted-foreground">
                          <ImagePlus className="h-7 w-7" />
                          <span className="text-[11px] leading-tight">Cliquer ou déposer une image</span>
                        </div>
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <div className="space-y-1.5 pt-1 text-sm">
                      <p className="font-medium">{schoolData?.logoUrl ? 'Logo en place' : 'Aucun logo'}</p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG ou SVG, fond transparent de préférence. Il apparaît dans le menu, sur les bulletins, reçus et exports.
                      </p>
                      {schoolData?.logoUrl && (
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          disabled={uploadingLogo}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Retirer le logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit" disabled={savingGeneral}>
                    {savingGeneral ? (
                      <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                    ) : 'Enregistrer'}
                  </Button>
                </div>
              </FormSection>
            </form>
          </Form>

          <UpdatesCard />
        </TabsContent>

        <TabsContent value="academic" className="mt-4 space-y-6">
          <Form {...academicForm}>
            <form onSubmit={academicForm.handleSubmit(handleSaveAcademic)}>
              <FormSection
                title="Année scolaire en cours"
                description="Gérer l'année scolaire, les périodes et les congés"
                columns={2}
              >
                <FormField
                  control={academicForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nom de l'année scolaire</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 2025-2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit" disabled={savingAcademic}>
                    {savingAcademic ? (
                      <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                    ) : 'Enregistrer'}
                  </Button>
                </div>
              </FormSection>
            </form>
          </Form>

          <FormSection
            title="Système de périodes"
            description="Définit le découpage de l'année scolaire en périodes d'évaluation (enregistré immédiatement)"
            columns={2}
          >
            <div className="space-y-2">
              <Label>Découpage</Label>
              <Select
                value={periodSystem || 'TRIMESTER'}
                onValueChange={(v) => handleSavePeriodSystem(v as PeriodSystem)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['TRIMESTER', 'SEMESTER', 'BIMESTER'] as PeriodSystem[]).map((s) => (
                    <SelectItem key={s} value={s}>{periodSystemLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-6">
          <Form {...securityForm}>
            <form onSubmit={securityForm.handleSubmit(handleChangePassword)}>
              <FormSection
                title="Changer le mot de passe"
                description="Mettez à jour votre mot de passe régulièrement"
                columns={2}
              >
                <FormField
                  control={securityForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
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
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit" disabled={savingSecurity}>
                    {savingSecurity ? (
                      <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                    ) : 'Changer le mot de passe'}
                  </Button>
                </div>
              </FormSection>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
