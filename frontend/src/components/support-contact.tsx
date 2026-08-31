import { Phone, Mail, MessageCircle } from 'lucide-react'
import { SUPPORT } from '@/lib/support'
import { cn } from '@/lib/utils'

/**
 * Bloc « nous contacter » (abonnement, licence, assistance). Les liens
 * tel:/mailto:/wa.me s'ouvrent dans l'application système par défaut.
 */
export function SupportContact({ compact = false, stacked = false, className }: { compact?: boolean; /** Une ligne par contact (colonnes étroites). */ stacked?: boolean; className?: string }) {
  const items = [
    { icon: Phone, label: 'Téléphone', value: SUPPORT.phoneDisplay, href: `tel:${SUPPORT.phoneTel}` },
    { icon: MessageCircle, label: 'WhatsApp', value: SUPPORT.phoneDisplay, href: SUPPORT.whatsapp },
    { icon: Mail, label: 'E-mail', value: SUPPORT.email, href: `mailto:${SUPPORT.email}` },
  ]
  if (compact) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
        {items.map((it) => (
          <a key={it.label} href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
            <it.icon className="h-3.5 w-3.5" />
            {it.value}
          </a>
        ))}
      </span>
    )
  }
  return (
    <div className={cn('grid gap-2', stacked ? 'grid-cols-1' : 'sm:grid-cols-3', className)}>
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          target={it.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
          className={cn(
            'flex items-center gap-3 rounded-lg border bg-muted/30 transition-colors hover:border-primary/40 hover:bg-accent',
            stacked ? 'px-3 py-2' : 'p-3',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <it.icon className="h-4 w-4" />
          </span>
          {stacked ? (
            <>
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{it.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.value}</span>
            </>
          ) : (
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{it.label}</span>
              <span className="block truncate text-sm font-medium">{it.value}</span>
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
