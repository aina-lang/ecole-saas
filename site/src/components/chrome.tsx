'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Download, Menu, X, Phone, Mail, MessageCircle } from 'lucide-react'
import { NAV, PRODUCT, SUPPORT } from '@/lib/site'

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <Image
        src="/sekoliko-icon.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-[9px]"
      />
      <span className="flex flex-col leading-none">
        <span className={`text-base font-bold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>
          {PRODUCT.name}
        </span>
        <span className={`mt-0.5 text-[11px] ${light ? 'text-ink-400' : 'text-ink-500'}`}>
          {PRODUCT.tagline}
        </span>
      </span>
    </Link>
  )
}

export function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Un changement de page doit refermer le menu mobile, sinon il masque
  // la page d'arrivée.
  useEffect(() => setOpen(false), [pathname])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? 'border-ink-200 bg-ink-50/85 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-5">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? 'text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:block">
          <Link
            href="/telecharger"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-ink-700 transition hover:bg-ink-100 md:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-200 bg-ink-50 md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-700 hover:bg-ink-100"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/telecharger"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-900">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Wordmark light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">{PRODUCT.pitch}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              Le logiciel
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-ink-300 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/telecharger" className="text-ink-300 transition hover:text-white">
                  Télécharger
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              Nous joindre
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={`tel:${SUPPORT.phoneTel}`}
                  className="flex items-center gap-2.5 text-ink-300 transition hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0 text-brand-400" />
                  {SUPPORT.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={SUPPORT.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 text-ink-300 transition hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-brand-400" />
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT.email}`}
                  className="flex items-center gap-2.5 break-all text-ink-300 transition hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0 text-brand-400" />
                  {SUPPORT.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-800 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {PRODUCT.name}. Tous droits réservés.</p>
          <p>Version {PRODUCT.version} · Madagascar</p>
        </div>
      </div>
    </footer>
  )
}
