import Image from 'next/image'
import type { ReactNode } from 'react'
import { Download, HardDrive } from 'lucide-react'
import { DOWNLOADS } from '@/lib/site'

/** Titre de section : sur-titre discret, titre, puis phrase d'explication. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'center',
  light = false,
}: {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  align?: 'center' | 'left'
  light?: boolean
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
      )}
      <h2
        className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${
          light ? 'text-white' : 'text-ink-900'
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p className={`mt-4 text-[17px] leading-relaxed ${light ? 'text-ink-300' : 'text-ink-600'}`}>
          {lead}
        </p>
      )}
    </div>
  )
}

/**
 * Capture présentée dans un cadre de fenêtre. Les trois pastilles et la barre
 * de titre situent l'image : sans elles, une capture d'application posée à plat
 * se confond avec la page qui l'entoure.
 */
export function ScreenFrame({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string
  alt: string
  priority?: boolean
  className?: string
}) {
  return (
    <figure
      className={`overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-100 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
        <span className="ml-2 truncate text-[11px] font-medium text-ink-500">{alt}</span>
      </div>
      <Image
        src={`/screens/${src}`}
        alt={alt}
        width={1366}
        height={733}
        priority={priority}
        sizes="(max-width: 1024px) 100vw, 960px"
        className="h-auto w-full"
      />
    </figure>
  )
}

/** Les deux boutons de téléchargement, installateur en premier. */
export function DownloadButtons({ light = false }: { light?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href={`${DOWNLOADS.base}/${DOWNLOADS.installer.file}`}
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-brand-700 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-600 hover:shadow-brand-600/30"
      >
        <Download className="h-[18px] w-[18px]" />
        Télécharger pour Windows
        <span className="text-xs font-normal opacity-75">({DOWNLOADS.installer.size})</span>
      </a>
      <a
        href={`${DOWNLOADS.base}/${DOWNLOADS.portable.file}`}
        className={`inline-flex items-center justify-center gap-2.5 rounded-xl border px-6 py-3.5 text-[15px] font-semibold transition ${
          light
            ? 'border-ink-700 text-ink-200 hover:border-ink-500 hover:text-white'
            : 'border-ink-300 text-ink-700 hover:border-ink-400 hover:bg-white'
        }`}
      >
        <HardDrive className="h-[18px] w-[18px]" />
        Version portable
      </a>
    </div>
  )
}

/** Ligne d'information clé / valeur, utilisée dans les tableaux de spécifications. */
export function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ink-200 py-4 last:border-b-0 sm:flex-row sm:gap-6">
      <dt className="w-40 shrink-0 text-sm font-semibold text-ink-900">{label}</dt>
      <dd className="text-sm leading-relaxed text-ink-600">{value}</dd>
    </div>
  )
}
