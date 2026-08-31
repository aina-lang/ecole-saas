import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

/**
 * Primitives de mise en page partagées par TOUTES les pages (listes,
 * formulaires, fiches). La cohérence de l'app vient d'ici : mêmes
 * en-têtes, mêmes espacements, mêmes zones d'actions.
 *
 *  - PageHeader   : titre + description + actions (+ bouton Retour)
 *  - FilterBar    : bandeau de recherche / filtres d'une liste
 *  - FormShell    : coque de formulaire avec barre d'actions fixe en bas
 *  - FormSection  : carte de section (titre, description, champs en grille)
 *  - DetailHeader : bandeau d'identité d'une fiche (photo, titre, badges, actions)
 *  - InfoGrid     : grille clé / valeur d'une fiche
 *  - EmptyState   : état vide d'une liste ou d'un onglet
 */

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Chemin (ou -1) du bouton Retour ; absent = pas de bouton. */
  backTo?: string | number
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, backTo, actions, className }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {backTo !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={() => (typeof backTo === 'number' ? navigate(backTo) : navigate(backTo))}
            aria-label="Retour"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3', className)}>
      {children}
    </div>
  )
}

interface FormShellProps {
  children: ReactNode
  /** Boutons de la barre d'actions (Annuler / Enregistrer…). */
  actions: ReactNode
  /** Texte d'aide à gauche de la barre (ex : « * champs obligatoires »). */
  hint?: ReactNode
  className?: string
}

/**
 * Le contenu défile, la barre d'actions reste visible en bas : l'utilisateur
 * n'a jamais à chercher le bouton Enregistrer dans un long formulaire.
 */
export function FormShell({ children, actions, hint, className }: FormShellProps) {
  // La barre est fixée à la fenêtre : elle doit commencer après la barre
  // latérale (large ou repliée) sur grand écran.
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  return (
    <div className={cn('flex flex-col gap-6 pb-24', className)}>
      {children}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-20 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80',
          sidebarOpen ? 'lg:left-60' : 'lg:left-16',
        )}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <span className="text-xs text-muted-foreground">{hint ?? '* champs obligatoires'}</span>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </div>
    </div>
  )
}

interface FormSectionProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Nombre de colonnes de la grille de champs (défaut 2). */
  columns?: 1 | 2 | 3
  /** Contenu libre placé au-dessus de la grille (ex : photo). */
  aside?: ReactNode
  className?: string
}

export function FormSection({ title, description, children, columns = 2, aside, className }: FormSectionProps) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns]
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">
        {aside}
        <div className={cn('grid gap-4', cols)}>{children}</div>
      </CardContent>
    </Card>
  )
}

interface DetailHeaderProps {
  /** Avatar / photo déjà rendu (ex : <StudentPhoto …/>). */
  avatar?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  /** Lignes d'informations courtes sous le titre (matricule, classe…). */
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function DetailHeader({ avatar, title, subtitle, badges, meta, actions, className }: DetailHeaderProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-wrap items-center gap-5 p-6">
        {avatar}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {badges}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {meta && <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardContent>
    </Card>
  )
}

export interface InfoItem {
  label: ReactNode
  value: ReactNode
  /** Étend l'item sur toute la largeur (adresses, notes…). */
  wide?: boolean
}

export function InfoGrid({ items, columns = 2, className }: { items: InfoItem[]; columns?: 2 | 3; className?: string }) {
  const cols = columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', cols, className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0', it.wide && 'sm:col-span-full')}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium">
            {it.value === null || it.value === undefined || it.value === '' ? <span className="text-muted-foreground">—</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      {icon && <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
