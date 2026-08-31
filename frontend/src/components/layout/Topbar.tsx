import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { StudentPhoto } from '@/components/ui/student-photo'
import { useSyncStore } from '@/stores/sync-store'
import { getInitials } from '@/lib/utils'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarContent } from './SidebarContent'
import { ModeToggle } from '../mode-toggle'
import { useNavigate } from 'react-router-dom'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isOnline = useSyncStore((s) => s.isOnline)
  // « Synchronisation… » seulement si un flux est réellement actif (même
  // règle que l'écran Synchronisation, sinon les deux se contredisaient).
  const isSyncing = useSyncStore((s) => s.isSyncing && Object.values(s.entityStatus ?? {}).some((st) => st?.syncing))
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt)
  const tenant = useUIStore((s) => s.tenant)
  const queryClient = useQueryClient()
  const [manualBusy, setManualBusy] = useState(false)

  // Bouton d'en-tête : synchro forcée AVEC retour visible (spinner + toast),
  // sinon un clic qui réussit en 1 s ressemble à un clic qui ne fait rien.
  async function runManualSync() {
    if (manualBusy) return
    setManualBusy(true)
    const started = Date.now()
    try {
      const { performSync } = await import('@/lib/db/sync-manager')
      const results = await performSync()
      const failed = results.filter((r) => !r.ok)
      const received = results.reduce((n, r) => n + (r.synced ?? 0), 0)
      queryClient.invalidateQueries()
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      if (failed.length) {
        toast.warning(`Synchronisation terminée avec ${failed.length} base${failed.length > 1 ? 's' : ''} en erreur`, { description: failed.map((f) => `${f.entityType}${f.error ? ` : ${f.error}` : ''}`).slice(0, 3).join(' · ') })
      } else {
        toast.success('Tout est synchronisé', { description: `${received ? `${received} modification${received > 1 ? 's' : ''} échangée${received > 1 ? 's' : ''}` : 'Aucune modification en attente'} · ${secs} s` })
      }
    } catch (err: any) {
      toast.error('Synchronisation impossible', { description: err?.message })
    } finally {
      setManualBusy(false)
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <HamburgerMenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
            <SheetHeader className="h-14 flex items-center gap-2 border-b border-sidebar-border px-4 text-left">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded bg-white object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                  {tenant.name ? tenant.name.charAt(0) : 'E'}
                </div>
              )}
              <SheetTitle className="text-sm font-semibold">
                {tenant.name || 'Sekoliko'}
              </SheetTitle>
            </SheetHeader>
            <SidebarContent forceShowLabels onItemClick={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => navigate('/sync')} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted">
                {isSyncing || manualBusy ? (
                  <ReloadIcon className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <span className={`h-3 w-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                )}
                <span className="hidden sm:inline">
                  {isSyncing || manualBusy
                    ? 'Synchronisation...'
                    : isOnline
                      ? pendingCount > 0 ? `En ligne · ${pendingCount} en attente` : 'En ligne'
                      : `Hors ligne (${pendingCount} en attente)`}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-medium">Synchronisation automatique</p>
              <p className="text-muted-foreground">En continu + vérification toutes les 6 s{lastSyncAt ? ` · dernier échange ${formatDistanceToNow(new Date(lastSyncAt), { locale: fr, addSuffix: true })}` : ''}.</p>
              <p className="text-muted-foreground">Cliquer pour ouvrir l'état détaillé.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Synchroniser maintenant"
                onClick={runManualSync}
                disabled={manualBusy || !isOnline}
              >
                <ReloadIcon className={`h-4 w-4 ${manualBusy ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Synchroniser maintenant</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <StudentPhoto
                className="h-8 w-8"
                src={user?.photoUrl}
                alt={user?.firstName}
                initials={user ? getInitials(user.firstName, user.lastName) : 'U'}
                fallbackClassName="text-xs"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/administration/settings')}>
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => user?.id && navigate(`/administration/users/${user.id}/edit`)}>
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/account/password')}>
              Changer le mot de passe
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function ReloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.84998 7.49998C1.84998 4.66416 4.05979 1.53198 7.49998 1.53198C10.2783 1.53198 12.0406 3.47663 12.8505 5.5M13.15 7.49998C13.15 10.3358 10.9402 13.468 7.49998 13.468C4.72166 13.468 2.95937 11.5234 2.14951 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 1.5V5.5H8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 13.5V9.5H6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
