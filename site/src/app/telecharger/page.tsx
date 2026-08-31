import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Download,
  HardDrive,
  ShieldAlert,
  MonitorCheck,
  KeyRound,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { Reveal } from '@/components/animate'
import { SectionHeading, SpecRow } from '@/components/ui'
import { DOWNLOADS, PRODUCT, REQUIREMENTS, SUPPORT } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Télécharger',
  description: `Téléchargez ${PRODUCT.name} ${PRODUCT.version} pour Windows 10 et 11 : installateur ou version portable.`,
}

const STEPS = [
  {
    icon: Download,
    title: 'Téléchargez le fichier',
    text: "Cliquez sur « Installateur Windows ». Le téléchargement pèse 201 Mo : sur une connexion lente, lancez-le et laissez-le tourner.",
  },
  {
    icon: MonitorCheck,
    title: 'Lancez l’installation',
    text: "Double-cliquez sur le fichier téléchargé. Choisissez le dossier d’installation, puis laissez faire. Un raccourci est créé sur le bureau.",
  },
  {
    icon: KeyRound,
    title: 'Créez votre établissement',
    text: "Au premier démarrage, renseignez le nom de l’école et l’année scolaire. Cette étape demande Internet, une seule fois.",
  },
  {
    icon: RefreshCw,
    title: 'Travaillez, en ligne ou non',
    text: "L’application est prête. Vous pouvez couper le réseau : tout continue de fonctionner et se synchronisera plus tard.",
  },
] as const

export default function DownloadPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 pb-20 pt-16 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[440px] w-[700px] -translate-x-1/2 rounded-full bg-brand-700/25 blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-5">
          <Reveal className="text-center" immediate>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-400">
              Téléchargement
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {PRODUCT.name} {PRODUCT.version} pour Windows
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-300">
              Deux façons d’obtenir le logiciel. L’installateur convient à la grande majorité des
              écoles ; la version portable dépanne sur un poste où l’on ne peut rien installer.
            </p>
          </Reveal>

          <Reveal as="ul" stagger delay={0.1} className="mt-14 grid gap-5 sm:grid-cols-2">
            <li className="relative rounded-xl border border-brand-700/50 bg-ink-800/60 p-7 ring-1 ring-brand-700/20">
              <span className="absolute -top-2.5 left-7 rounded-full bg-brand-700 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Recommandé
              </span>
              <Download className="h-7 w-7 text-brand-400" />
              <h2 className="mt-5 text-xl font-semibold text-white">
                {DOWNLOADS.installer.label}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                {DOWNLOADS.installer.detail}. Reçoit les mises à jour automatiquement.
              </p>
              <a
                href={`${DOWNLOADS.base}/${DOWNLOADS.installer.file}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-700 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-600"
              >
                <Download className="h-[18px] w-[18px]" />
                Télécharger ({DOWNLOADS.installer.size})
              </a>
              <p className="mt-3 break-all text-center font-mono text-[11px] text-ink-500">
                {DOWNLOADS.installer.file}
              </p>
            </li>

            <li className="rounded-xl border border-ink-700 bg-ink-800/40 p-7">
              <HardDrive className="h-7 w-7 text-ink-400" />
              <h2 className="mt-5 text-xl font-semibold text-white">{DOWNLOADS.portable.label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                {DOWNLOADS.portable.detail}.
              </p>
              <a
                href={`${DOWNLOADS.base}/${DOWNLOADS.portable.file}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-600 px-5 py-3.5 text-[15px] font-semibold text-ink-200 transition hover:border-ink-500 hover:text-white"
              >
                <HardDrive className="h-[18px] w-[18px]" />
                Télécharger ({DOWNLOADS.portable.size})
              </a>
              <p className="mt-3 break-all text-center font-mono text-[11px] text-ink-500">
                {DOWNLOADS.portable.file}
              </p>
            </li>
          </Reveal>
        </div>
      </section>

      {/* Avertissement SmartScreen — mieux vaut prévenir sur la page que
          laisser le visiteur croire à un fichier dangereux et abandonner. */}
      <section className="border-b border-amber-200 bg-amber-50">
        <Reveal className="mx-auto flex max-w-5xl gap-4 px-5 py-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm leading-relaxed text-amber-900">
            <p className="font-semibold">Windows affichera « Éditeur inconnu »</p>
            <p className="mt-1">
              Notre certificat de signature est en cours d’acquisition. À l’ouverture du fichier,
              cliquez sur <strong>Informations complémentaires</strong> puis{' '}
              <strong>Exécuter quand même</strong>. Par précaution, ne téléchargez le logiciel que
              depuis cette page ou un lien que nous vous avons envoyé.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Mise en route"
              title="De l’installation à la première saisie"
              lead="Quatre étapes, une dizaine de minutes en comptant le téléchargement."
            />
          </Reveal>

          <Reveal as="ol" stagger className="mt-14 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-5 rounded-xl border border-ink-200 p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-ink-900 text-white">
                  <step.icon className="h-[21px] w-[21px]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Étape {i + 1}
                  </p>
                  <h3 className="mt-1.5 font-semibold text-ink-900">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-600">{step.text}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-ink-50 py-24">
        <div className="mx-auto grid max-w-5xl gap-14 px-5 lg:grid-cols-2">
          <Reveal>
            <SectionHeading align="left" eyebrow="Compatibilité" title="Configuration requise" />
            <dl className="mt-8">
              {REQUIREMENTS.map((r) => (
                <SpecRow key={r.label} label={r.label} value={r.value} />
              ))}
            </dl>
            <p className="mt-6 rounded-lg border border-ink-200 bg-white p-4 text-sm leading-relaxed text-ink-600">
              <strong className="text-ink-900">Windows 7, 8 et 8.1 ne sont pas pris en charge.</strong>{' '}
              L’installateur le détecte et vous prévient plutôt que d’installer un logiciel qui ne
              démarrerait pas.
            </p>
          </Reveal>

          <Reveal from="left" delay={0.1}>
            <SectionHeading align="left" eyebrow="Après l’installation" title="Licence et assistance" />
            <div className="mt-8 space-y-4">
              <div className="rounded-xl border border-ink-200 bg-white p-6">
                <h3 className="font-semibold text-ink-900">Licence annuelle</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
                  Un code de 16 caractères, sans limite d’élèves ni d’enseignants. L’activation
                  demande Internet une fois ; l’application fonctionne hors ligne ensuite.
                </p>
                <Link
                  href="/licence"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:gap-3"
                >
                  Comment obtenir un code
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-xl border border-ink-200 bg-white p-6">
                <h3 className="font-semibold text-ink-900">Nous joindre</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
                  Une question sur l’installation ou la reprise de vos données existantes ?
                </p>
                <div className="mt-4 flex flex-col gap-2 text-sm font-medium">
                  <a
                    href={`tel:${SUPPORT.phoneTel}`}
                    className="text-brand-700 transition hover:text-brand-800"
                  >
                    {SUPPORT.phoneDisplay}
                  </a>
                  <a
                    href={`mailto:${SUPPORT.email}`}
                    className="break-all text-brand-700 transition hover:text-brand-800"
                  >
                    {SUPPORT.email}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
