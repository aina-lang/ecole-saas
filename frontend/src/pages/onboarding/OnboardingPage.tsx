import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { saveEntity } from '@/lib/db/pouchdb-compat'
import { setTenantSetting } from '@/lib/tenant-settings'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Building2, CalendarDays, CheckCircle2, ArrowRight, ArrowLeft, ChevronRight } from 'lucide-react'

type PeriodSystem = 'TRIMESTER' | 'SEMESTER' | 'BIMESTER'

const PERIOD_SYSTEM_LABELS: Record<PeriodSystem, string> = {
  TRIMESTER: 'Trimestre (3 périodes)',
  SEMESTER: 'Semestre (2 périodes)',
  BIMESTER: 'Bimestre (5 périodes)',
}

// Aperçu uniquement (le vrai découpage se règle plus finement dans
// Paramètres > Année scolaire) — doit rester cohérent avec periodSystemLabels
// de SettingsPage.tsx.
const PERIOD_PREVIEW: Record<PeriodSystem, string[]> = {
  TRIMESTER: ['1er Trimestre : Sept - Déc', '2ème Trimestre : Jan - Mars', '3ème Trimestre : Avril - Juin'],
  SEMESTER: ['1er Semestre : Sept - Jan', '2ème Semestre : Fév - Juin'],
  BIMESTER: [
    '1er Bimestre : Sept - Oct', '2ème Bimestre : Nov - Déc', '3ème Bimestre : Jan - Fév',
    '4ème Bimestre : Mars - Avril', '5ème Bimestre : Mai - Juin',
  ],
}

const steps = [
  { id: 'welcome', title: 'Bienvenue', icon: Building2 },
  { id: 'year', title: 'Année scolaire', icon: CalendarDays },
  { id: 'done', title: 'Terminé', icon: CheckCircle2 },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const setTenant = useUIStore((s) => s.setTenant)

  const currentCalendarYear = new Date().getFullYear()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    yearLabel: `${currentCalendarYear}-${currentCalendarYear + 1}`,
    startDate: `${currentCalendarYear}-09-01`,
    endDate: `${currentCalendarYear + 1}-06-30`,
    periodSystem: 'TRIMESTER' as PeriodSystem,
  })

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const isStepValid = () => {
    switch (step) {
      case 0: return true
      case 1: return form.yearLabel.length >= 7 && !!form.startDate && !!form.endDate
      default: return true
    }
  }

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      // Doit rester strictement dans la même forme que ce qu'écrit
      // SettingsPage.tsx (handleSaveAcademic/handleSavePeriodSystem) : ce sont
      // exactement les mêmes clés de réglages que l'onboarding pré-remplit.
      await setTenantSetting(
        'academic_year',
        JSON.stringify({ name: form.yearLabel, startDate: form.startDate, endDate: form.endDate }),
      )
      await setTenantSetting('period_system', form.periodSystem)

      const academicYearId = crypto.randomUUID()
      await saveEntity('AcademicYear' as any, {
        id: academicYearId,
        label: form.yearLabel,
        startDate: form.startDate,
        endDate: form.endDate,
        isCurrent: true,
      })

      setTenant({ name: 'École SaaS', logoUrl: '' })

      completeOnboarding()
      toast.success('Établissement configuré avec succès')
      navigate('/dashboard')
    } catch {
      toast.error('Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  const currentStep = steps[step]

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <currentStep.icon className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {step === 0 && 'Bienvenue sur Ecole SaaS'}
            {step === 1 && 'Année scolaire'}
            {step === 2 && 'Prêt à démarrer'}
          </CardTitle>
          <CardDescription>
            {step === 0 && 'Configurons votre établissement en quelques étapes'}
            {step === 1 && 'Définissez l\'année scolaire en cours'}
            {step === 2 && 'Votre établissement est prêt'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Progress */}
          <div className="flex justify-center gap-2">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/60' : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 text-center py-4">
              <p className="text-muted-foreground text-lg">
                Cette application vous permet de gérer l'intégralité de votre établissement scolaire :
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  'Élèves et inscriptions',
                  'Notes et bulletins',
                  'Présences et absences',
                  'Emplois du temps',
                  'Paiements et finances',
                  'Messagerie interne',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Academic Year */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="year">Année scolaire *</Label>
                <Input
                  id="year"
                  placeholder="2024-2025"
                  value={form.yearLabel}
                  onChange={(e) => update('yearLabel', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Date de début *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Date de fin *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => update('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Système de périodes</Label>
                <Select
                  value={form.periodSystem}
                  onValueChange={(v) => update('periodSystem', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_SYSTEM_LABELS) as PeriodSystem[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {PERIOD_SYSTEM_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Modifiable plus tard dans Paramètres &gt; Année scolaire.
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Périodes ({PERIOD_SYSTEM_LABELS[form.periodSystem]})</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {PERIOD_PREVIEW[form.periodSystem].map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <div className="text-center space-y-4 py-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Votre école est configurée</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Vous pouvez maintenant vous connecter et commencer à utiliser l'application.
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-left space-y-2 text-sm">
                <p className="font-medium">Prochaines étapes :</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Créez vos classes et niveaux</li>
                  <li>Ajoutez vos professeurs</li>
                  <li>Inscrivez vos élèves</li>
                  <li>Configurez les frais de scolarité</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>

          {step < steps.length - 1 ? (
            <Button onClick={handleNext} disabled={!isStepValid()}>
              Suivant <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading}>
              {loading ? 'Configuration...' : 'Terminer et accéder'}{' '}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
