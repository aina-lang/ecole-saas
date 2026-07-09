import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSyncStore } from '@/stores/sync-store'
import { getInitials } from '@/lib/utils'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isOnline = useSyncStore((s) => s.isOnline)
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const pendingCount = useSyncStore((s) => s.pendingCount)

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleSidebar}
        >
          <HamburgerMenuIcon className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSyncing ? (
            <ReloadIcon className="h-3.5 w-3.5 animate-spin text-blue-500" />
          ) : (
            <span
              className={`h-3 w-3 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          )}
          <span className="hidden sm:inline">
            {isSyncing
              ? 'Synchronisation...'
              : isOnline
                ? 'En ligne'
                : `Hors ligne (${pendingCount} en attente)`}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {user ? getInitials(user.firstName, user.lastName) : 'U'}
                </AvatarFallback>
              </Avatar>
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
            <DropdownMenuItem disabled>Paramètres</DropdownMenuItem>
            <DropdownMenuItem disabled>Profil</DropdownMenuItem>
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