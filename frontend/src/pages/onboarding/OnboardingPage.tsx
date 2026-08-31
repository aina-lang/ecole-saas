import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { saveEntity, queryEntities } from '@/lib/db/pouchdb-compat'
import { setTenantSetting } from '@/lib/tenant-settings'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { formatDate, cn } from '@/lib/utils'
import { addMonths, differenceInCalendarMonths, format, isValid, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Building2, Users, BookOpen, CalendarCheck, Clock, Wallet, Mail,
  Sparkles, Check, ArrowRight, ArrowLeft,
} from 'lucide-react'

type PeriodSystem = 'TRIMESTER' | 'SEMESTER' | 'BIMESTER'

const PERIOD_SYSTEM_LABELS: Record<PeriodSystem, string> = {
  TRIMESTER: 'Trimestre (3 périodes)',
  SEMESTER: 'Semestre (2 périodes)',
  BIMESTER: 'Bimestre (5 périodes)',
}

const PERIOD_SYSTEM_CHOICES: Array<{ value: PeriodSystem; title: string; sub: string }> = [
  { value: 'TRIMESTER', title: 'Trimestre', sub: '3 périodes' },
  { value: 'SEMESTER', title: 'Semestre', sub: '2 périodes' },
  { value: 'BIMESTER', title: 'Bimestre', sub: '5 périodes' },
]

const PERIOD_COUNT: Record<PeriodSystem, number> = { TRIMESTER: 3, SEMESTER: 2, BIMESTER: 5 }
const PERIOD_NOUN: Record<PeriodSystem, string> = { TRIMESTER: 'trimestre', SEMESTER: 'semestre', BIMESTER: 'bimestre' }

const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`)

/**
 * Aperçu des périodes calculé depuis les dates saisies : l'intervalle
 * début → fin est découpé en N blocs de mois aussi égaux que possible.
 * Aperçu uniquement — le découpage précis se règle dans Paramètres >
 * Année scolaire.
 */
function buildPeriodPreview(
  startDate: string,
  endDate: string,
  system: PeriodSystem,
): Array<{ name: string; range: string }> {
  const count = PERIOD_COUNT[system]
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (!isValid(start) || !isValid(end) || end < start) {
    return Array.from({ length: count }, (_, i) => ({ name: `${ordinal(i + 1)} ${PERIOD_NOUN[system]}`, range: '—' }))
  }
  const totalMonths = differenceInCalendarMonths(end, start) + 1
  const base = Math.floor(totalMonths / count)
  const extra = totalMonths % count
  const fmt = (d: Date, withYear: boolean) => format(d, withYear ? 'MMM yyyy' : 'MMM', { locale: fr })
  let cursor = startOfMonth(start)
  return Array.from({ length: count }, (_, i) => {
    const len = Math.max(1, base + (i < extra ? 1 : 0))
    const first = cursor
    const last = addMonths(cursor, len - 1)
    cursor = addMonths(cursor, len)
    const sameYear = first.getFullYear() === last.getFullYear()
    const range = sameYear ? `${fmt(first, false)} – ${fmt(last, true)}` : `${fmt(first, true)} – ${fmt(last, true)}`
    return { name: `${ordinal(i + 1)} ${PERIOD_NOUN[system]}`, range }
  })
}

const steps = [
  { id: 'welcome', title: 'Bienvenue', sub: 'Découvrir les modules' },
  { id: 'year', title: 'Année scolaire', sub: 'Dates et périodes' },
  { id: 'done', title: 'Terminé', sub: 'Prêt à démarrer' },
]

const MODULES = [
  { icon: Users, title: 'Élèves et inscriptions', desc: 'Dossiers, parents, réinscriptions' },
  { icon: BookOpen, title: 'Notes et bulletins', desc: 'Saisie, moyennes, bulletins PDF' },
  { icon: CalendarCheck, title: 'Présences et absences', desc: 'Appel par demi-journée ou créneau' },
  { icon: Clock, title: 'Emplois du temps', desc: 'Grille hebdomadaire par classe' },
  { icon: Wallet, title: 'Paiements et finances', desc: 'Écolages, reçus, suivi des retards' },
  { icon: Mail, title: 'Messagerie interne', desc: 'Échanges avec les parents et l’équipe' },
]

const NEXT_STEPS = [
  { icon: Building2, label: 'Créez vos classes et niveaux' },
  { icon: Users, label: 'Ajoutez vos professeurs' },
  { icon: BookOpen, label: 'Inscrivez vos élèves' },
  { icon: Wallet, label: 'Configurez les frais de scolarité' },
]

const STEP_TITLES = [
  { title: 'Bienvenue sur Sekoliko', subtitle: 'Configurons votre établissement en trois étapes.' },
  { title: 'Année scolaire', subtitle: 'Définissez l’année en cours et son découpage.' },
  { title: 'Prêt à démarrer', subtitle: 'Tout est en place — un dernier coup d’œil avant de commencer.' },
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

      // Réutiliser une année déjà répliquée portant le même libellé (onboarding
      // rejoué sur un autre poste) plutôt que d'en créer un doublon — le
      // serveur impose l'unicité (tenantId, label).
      const existingYears = await queryEntities<any>('AcademicYear')
      const existing = existingYears.find((y) => y.label === form.yearLabel)
      await saveEntity('AcademicYear', {
        id: existing?.id ?? crypto.randomUUID(),
        label: form.yearLabel,
        startDate: form.startDate,
        endDate: form.endDate,
        isCurrent: true,
      })

      setTenant({ name: 'Sekoliko', logoUrl: '' })

      completeOnboarding()
      toast.success('Établissement configuré avec succès')
      navigate('/dashboard')
    } catch {
      toast.error('Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  const { title, subtitle } = STEP_TITLES[step]
  const periodPreview = buildPeriodPreview(form.startDate, form.endDate, form.periodSystem)

  return (
    <div className="h-full flex bg-card overflow-hidden">
      <div className="flex-1 flex min-h-0">
        {/* Volet gauche : marque + stepper.
            Mêmes jetons que la barre latérale de l'app (bg-sidebar…) : ils sont
            sombres dans les deux thèmes, c'est l'identité de la charte. Avec
            `bg-primary`, ce volet virait au bleu vif en mode sombre — une dalle
            lumineuse collée au contenu presque noir. */}
        <aside className="w-80 shrink-0 bg-sidebar text-sidebar-foreground p-8 flex flex-col justify-between">
          <div className="space-y-9">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-sidebar-foreground/10 flex items-center justify-center">
                <Building2 className="w-[22px] h-[22px]" />
              </div>
              <div>
                <div className="text-base font-bold tracking-wide">Sekoliko</div>
                <div className="text-xs text-sidebar-muted">Configuration initiale</div>
              </div>
            </div>

            <ol className="space-y-0">
              {steps.map((s, i) => {
                const done = i < step
                const current = i === step
                return (
                  <li key={s.id}>
                    <div className={cn('flex items-start gap-3.5', !done && !current && 'opacity-60')}>
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold',
                          done || current
                            ? 'bg-sidebar-accent text-sidebar'
                            : 'border-[1.5px] border-sidebar-border text-sidebar-muted',
                        )}
                      >
                        {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                      </div>
                      <div>
                        <div className={cn('text-[15px]', current ? 'font-semibold' : 'font-medium')}>{s.title}</div>
                        <div className="text-[12.5px] text-sidebar-muted">{s.sub}</div>
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={cn(
                          'w-[1.5px] h-7 ml-[13px] my-1',
                          done ? 'bg-sidebar-accent/60' : 'bg-sidebar-border',
                        )}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
          <p className="text-xs leading-relaxed text-sidebar-muted">
            Ces réglages sont partagés avec tous les postes de l’établissement. Vous pourrez les modifier plus tard dans Paramètres.
          </p>
        </aside>

        {/* Contenu */}
        <section className="flex-1 flex flex-col min-w-0">
          <header className="px-14 pt-12 space-y-1.5 max-w-4xl w-full">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-[14.5px] text-muted-foreground">{subtitle}</p>
          </header>

          <div className="flex-1 min-h-0 overflow-auto px-14 py-8 max-w-4xl w-full">
            {step === 0 && (
              <div className="space-y-5">
                <p className="text-[15px] leading-relaxed max-w-[560px]">
                  Tout ce qu’il faut pour gérer votre établissement au quotidien, y compris sans connexion
                  internet — chaque poste garde ses données et se synchronise dès que le réseau revient.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {MODULES.map(({ icon: Icon, title: t, desc }) => (
                    <div key={t} className="flex items-start gap-3.5 p-4 rounded-xl border bg-card">
                      <div className="w-10 h-10 rounded-[10px] bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[14.5px] font-semibold">{t}</div>
                        <div className="text-[13px] text-muted-foreground leading-snug">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex gap-8 h-full">
                <div className="flex-1 min-w-0 space-y-[18px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="year">Nom de l’année scolaire</Label>
                    <Input
                      id="year"
                      placeholder="2026-2027"
                      value={form.yearLabel}
                      onChange={(e) => update('yearLabel', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="startDate">Date de début</Label>
                      <Input id="startDate" type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="endDate">Date de fin</Label>
                      <Input id="endDate" type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Système de périodes</Label>
                    <div className="flex gap-2.5">
                      {PERIOD_SYSTEM_CHOICES.map((c) => {
                        const selected = form.periodSystem === c.value
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => update('periodSystem', c.value)}
                            className={cn(
                              'flex-1 min-w-0 flex flex-col gap-0.5 px-3 py-[11px] rounded-[10px] border-[1.5px] text-left transition-colors',
                              selected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted',
                            )}
                          >
                            <span className="text-sm font-semibold">{c.title}</span>
                            <span className="text-[12.5px] text-muted-foreground">{c.sub}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground">
                      Détermine le découpage des notes et des bulletins. Modifiable ensuite dans Paramètres.
                    </p>
                  </div>
                </div>

                <aside className="w-64 shrink-0 rounded-xl bg-muted px-5 py-[18px] self-start">
                  <div className="flex items-center gap-2 mb-1.5 text-accent-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.8px]">Aperçu des périodes</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground mb-2">
                    Année {form.yearLabel || '—'} · {PERIOD_COUNT[form.periodSystem]} {PERIOD_NOUN[form.periodSystem]}s
                  </div>
                  {periodPreview.map((p, i) => (
                    <div key={p.name} className="flex items-start gap-2.5 py-2.5 border-b last:border-b-0">
                      <div className="w-[22px] h-[22px] rounded-md bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-[13px] text-muted-foreground">{p.range}</div>
                      </div>
                    </div>
                  ))}
                </aside>
              </div>
            )}

            {step === 2 && (
              <div className="flex gap-8 h-full">
                <div className="flex-1 space-y-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-[52px] h-[52px] rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check className="w-[26px] h-[26px] text-green-700 dark:text-green-400" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-base font-semibold">Votre établissement est configuré</div>
                      <div className="text-[13.5px] text-muted-foreground">
                        Ces réglages sont enregistrés et partagés avec vos autres postes.
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-[0.8px] text-accent-foreground">Prochaines étapes</div>
                    {NEXT_STEPS.map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border bg-card">
                        <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="w-64 shrink-0 rounded-xl bg-muted px-5 py-[18px] self-start">
                  <div className="text-xs font-bold uppercase tracking-[0.8px] text-accent-foreground mb-1.5">Récapitulatif</div>
                  {[
                    ['Année scolaire', form.yearLabel],
                    ['Début', formatDate(form.startDate, 'd MMM yyyy')],
                    ['Fin', formatDate(form.endDate, 'd MMM yyyy')],
                    ['Périodes', PERIOD_SYSTEM_LABELS[form.periodSystem]],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5 border-b last:border-b-0">
                      <span className="text-[13.5px] text-muted-foreground">{k}</span>
                      <span className="text-[13.5px] font-semibold text-right">{v}</span>
                    </div>
                  ))}
                </aside>
              </div>
            )}
          </div>

          <footer className="px-14 py-4 border-t flex items-center justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!isStepValid()} className="h-10 px-5">
                Suivant <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading} className="h-10 px-5">
                {loading ? 'Configuration…' : 'Commencer'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </footer>
        </section>
      </div>
    </div>
  )
}
