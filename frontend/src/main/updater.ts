import { app, BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'

// Mise à jour automatique (electron-updater, fournisseur « generic »).
//
// Le dépôt de mises à jour est déclaré dans electron-builder.yml (bloc
// `publish`) : le serveur expose `latest.yml` + l'installateur NSIS sur
// /updates. À chaque publication, `npm run build:win` régénère ces fichiers
// dans frontend/dist et il suffit de les y recopier.
//
// Choix volontaires, dictés par le terrain (écoles à connexion lente ou
// intermittente) :
//   - `autoDownload = false` : on annonce la mise à jour, mais on ne consomme
//     ~100 Mo de bande passante que si l'utilisateur l'accepte ;
//   - une vérification qui échoue hors ligne ne remonte aucune erreur à
//     l'écran ; seule une vérification déclenchée manuellement le fait ;
//   - l'installation se fait à la fermeture de l'app, ou immédiatement si
//     l'utilisateur clique « Redémarrer maintenant ».

export type UpdateState =
  | { status: 'idle' }
  | { status: 'unsupported'; reason: string }
  | { status: 'checking' }
  | { status: 'up-to-date'; checkedAt: number }
  | { status: 'available'; version: string; releaseDate?: string }
  | {
      status: 'downloading'
      version: string
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

const SIX_HOURS = 6 * 60 * 60 * 1000
const FIRST_CHECK_DELAY = 30_000

let state: UpdateState = { status: 'idle' }
let unsupportedReason: string | null = null
let timer: NodeJS.Timeout | null = null

function setState(next: UpdateState): void {
  state = next
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:state', state)
  }
}

// Message d'erreur exploitable par un directeur d'école, pas une stack trace.
function humanize(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|net::/i.test(raw)) {
    return "Serveur de mise à jour injoignable — vérifiez la connexion Internet."
  }
  if (/404/.test(raw)) {
    return "Aucune mise à jour publiée sur le serveur pour le moment."
  }
  if (/sha512|checksum|signature/i.test(raw)) {
    return "Le fichier téléchargé est corrompu ou n'a pas pu être vérifié. Réessayez plus tard."
  }
  // Dernier recours : le message brut, mais jamais l'adresse du dépôt de
  // mises à jour qu'electron-updater y glisse volontiers. (Le processus
  // principal ne peut pas importer lib/redact.ts, hors de son tsconfig.)
  return raw
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)]+/gi, 'le serveur')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/g, 'le serveur')
}

// Contextes où electron-updater ne peut rien faire d'utile. On le détecte une
// fois pour toutes, pour afficher une explication plutôt qu'une erreur brute.
function detectUnsupported(): string | null {
  if (!app.isPackaged) {
    return "Mise à jour indisponible en développement."
  }
  // La version « portable » est un exe unique lancé depuis une clé USB : il
  // n'y a pas d'installation à remplacer.
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return "Version portable : téléchargez manuellement la nouvelle version."
  }
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    return "Mise à jour automatique disponible uniquement via l'AppImage."
  }
  return null
}

export function getUpdateState(): UpdateState {
  return state
}

export async function checkForUpdates(manual: boolean): Promise<UpdateState> {
  if (unsupportedReason) return state
  // Une vérification pendant un téléchargement en cours le ferait repartir
  // de zéro ; une mise à jour déjà prête n'a plus rien à chercher.
  if (state.status === 'downloading' || state.status === 'downloaded') return state

  setState({ status: 'checking' })
  try {
    const result = await autoUpdater.checkForUpdates()
    // `update-available` a déjà posé l'état ; s'il ne s'est pas déclenché,
    // c'est qu'on est à jour.
    if (!result?.updateInfo || state.status === 'checking') {
      setState({ status: 'up-to-date', checkedAt: Date.now() })
    }
  } catch (error) {
    // Hors ligne, la vérification périodique échoue en permanence : la
    // signaler à l'écran affolerait pour rien une app conçue pour tourner
    // sans réseau. On ne parle que si l'utilisateur a lui-même demandé.
    setState(manual ? { status: 'error', message: humanize(error) } : { status: 'idle' })
  }
  return state
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (state.status !== 'available') return state
  const version = state.version
  setState({ status: 'downloading', version, percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 })
  try {
    await autoUpdater.downloadUpdate()
    // `update-downloaded` pose l'état final ; ce filet couvre le cas où
    // l'événement n'arriverait pas. On relit par getUpdateState() : TypeScript
    // garde `state` figé sur la variante « available » narrowée plus haut et
    // rejetterait la comparaison directe.
    if (getUpdateState().status === 'downloading') setState({ status: 'downloaded', version })
  } catch (error) {
    setState({ status: 'error', message: humanize(error) })
  }
  return state
}

export function installUpdate(): void {
  if (state.status !== 'downloaded') return
  // `isSilent = false` : l'installateur NSIS s'affiche (l'utilisateur voit ce
  // qui se passe). `isForceRunAfter = true` : l'app redémarre toute seule.
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
}

export function setupUpdater(): void {
  unsupportedReason = detectUnsupported()
  if (unsupportedReason) {
    state = { status: 'unsupported', reason: unsupportedReason }
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m: unknown) => console.log('[updater]', m),
    warn: (m: unknown) => console.warn('[updater]', m),
    error: (m: unknown) => console.error('[updater]', m),
    debug: () => {},
  }

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({ status: 'available', version: info.version, releaseDate: info.releaseDate })
  })

  autoUpdater.on('update-not-available', () => {
    if (state.status === 'checking') setState({ status: 'up-to-date', checkedAt: Date.now() })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    if (state.status !== 'downloading') return
    setState({
      status: 'downloading',
      version: state.version,
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({ status: 'downloaded', version: info.version })
  })

  // Journalisé seulement : l'état visible est piloté par les promesses de
  // checkForUpdates / downloadUpdate, qui savent si l'action était manuelle.
  autoUpdater.on('error', (error) => console.error('[updater]', error))

  // Pas au démarrage : les premières secondes servent à ouvrir la fenêtre et
  // à lancer la synchronisation, qui priment sur la recherche de mise à jour.
  setTimeout(() => void checkForUpdates(false), FIRST_CHECK_DELAY)
  timer = setInterval(() => void checkForUpdates(false), SIX_HOURS)
}

export function teardownUpdater(): void {
  if (timer) clearInterval(timer)
  timer = null
}
