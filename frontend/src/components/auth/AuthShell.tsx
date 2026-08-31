import { ReactNode } from 'react'
import { WifiOff, Users, BookOpen, Wallet, ShieldCheck } from 'lucide-react'
import bg1 from '@/assets/bg1.jpg'
import { SupportContact } from '@/components/support-contact'

const FEATURES = [
  { icon: Users, text: 'Élèves, parents, enseignants et classes' },
  { icon: BookOpen, text: 'Notes, bulletins, présences et emplois du temps' },
  { icon: Wallet, text: 'Frais de scolarité, reçus et suivi des paiements' },
  { icon: WifiOff, text: 'Fonctionne sans Internet, se synchronise au retour du réseau' },
]

/**
 * Coquille des écrans publics (connexion, inscription) : panneau de marque
 * indigo à gauche — même langage que l'assistant de démarrage — et formulaire
 * centré à droite.
 */
export function AuthShell({
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  wide = false,
}: {
  title: string
  subtitle: string
  /** Petit libellé au-dessus du titre (ex. « Bon retour »). */
  eyebrow?: ReactNode
  children: ReactNode
  /** Ligne sous le formulaire (lien vers l'autre écran). */
  footer?: ReactNode
  /** Formulaire large (deux colonnes) pour tenir sans défilement. */
  wide?: boolean
}) {
  return (
    <div className="flex h-full w-full bg-background">
      <aside
        className="relative hidden w-[46%] max-w-xl shrink-0 flex-col justify-between overflow-hidden bg-cover bg-center p-10 text-white lg:flex"
        style={{ backgroundImage: `url(${bg1})` }}
      >
        {/* Voile sombre pour la lisibilité. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/35" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/15 text-lg font-bold backdrop-blur-sm">S</div>
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">Sekoliko</div>
            <div className="text-xs text-white/70">Gestion scolaire hors ligne</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="space-y-2.5">
            <h2 className="text-[26px] font-semibold leading-snug tracking-tight">
              Toute la vie de votre établissement, au même endroit.
            </h2>
            <p className="max-w-md text-sm text-white/80">
              Une application pensée pour les écoles de Madagascar : simple, rapide et fiable même
              quand la connexion ne l'est pas.
            </p>
          </div>

          <ul className="space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-white/90">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-2 text-xs text-white/70">
          <p className="text-white/80">Abonnement, licence ou question :</p>
          <SupportContact compact className="text-white/90" />
          <div className="flex items-center justify-between pt-1">
            <span>© {new Date().getFullYear()} Sekoliko</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Données chiffrées et sauvegardées
            </span>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-6 sm:p-10">
        <div className={wide ? 'w-full max-w-[600px]' : 'w-full max-w-[420px]'}>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-lg font-bold text-primary-foreground">S</div>
            <span className="text-lg font-semibold tracking-tight">Sekoliko</span>
          </div>

          {eyebrow && <p className="mb-1 text-sm font-medium text-primary">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className={wide ? 'mb-6 mt-1.5 text-sm text-muted-foreground' : 'mb-8 mt-1.5 text-sm text-muted-foreground'}>{subtitle}</p>

          {children}

          {footer && <div className={wide ? 'mt-5 border-t pt-4 text-center text-sm text-muted-foreground' : 'mt-8 border-t pt-6 text-center text-sm text-muted-foreground'}>{footer}</div>}
        </div>
      </main>
    </div>
  )
}
