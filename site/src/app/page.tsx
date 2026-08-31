import Link from 'next/link'
import {
  ArrowRight,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  Printer,
  Users,
  GraduationCap,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  ArrowUpRight,
  BarChart3,
  Check,
  Phone,
  MessageCircle,
} from 'lucide-react'
import { Reveal, CountUp, Parallax } from '@/components/animate'
import { ScreenGallery } from '@/components/gallery'
import { DownloadButtons, SectionHeading, ScreenFrame } from '@/components/ui'
import { FAQ, FEATURES, PRODUCT, SUPPORT } from '@/lib/site'

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

export default function HomePage() {
  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900">
        {/* Halos décoratifs : purement esthétiques, masqués aux lecteurs d'écran. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-brand-700/25 blur-[130px]" />
          <div className="absolute -bottom-52 -left-40 h-[480px] w-[480px] rounded-full bg-sky-accent/15 blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-16 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <Reveal from="up" immediate>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-800/60 px-3.5 py-1.5 text-xs font-medium text-ink-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Version {PRODUCT.version} disponible pour Windows
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                {PRODUCT.headline}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">{PRODUCT.pitch}</p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Élèves, parents, enseignants et classes',
                  'Notes, bulletins, présences et emplois du temps',
                  'Frais de scolarité, reçus et suivi des paiements',
                  'Fonctionne sans Internet, se synchronise au retour du réseau',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[15px] text-ink-200">
                    <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-400" />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <DownloadButtons light />
              </div>

              <p className="mt-4 text-[13px] text-ink-500">
                Windows 10 et 11 · Installation en deux minutes · 14 jours d’essai gratuit
              </p>
            </Reveal>

            <Reveal from="left" delay={0.15} immediate>
              <Parallax amount={30}>
                <div className="overflow-hidden rounded-xl border border-ink-700 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.75)]">
                  <ScreenFrame
                    src="tableau-de-bord-sombre.webp"
                    alt="Tableau de bord Sekoliko"
                    priority
                    className="!rounded-none !border-0 !shadow-none"
                  />
                </div>
              </Parallax>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────────── Chiffres clés ───────────────────── */}
      <section className="border-b border-ink-200 bg-white">
        <Reveal
          as="ul"
          stagger
          className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-14 sm:gap-4 lg:grid-cols-4"
        >
          {[
            { value: 100, suffix: ' %', label: 'des fonctions utilisables hors ligne' },
            { value: 3, suffix: ' formats', label: 'd’export : PDF, Word et Excel' },
            { value: 17, suffix: ' modules', label: 'de la scolarité aux finances' },
            { value: 2, suffix: ' min', label: 'pour installer et démarrer' },
          ].map((stat) => (
            <li key={stat.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mx-auto mt-2 max-w-[190px] text-sm leading-snug text-ink-600">
                {stat.label}
              </p>
            </li>
          ))}
        </Reveal>
      </section>

      {/* ───────────────────── Hors ligne ───────────────────── */}
      <section className="bg-ink-50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Conçu pour le terrain"
              title="La coupure de réseau n’arrête plus le travail"
              lead="La plupart des logiciels scolaires cessent de fonctionner dès que la connexion tombe. Sekoliko fait l’inverse : il travaille d’abord sur votre ordinateur, et se synchronise quand il peut."
            />
          </Reveal>

          <Reveal as="ul" stagger className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: WifiOff,
                title: 'Tout se fait en local',
                text: "Saisie des notes, appel, encaissements, impression des bulletins : chaque poste garde ses données et continue seul, sans attendre le serveur.",
              },
              {
                icon: RefreshCw,
                title: 'Synchronisation automatique',
                text: "Dès que le réseau revient, les changements partent et ceux des autres postes arrivent. Personne ne pense à sauvegarder : c’est continu.",
              },
              {
                icon: ShieldCheck,
                title: 'Plusieurs postes, sans conflit',
                text: "Le secrétariat encaisse pendant que le surveillant fait l’appel. Les modifications concurrentes sont réconciliées, la plus récente l’emporte.",
              },
            ].map((card) => (
              <li
                key={card.title}
                className="rounded-xl border border-ink-200 bg-white p-7 transition hover:border-brand-200 hover:shadow-lg hover:shadow-ink-900/5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                  <card.icon className="h-[22px] w-[22px]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-900">{card.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-600">{card.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Galerie ───────────────────── */}
      <section className="border-y border-ink-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Aperçu"
              title="Voir avant d’installer"
              lead="Des captures réelles du logiciel, pas des maquettes. Choisissez un module pour l’examiner."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <ScreenGallery />
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Modules ───────────────────── */}
      <section className="bg-ink-50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Fonctionnalités"
              title="Tout l’établissement, un seul logiciel"
              lead="De l’inscription au bulletin, du premier écolage au passage en classe supérieure."
            />
          </Reveal>

          <Reveal as="ul" stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = ICONS[feature.icon as keyof typeof ICONS]
              return (
                <li
                  key={feature.id}
                  className="group rounded-xl border border-ink-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-ink-900/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-ink-900 text-white transition group-hover:bg-brand-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.summary}</p>
                </li>
              )
            })}
          </Reveal>

          <Reveal delay={0.1} className="mt-10 text-center">
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:gap-3 hover:text-brand-800"
            >
              Voir le détail de chaque module
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Exports ───────────────────── */}
      <section className="border-y border-ink-200 bg-white py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="Documents"
              title="Ce qui compte finit sur papier"
              lead="Une école vit encore de documents imprimés : listes d’appel, bulletins, reçus, états de recouvrement. Tout sort du logiciel prêt à imprimer."
            />
            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Printer,
                  title: 'Bulletins et reçus en PDF',
                  text: 'Mise en page fixe, en-tête à vos couleurs avec le logo de l’établissement.',
                },
                {
                  icon: Users,
                  title: 'Listes en PDF, Word et Excel',
                  text: 'Élèves, parents, enseignants et classes — avec les filtres de l’écran appliqués.',
                },
                {
                  icon: BarChart3,
                  title: 'États financiers',
                  text: 'Collecte mensuelle, taux de recouvrement, impayés par classe et par élève.',
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <item.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900">{item.title}</p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-ink-600">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal from="left" delay={0.1}>
            <ScreenFrame src="frais.webp" alt="Structure des frais par niveau" />
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── FAQ ───────────────────── */}
      <section className="bg-ink-50 py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <SectionHeading eyebrow="Questions fréquentes" title="Ce qu’on nous demande le plus" />
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

      {/* ───────────────────── Appel final ───────────────────── */}
      <section className="relative overflow-hidden bg-ink-900 py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-700/25 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <SectionHeading
              light
              title="Installez-le, essayez-le, décidez ensuite"
              lead="Le téléchargement est libre et l’installation prend deux minutes. Nous restons joignables pour la mise en route et la reprise de vos données."
            />
            <div className="mt-10 flex justify-center">
              <DownloadButtons light />
            </div>

            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
              <a
                href={`tel:${SUPPORT.phoneTel}`}
                className="inline-flex items-center gap-2.5 text-[15px] font-medium text-ink-200 transition hover:text-white"
              >
                <Phone className="h-[18px] w-[18px] text-brand-400" />
                {SUPPORT.phoneDisplay}
              </a>
              <a
                href={SUPPORT.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 text-[15px] font-medium text-ink-200 transition hover:text-white"
              >
                <MessageCircle className="h-[18px] w-[18px] text-brand-400" />
                Écrire sur WhatsApp
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
