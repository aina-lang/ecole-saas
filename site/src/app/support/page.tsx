import type { Metadata } from 'next'
import { Phone, MessageCircle, Mail, LifeBuoy, Database, Wrench, GraduationCap, BookOpen, Download } from 'lucide-react'
import { Reveal } from '@/components/animate'
import { SectionHeading } from '@/components/ui'
import { FAQ, MANUAL, PRODUCT, SUPPORT } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Assistance',
  description: `Aide à l’installation, reprise de données et questions fréquentes sur ${PRODUCT.name}.`,
}

const CHANNELS = [
  {
    icon: Phone,
    title: 'Téléphone',
    value: SUPPORT.phoneDisplay,
    href: `tel:${SUPPORT.phoneTel}`,
    note: 'Du lundi au samedi, heures de bureau',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    value: SUPPORT.phoneDisplay,
    href: SUPPORT.whatsapp,
    note: 'Photos d’écran acceptées — souvent le plus rapide',
    external: true,
  },
  {
    icon: Mail,
    title: 'E-mail',
    value: SUPPORT.email,
    href: `mailto:${SUPPORT.email}`,
    note: 'Pour les demandes détaillées et les devis',
  },
] as const

const SERVICES = [
  {
    icon: Wrench,
    title: 'Installation et mise en route',
    text: "Nous accompagnons la première installation, la création de l’établissement et le paramétrage des niveaux, classes et frais.",
  },
  {
    icon: Database,
    title: 'Reprise de vos données',
    text: "Vous tenez déjà vos élèves dans Excel ou dans un autre logiciel ? Envoyez-nous vos fichiers, nous étudions l’import.",
  },
  {
    icon: GraduationCap,
    title: 'Formation de l’équipe',
    text: "Une séance suffit généralement au secrétariat et à la direction. Les enseignants prennent la saisie des notes en quelques minutes.",
  },
] as const

export default function SupportPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 pb-20 pt-16 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-brand-700/25 blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-5">
          <Reveal className="text-center" immediate>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-brand-400">
              <LifeBuoy className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Une question ? On répond.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-300">
              L’équipe qui écrit le logiciel est celle qui décroche. Pas de ticket, pas de file
              d’attente.
            </p>
          </Reveal>

          <Reveal as="ul" stagger delay={0.1} className="mt-14 grid gap-5 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <li key={c.title}>
                <a
                  href={c.href}
                  {...(('external' in c && c.external) ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className="flex h-full flex-col rounded-xl border border-ink-700 bg-ink-800/50 p-6 transition hover:border-brand-700/60 hover:bg-ink-800"
                >
                  <c.icon className="h-6 w-6 text-brand-400" />
                  <h2 className="mt-4 text-sm font-bold uppercase tracking-wider text-ink-400">
                    {c.title}
                  </h2>
                  <p className="mt-2 break-all font-semibold text-white">{c.value}</p>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{c.note}</p>
                </a>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-b border-ink-200 bg-white py-16">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <a
              href={MANUAL.href}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-5 rounded-2xl border border-ink-200 bg-ink-50 p-7 transition hover:border-brand-200 hover:bg-brand-50 sm:flex-row sm:items-center"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Documentation</p>
                <h2 className="mt-1 text-xl font-bold text-ink-900">{MANUAL.label}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-600">
                  De l’installation au bulletin de fin d’année, pas à pas et avec les écrans du
                  logiciel. {MANUAL.detail}.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">
                <Download className="h-4 w-4" />
                Télécharger le PDF
              </span>
            </a>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Accompagnement"
              title="Ce que nous faisons avec vous"
              lead="Le logiciel s’installe seul, mais démarrer une année scolaire dessus mérite un coup de main."
            />
          </Reveal>

          <Reveal as="ul" stagger className="mt-14 grid gap-6 md:grid-cols-3">
            {SERVICES.map((s) => (
              <li key={s.title} className="rounded-xl border border-ink-200 p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                  <s.icon className="h-[22px] w-[22px]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-600">{s.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-ink-50 py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <SectionHeading eyebrow="Questions fréquentes" title="Les réponses les plus demandées" />
          </Reveal>

          <Reveal as="ul" stagger className="mt-12 space-y-3">
            {FAQ.map((item) => (
              <li key={item.q}>
                <details className="group rounded-xl border border-ink-200 bg-white px-6 transition hover:border-ink-300 open:border-brand-200 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-ink-900 marker:hidden">
                    {item.q}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600 transition group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-700">
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-[15px] leading-relaxed text-ink-600">{item.a}</p>
                </details>
              </li>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  )
}
