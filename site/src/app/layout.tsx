import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header, Footer } from '@/components/chrome'
import { ScrollRefresher } from '@/components/animate'
import { PRODUCT } from '@/lib/site'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    template: `%s · ${PRODUCT.name}`,
  },
  description: PRODUCT.pitch,
  keywords: [
    'gestion scolaire',
    'logiciel école Madagascar',
    'hors ligne',
    'bulletins',
    'écolage',
    'notes',
    'présences',
  ],
  openGraph: {
    title: `${PRODUCT.name} — ${PRODUCT.headline}`,
    description: PRODUCT.pitch,
    type: 'website',
    locale: 'fr_MG',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <ScrollRefresher />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
