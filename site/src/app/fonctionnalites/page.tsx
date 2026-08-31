import type { Metadata } from 'next'
import {
  Users,
  GraduationCap,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react'
import { Reveal } from '@/components/animate'
import { SectionHeading, ScreenFrame, DownloadButtons } from '@/components/ui'
import { FEATURES, PRODUCT } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Fonctionnalités',
  description: `Les modules de ${PRODUCT.name} : élèves, parents, notes, présences, emplois du temps, écolages et passage de classe.`,
}

const ICONS = {
  Users,
  GraduationCap,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  ArrowUpRight,
  BarChart3,
} as const

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-ink-200 bg-white pb-16 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl" immediate>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
              Fonctionnalités
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
              Chaque module, en détail
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-600">
              {PRODUCT.name} couvre la scolarité et les finances d’un établissement, de
              l’inscription d’un élève jusqu’à son passage en classe supérieure. Voici ce que fait
              chaque partie, avec l’écran correspondant.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="divide-y divide-ink-200">
        {FEATURES.map((feature, i) => {
          const Icon = ICONS[feature.icon as keyof typeof ICONS]
          const flipped = i % 2 === 1
          return (
            <section
              key={feature.id}
              id={feature.id}
              className={i % 2 === 0 ? 'bg-ink-50 py-20' : 'bg-white py-20'}
            >
              <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
                <Reveal
                  from={flipped ? 'right' : 'left'}
                  className={flipped ? 'lg:order-2' : undefined}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                    {feature.title}
                  </h2>
                  <p className="mt-4 text-[17px] font-medium leading-relaxed text-ink-700">
                    {feature.summary}
                  </p>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-600">{feature.detail}</p>
                </Reveal>

                <Reveal
                  from={flipped ? 'left' : 'right'}
                  delay={0.1}
                  className={flipped ? 'lg:order-1' : undefined}
                >
                  <ScreenFrame src={feature.screen} alt={feature.title} />
                </Reveal>
              </div>
            </section>
          )
        })}
      </div>

      <section className="relative overflow-hidden bg-ink-900 py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-brand-700/25 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <SectionHeading
              light
              title="Le plus simple reste de l’essayer"
              lead="Le logiciel s’installe en deux minutes et fonctionne immédiatement, avec ou sans connexion."
            />
            <div className="mt-10 flex justify-center">
              <DownloadButtons light />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
