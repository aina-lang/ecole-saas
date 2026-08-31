import type { Metadata } from 'next'
import { Check, Infinity as InfinityIcon, Phone, MessageCircle, Mail, Lock, ArrowRight, Gift } from 'lucide-react'
import Link from 'next/link'
import { Reveal } from '@/components/animate'
import { SectionHeading, ScreenFrame } from '@/components/ui'
import { PRODUCT, SUPPORT, TRIAL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Licence',
  description: `Licence annuelle de ${PRODUCT.name} : sans limite d’élèves ni d’enseignants, activation en ligne puis usage hors ligne.`,
}

const INCLUDED = [
  'Élèves, parents et enseignants en nombre illimité',
  'Tous les modules, sans option payante',
  'Autant de postes que nécessaire dans l’établissement',
  'Synchronisation entre les postes et sauvegarde serveur',
  'Mises à jour du logiciel pendant toute la durée',
  'Assistance par téléphone, WhatsApp et e-mail',
] as const

export default function LicensePage() {
  return (
    <>
      <section className="border-b border-ink-200 bg-white pb-16 pt-16 sm:pt-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl" immediate>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Licence</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
              Une licence annuelle, sans compter les élèves
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-600">
              Pas de facturation par élève ni par poste : une école paie une fois par an, quelle que
              soit sa taille. Le tarif dépend de l’établissement — appelez-nous, la réponse est
              immédiate.
            </p>
          </Reveal>
        </div>
      </section>

      {/* L'essai précède la grille : c'est la première question d'un prospect,
          et il n'y a rien à payer pour commencer. */}
      <section className="border-b border-ink-200 bg-white pb-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="grid gap-8 rounded-2xl border border-brand-200 bg-brand-50 p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-brand-700 text-white">
                  <Gift className="h-[22px] w-[22px]" />
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink-900">
                  Commencez par {TRIAL.days} jours gratuits
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
                  L’essai démarre à la création de votre établissement, sans carte bancaire et
                  sans engagement. Tous les modules sont ouverts : vous pouvez saisir vos vraies
                  classes, vos vrais élèves et vos vraies notes, puis décider.
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
                  Au terme des {TRIAL.days} jours, rien n’est supprimé : l’application passe en
                  lecture seule et tout redevient modifiable dès l’activation d’une licence.
                </p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ['Durée', `${TRIAL.days} jours`],
                  ['Élèves', `jusqu’à ${TRIAL.maxStudents}`],
                  ['Enseignants', `jusqu’à ${TRIAL.maxTeachers}`],
                  ['Modules', 'tous, sans restriction'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-4 rounded-lg border border-brand-200 bg-white px-4 py-3"
                  >
                    <dt className="text-sm text-ink-600">{k}</dt>
                    <dd className="text-sm font-semibold text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-ink-50 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <Reveal>
            <div className="rounded-2xl border border-ink-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                  <InfinityIcon className="h-[22px] w-[22px]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Licence annuelle</h2>
                  <p className="text-sm text-ink-500">Un an, tout compris</p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-ink-600">
                Au-delà de l’essai, la licence lève toutes les limites :
              </p>

              <ul className="mt-5 space-y-3">
                {INCLUDED.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[15px] text-ink-700">
                    <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-700" />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-xl bg-ink-900 p-6 text-center">
                <p className="text-sm text-ink-400">Tarif sur demande</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  Il dépend de la taille de votre école
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <a
                    href={`tel:${SUPPORT.phoneTel}`}
                    className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
                  >
                    <Phone className="h-4 w-4" />
                    {SUPPORT.phoneDisplay}
                  </a>
                  <a
                    href={SUPPORT.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-ink-700 px-5 py-3 text-sm font-semibold text-ink-200 transition hover:border-ink-500 hover:text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Demander sur WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal from="left" delay={0.1}>
            <SectionHeading
              align="left"
              eyebrow="Comment ça marche"
              title="Un code de 16 caractères"
              lead="Nous émettons le code pour l’adresse e-mail de l’administrateur. Il s’active dans l’application, écran Licence."
            />

            <ol className="mt-8 space-y-5">
              {[
                {
                  n: 1,
                  t: 'Vous nous contactez',
                  d: 'Par téléphone, WhatsApp ou e-mail. Nous convenons du tarif et de la durée.',
                },
                {
                  n: 2,
                  t: 'Nous envoyons le code',
                  d: 'Un code de 16 caractères, émis pour l’e-mail de l’administrateur de l’école.',
                },
                {
                  n: 3,
                  t: 'Vous l’activez dans l’app',
                  d: 'Paramètres › Licence › coller le code › Activer. Cette étape demande Internet, une seule fois.',
                },
                {
                  n: 4,
                  t: 'Vous travaillez hors ligne',
                  d: 'La validité est mémorisée localement. L’application reste utilisable sans réseau jusqu’à l’échéance.',
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{step.t}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-600">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10">
              <ScreenFrame src="licence.webp" alt="Écran Licence de Sekoliko" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-white py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <div className="flex gap-5 rounded-xl border border-ink-200 bg-ink-50 p-7">
              <Lock className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" />
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  À l’échéance, vos données restent les vôtres
                </h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-600">
                  Si la licence n’est pas renouvelée, l’application passe en lecture seule : vous
                  continuez à consulter, exporter et imprimer tous vos dossiers, bulletins et
                  états financiers. Seule la saisie de nouvelles données est suspendue. Rien n’est
                  supprimé, et tout redevient modifiable dès le renouvellement.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 text-center">
            <p className="text-[15px] text-ink-600">Une question sur la licence ou le tarif ?</p>
            <a
              href={`mailto:${SUPPORT.email}`}
              className="mt-3 inline-flex items-center gap-2.5 text-[15px] font-semibold text-brand-700 transition hover:text-brand-800"
            >
              <Mail className="h-[18px] w-[18px]" />
              {SUPPORT.email}
            </a>
            <div className="mt-8">
              <Link
                href="/telecharger"
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 transition hover:gap-3 hover:text-ink-900"
              >
                Télécharger et essayer d’abord
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
