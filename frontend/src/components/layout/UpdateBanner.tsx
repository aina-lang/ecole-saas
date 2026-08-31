import { useState } from 'react'
import { toast } from 'sonner'
import { DownloadIcon, ReloadIcon, UpdateIcon } from '@radix-ui/react-icons'
import { useUpdateState, formatBytes } from '@/lib/use-update-state'

// Bandeau de mise à jour, monté en permanence dans AppLayout sous le bandeau
// d'abonnement. Il ne s'affiche que lorsqu'il y a quelque chose à proposer :
// une mise à jour disponible, un téléchargement en cours, ou une mise à jour
// prête à installer. Les états « à jour », « hors ligne » et « erreur d'une
// vérification automatique » restent invisibles — ils sont consultables dans
// Paramètres › Général › Mises à jour.
export function UpdateBanner() {
  const state = useUpdateState()
  // Refus mémorisé par version : « Plus tard » masque le bandeau pour cette
  // version-là, mais la suivante sera bien annoncée.
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  if (state.status === 'available' && dismissedVersion !== state.version) {
    return (
      <div className="flex items-center justify-center gap-3 bg-primary/10 px-4 py-2 text-sm text-foreground">
        <UpdateIcon className="h-4 w-4 shrink-0 text-primary" />
        <span>
          La version <span className="font-medium">{state.version}</span> de Sekoliko est disponible.
        </span>
        <button
          type="button"
          onClick={() => void window.api.updates.download()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Télécharger
        </button>
        <button
          type="button"
          onClick={() => setDismissedVersion(state.version)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          Plus tard
        </button>
      </div>
    )
  }

  if (state.status === 'downloading') {
    const percent = Math.round(state.percent)
    return (
      <div className="relative flex items-center justify-center gap-3 bg-primary/10 px-4 py-2 text-sm text-foreground">
        <div
          className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
        <ReloadIcon className="relative h-4 w-4 shrink-0 animate-spin text-primary" />
        <span className="relative">
          Téléchargement de la version {state.version} — {percent} %
          {state.total > 0 && (
            <span className="text-muted-foreground">
              {' '}({formatBytes(state.transferred)} sur {formatBytes(state.total)})
            </span>
          )}
        </span>
      </div>
    )
  }

  if (state.status === 'downloaded') {
    return (
      <div className="flex items-center justify-center gap-3 bg-emerald-100 px-4 py-2 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
        <UpdateIcon className="h-4 w-4 shrink-0" />
        <span>
          La version <span className="font-medium">{state.version}</span> est prête à être installée.
        </span>
        <button
          type="button"
          onClick={() => {
            // L'installateur ferme l'app : on prévient avant de la voir
            // disparaître, surtout si une saisie est en cours.
            toast.info('Fermeture de Sekoliko et installation de la mise à jour…')
            setTimeout(() => void window.api.updates.install(), 600)
          }}
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Redémarrer maintenant
        </button>
        <span className="text-xs opacity-80">ou à la prochaine fermeture de l'application</span>
      </div>
    )
  }

  return null
}
