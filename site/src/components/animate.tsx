'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * useLayoutEffect côté client, useEffect côté serveur.
 *
 * C'est ce qui rend l'animation invisible au chargement : la mise à l'état
 * initial (opacité 0) s'exécute après le calcul du DOM mais AVANT que le
 * navigateur ne peigne. Avec useEffect, le contenu apparaîtrait une fraction
 * de seconde puis disparaîtrait pour se ré-animer.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Rien dans le HTML servi ni dans la feuille de style ne masque le contenu :
 * c'est GSAP lui-même qui pose l'état de départ, juste avant de l'animer.
 *
 * L'ordre compte. Masquer d'abord en CSS puis compter sur le script pour
 * révéler laisse une page définitivement blanche si le script échoue (erreur
 * JavaScript, réseau coupé en plein chargement, navigateur ancien). En
 * masquant depuis le script, le pire cas devient « page sans animation »,
 * ce qui est sans conséquence — surtout sur une page dont tout l'objet est le
 * bouton de téléchargement.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const OFFSET: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 32 },
  right: { x: -32 },
  none: {},
}

interface RevealProps {
  children: ReactNode
  className?: string
  /** Sens d'arrivée du bloc. */
  from?: Direction
  delay?: number
  /** Anime les enfants directs l'un après l'autre plutôt que le bloc entier. */
  stagger?: boolean
  /**
   * Joue dès le montage au lieu d'attendre le défilement. À réserver aux blocs
   * visibles d'emblée : au-dessus de la ligne de flottaison, attendre un
   * défilement qui n'aura peut-être jamais lieu n'a pas de sens.
   */
  immediate?: boolean
  as?: 'div' | 'section' | 'ul' | 'ol' | 'article' | 'header' | 'footer'
}

export function Reveal({
  children,
  className,
  from = 'up',
  delay = 0,
  stagger = false,
  immediate = false,
  as: Tag = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    const targets = stagger ? Array.from(el.children) : [el]

    const ctx = gsap.context(() => {
      gsap.set(targets, { opacity: 0, ...OFFSET[from] })
      gsap.to(targets, {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 0.7,
        delay,
        ease: 'power2.out',
        stagger: stagger ? 0.08 : 0,
        // `clearProps` rend la main au CSS une fois l'animation finie : sans
        // ça, GSAP laisse un transform en ligne qui crée un contexte
        // d'empilement et casse les éléments collants ou superposés.
        clearProps: 'opacity,transform',
        ...(immediate
          ? {}
          : { scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
      })
    }, el)

    return () => ctx.revert()
  }, [from, delay, stagger, immediate])

  return (
    // @ts-expect-error — la ref générique convient à toutes les balises listées.
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}

/**
 * Compteur qui monte jusqu'à sa valeur quand il devient visible.
 *
 * La valeur finale est écrite dans le HTML servi : elle reste lisible sans
 * JavaScript et pour les lecteurs d'écran, qui ne suivent pas l'animation.
 */
export function CountUp({
  to,
  suffix = '',
  className,
}: {
  to: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    const counter = { value: 0 }
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        value: to,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 95%', once: true },
        onUpdate: () => {
          el.textContent = `${Math.round(counter.value)}${suffix}`
        },
        onComplete: () => {
          el.textContent = `${to}${suffix}`
        },
      })
    }, el)

    return () => ctx.revert()
  }, [to, suffix])

  return (
    <span ref={ref} className={className}>
      {to}
      {suffix}
    </span>
  )
}

/**
 * Léger défilement parallaxe, réservé au décor : si le calcul ne s'applique
 * pas, rien d'important n'est perdu.
 */
export function Parallax({
  children,
  amount = 60,
  className,
}: {
  children: ReactNode
  amount?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: -amount,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      })
    }, el)

    return () => ctx.revert()
  }, [amount])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/**
 * Les images pèsent sur la position des blocs : tant qu'elles n'ont pas leur
 * taille définitive, les déclencheurs de défilement calculés à l'ouverture
 * pointent au mauvais endroit et des sections s'animent trop tôt — ou jamais.
 * On recalcule une fois tout chargé.
 */
export function ScrollRefresher() {
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh()
    if (document.readyState === 'complete') {
      refresh()
      return
    }
    window.addEventListener('load', refresh)
    return () => window.removeEventListener('load', refresh)
  }, [])
  return null
}
