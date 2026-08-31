'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { GALLERY } from '@/lib/site'

/**
 * Visite guidée des écrans : un onglet par module, la capture se substituant à
 * la précédente en fondu.
 *
 * Toutes les images sont montées en permanence et empilées, seule l'opacité
 * change. Deux raisons : le navigateur les a déjà décodées, donc le passage
 * d'un onglet à l'autre est instantané, et la hauteur du bloc ne saute pas
 * entre deux captures de proportions voisines.
 */
export function ScreenGallery() {
  const [active, setActive] = useState(0)
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const shots = Array.from(el.querySelectorAll<HTMLElement>('[data-shot]'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shots.forEach((s, i) => {
        s.style.opacity = i === active ? '1' : '0'
      })
      return
    }
    const ctx = gsap.context(() => {
      shots.forEach((shot, i) => {
        gsap.to(shot, {
          opacity: i === active ? 1 : 0,
          scale: i === active ? 1 : 1.015,
          duration: 0.45,
          ease: 'power2.out',
        })
      })
    }, el)
    return () => ctx.revert()
  }, [active])

  return (
    <div>
      <div
        role="tablist"
        aria-label="Écrans de l’application"
        className="flex flex-wrap justify-center gap-2"
      >
        {GALLERY.map((shot, i) => (
          <button
            key={shot.src}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              i === active
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-900 hover:ring-ink-300'
            }`}
          >
            {shot.label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        className="relative mt-8 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[0_30px_70px_-30px_rgba(15,23,42,0.45)]"
      >
        <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-100 px-3.5 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="ml-2 text-[11px] font-medium text-ink-500">
            Sekoliko — {GALLERY[active].label}
          </span>
        </div>

        {/* Le ratio des captures (1366×733) fixe la hauteur du bloc empilé. */}
        <div className="relative aspect-[1366/733]">
          {GALLERY.map((shot, i) => (
            <div
              key={shot.src}
              data-shot
              aria-hidden={i !== active}
              className="absolute inset-0"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <Image
                src={`/screens/${shot.src}`}
                alt={`Écran ${shot.label} de Sekoliko`}
                fill
                sizes="(max-width: 1024px) 100vw, 1000px"
                className="object-cover object-top"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
