import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReloadIcon, DownloadIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons'
import { useUpdateState, formatBytes } from '@/lib/use-update-state'
import type { UpdateState } from '@/preload/index.d'

// Carte « Mises à jour » de Paramètres › Général : version installée, état de
// la dernière vérification et bouton de vérification manuelle. Le bandeau en
// haut de l'app (UpdateBanner) ne montre que les cas où il y a une action à
// faire ; c'est ici qu'on vient quand on veut savoir où on en est.
export function UpdatesCard() {
  const state = useUpdateState()
  const [checking, setChecking] = useState(false)
  const version = __APP_VERSION__

  async function handleCheck() {
    setChecking(true)
    try {
      await window.api.updates.check()
    } finally {
      setChecking(false)
    }
  }

  const busy = checking || state.status === 'checking'

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Mises à jour</CardTitle>
        <CardDescription>
          Sekoliko vérifie automatiquement les nouvelles versions toutes les 6 heures lorsque
          l'ordinateur est connecté à Internet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">Version installée : {version}</p>
            <p className="mt-0.5 text-muted-foreground">{describe(state)}</p>
          </div>

          {state.status === 'available' ? (
            <Button size="sm" onClick={() => void window.api.updates.download()}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Télécharger la version {state.version}
            </Button>
          ) : state.status === 'downloaded' ? (
            <Button size="sm" onClick={() => void window.api.updates.install()}>
              Redémarrer et installer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheck}
              disabled={busy || state.status === 'unsupported' || state.status === 'downloading'}
            >
              {busy ? (
                <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Vérification…</>
              ) : (
                'Vérifier maintenant'
              )}
            </Button>
          )}
        </div>

        {state.status === 'up-to-date' && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircledIcon className="h-3.5 w-3.5" />
            Vérifié le {new Date(state.checkedAt).toLocaleString('fr-FR')}
          </p>
        )}

        {state.status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <CrossCircledIcon className="h-3.5 w-3.5 shrink-0" />
            {state.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function describe(state: UpdateState): string {
  switch (state.status) {
    case 'unsupported':
      return state.reason
    case 'checking':
      return 'Recherche d’une nouvelle version…'
    case 'up-to-date':
      return 'Votre application est à jour.'
    case 'available':
      return `La version ${state.version} est disponible au téléchargement.`
    case 'downloading':
      return `Téléchargement en cours : ${Math.round(state.percent)} % (${formatBytes(state.transferred)} sur ${formatBytes(state.total)}).`
    case 'downloaded':
      return `La version ${state.version} s'installera au redémarrage de l'application.`
    case 'error':
      return 'La dernière vérification a échoué.'
    default:
      return 'Aucune vérification effectuée depuis le démarrage.'
  }
}
