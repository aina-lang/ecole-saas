import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeliberationPage } from './DeliberationPage'
import { RolloverPage } from './RolloverPage'
import { ReinscriptionPage } from './ReinscriptionPage'
import { DispatchPage } from './DispatchPage'

// Le module Promotions est un PROCESSUS en quatre étapes, dans cet ordre.
// Le bandeau ci-dessous le rend lisible comme un parcours (étape courante,
// étapes précédentes, suivantes) plutôt que comme quatre onglets équivalents.
const STEPS = [
  { value: 'deliberation', label: 'Délibération', hint: 'Moyennes et décisions de passage' },
  { value: 'rollover', label: 'Clôture annuelle', hint: 'Fermer l’année, préparer la suivante' },
  { value: 'reinscription', label: 'Ré-inscriptions', hint: 'Validation et contrôle des dettes' },
  { value: 'dispatch', label: 'Répartition', hint: 'Affectation aux classes' },
] as const

type StepValue = (typeof STEPS)[number]['value']

export function PromotionsPage({ defaultTab }: { defaultTab?: string }) {
  const navigate = useNavigate()
  const current = (STEPS.some((s) => s.value === defaultTab) ? defaultTab : 'deliberation') as StepValue
  const currentIndex = STEPS.findIndex((s) => s.value === current)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Passage de classe en quatre étapes — de la délibération à la répartition dans les nouvelles classes.
        </p>
      </div>

      <ol className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Étapes du processus">
        {STEPS.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <li key={step.value} className="relative">
              <button
                type="button"
                onClick={() => navigate(`/administration/promotion/${step.value}`)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  active ? 'bg-accent' : 'hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active && 'bg-primary text-primary-foreground',
                    done && 'bg-emerald-600 text-white',
                    !active && !done && 'border border-border bg-background text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium', active ? 'text-accent-foreground' : done ? 'text-foreground' : 'text-muted-foreground')}>
                    {step.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{step.hint}</span>
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-border lg:block" />
              )}
            </li>
          )
        })}
      </ol>

      {current === 'deliberation' && <DeliberationPage />}
      {current === 'rollover' && <RolloverPage />}
      {current === 'reinscription' && <ReinscriptionPage />}
      {current === 'dispatch' && <DispatchPage />}
    </div>
  )
}
