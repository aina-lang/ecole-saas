import { app, shell, BrowserWindow, ipcMain, protocol, session, dialog, Menu } from 'electron'
import { join, extname, dirname, resolve, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync, promises as fsPromises } from 'fs'
import { getSetting, setSetting, getAllSettings } from './settings'
import { saveFileLocally, getFileUploadCount, getFileUploadByEntity } from './files'
import { setAuthToken, getAuthToken } from './auth'
import {
  setupUpdater,
  teardownUpdater,
  getUpdateState,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
} from './updater'
import { getDeviceId } from './device'

let mainWindow: BrowserWindow | null = null

/** Console de développement autorisée : en développement seulement. */
const DEVTOOLS_ALLOWED = is.dev

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { roundedCorners: true } : {}),
    title: 'Sekoliko — Gestion scolaire',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Hors développement, openDevTools() devient sans effet : aucun
      // raccourci, menu ou appel de code ne peut ouvrir la console.
      devTools: DEVTOOLS_ALLOWED,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Liens tel: / mailto: / https: cliqués dans la page : ouverts par le
  // système (téléphone, client mail, navigateur) au lieu de naviguer dans
  // la fenêtre de l'app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/^(tel|mailto|https?):/i.test(url) && !url.startsWith('http://localhost')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const LOCAL_PROTOCOL = 'local-asset'

function registerLocalProtocol() {
  protocol.handle(LOCAL_PROTOCOL, (request) => {
    const filePath = decodeURIComponent(request.url.slice(`${LOCAL_PROTOCOL}://`.length))
    if (existsSync(filePath)) {
      const ext = extname(filePath).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf', '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      return new Response(readFileSync(filePath), {
        headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' },
      })
    }
    return new Response('Not found', { status: 404 })
  })
}

// État de l'horloge de confiance (cliquet, décalage serveur, cache licence).
// Deux copies hors du profil Chromium : vider les données du site ne les
// touche pas ; au chargement on renvoie la plus avancée des deux.
function clockStatePaths(): string[] {
  return [
    join(app.getPath('userData'), 'clock-state.json'),
    join(app.getPath('home'), '.ecole-saas', 'clock-state.json'),
  ]
}

function loadClockState(): Record<string, any> | null {
  // Lecture d'abord, fusion ensuite : accumuler dans une variable qui commence
  // à `null` faisait réduire son type à `never` par TypeScript au fil des
  // branches, et la fusion ne compilait plus.
  const states: Record<string, any>[] = []
  for (const p of clockStatePaths()) {
    try {
      if (!existsSync(p)) continue
      states.push(JSON.parse(readFileSync(p, 'utf8')))
    } catch { /* fichier corrompu : ignoré */ }
  }
  if (states.length === 0) return null

  // On retient la copie la plus avancée (cliquet le plus haut), mais on fusionne
  // les `durable` des deux : une copie en retard peut porter une clé que
  // l'autre n'a pas, et le gagnant garde la priorité en cas de conflit.
  let best: Record<string, any> = { ...states[0], durable: { ...(states[0].durable ?? {}) } }
  for (const parsed of states.slice(1)) {
    best = (parsed.ratchet ?? 0) > (best.ratchet ?? 0)
      ? { ...best, ...parsed, durable: { ...(best.durable ?? {}), ...(parsed.durable ?? {}) } }
      : { ...best, durable: { ...(parsed.durable ?? {}), ...(best.durable ?? {}) } }
  }
  return best
}

function saveClockState(state: Record<string, any>): void {
  const existing = loadClockState()
  // Jamais de retour en arrière, même si le renderer envoie un état plus vieux.
  const merged = existing && (existing.ratchet ?? 0) > (state.ratchet ?? 0)
    ? { ...state, ratchet: existing.ratchet }
    : state
  const payload = JSON.stringify(merged)
  for (const p of clockStatePaths()) {
    try {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, payload, 'utf8')
    } catch { /* disque en lecture seule : l'autre copie suffit */ }
  }
}

function setupIPC() {
  ipcMain.handle('clock:load', async () => loadClockState())
  ipcMain.handle('clock:save', async (_event, state) => {
    if (state && typeof state === 'object') saveClockState(state)
    return { success: true }
  })

  ipcMain.handle('local:get-setting', async (_event, key) => {
    return getSetting(key)
  })

  ipcMain.handle('local:set-setting', async (_event, key, value) => {
    setSetting(key, value)
    return { success: true }
  })

  ipcMain.handle('local:get-all-settings', async () => {
    return getAllSettings()
  })

  ipcMain.handle('db:sync', async (_event, entityType, remoteUrl) => {
    return { ok: true, entityType, remoteUrl }
  })

  ipcMain.handle('auth:set-token', async (_event, token) => {
    setAuthToken(token)
    return { success: true }
  })

  ipcMain.handle('auth:get-token', async () => {
    return getAuthToken()
  })

  ipcMain.handle('file:save', async (_event, { buffer, entityType, entityId, fieldName, originalName, mimeType }) => {
    return saveFileLocally(Buffer.from(buffer), entityType, entityId, fieldName, originalName, mimeType)
  })

  ipcMain.handle('file:get-url', async (_event, localPath) => {
    if (!localPath || !existsSync(localPath)) return null
    return `${LOCAL_PROTOCOL}://${localPath}`
  })

  // Mémo des encodages base64 : le même avatar est demandé par chaque ligne
  // de liste à chaque rendu — sans cache, une lecture disque + encodage par
  // demande. Invalidé par mtime (photo remplacée = fichier réécrit).
  const dataUrlCache = new Map<string, { mtimeMs: number; dataUrl: string }>()

  ipcMain.handle('file:get-data-url', async (_event, localPath) => {
    if (!localPath || typeof localPath !== 'string') return null
    // Confinement : ce canal ne sert qu'aux fichiers écrits par l'app dans
    // userData (uploads, logo). Sans cette borne, n'importe quel code du
    // renderer pourrait exfiltrer un fichier arbitraire du disque en base64.
    const allowedRoot = app.getPath('userData')
    const resolved = resolve(localPath)
    if (!resolved.startsWith(allowedRoot + sep) && resolved !== allowedRoot) return null
    try {
      // Lecture asynchrone : readFileSync bloquait le process main (fenêtre,
      // menus, tous les IPC) à chaque avatar affiché.
      const stat = await fsPromises.stat(resolved)
      const cached = dataUrlCache.get(resolved)
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached.dataUrl
      const buffer = await fsPromises.readFile(resolved)
      const ext = extname(resolved).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      }
      const mime = mimeMap[ext] || 'application/octet-stream'
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
      dataUrlCache.set(resolved, { mtimeMs: stat.mtimeMs, dataUrl })
      return dataUrl
    } catch {
      return null
    }
  })

  ipcMain.handle('file:get-pending-count', async () => {
    return getFileUploadCount()
  })

  ipcMain.handle('file:get-entity-photo', async (_event, entityType, entityId) => {
    const entry = getFileUploadByEntity(entityType, entityId, 'photo_url')
    if (entry?.local_path && existsSync(entry.local_path)) {
      return `${LOCAL_PROTOCOL}://${entry.local_path}`
    }
    return null
  })

  ipcMain.handle('db:reset', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.executeJavaScript('window.resetLocalDatabases()')
      }
      const uploadDir = join(app.getPath('userData'), 'uploads')
      if (existsSync(uploadDir)) {
        rmSync(uploadDir, { recursive: true, force: true })
        mkdirSync(uploadDir, { recursive: true })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('documents:print', async (_event, { html, defaultName }: { html: string; defaultName: string }) => {
    const pdfWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { contextIsolation: true, nodeIntegration: false, devTools: DEVTOOLS_ALLOWED },
    })

    try {
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      await pdfWindow.loadURL(dataUrl)
      await new Promise((r) => setTimeout(r, 800))

      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: defaultName.replace(/[^\w\-\. ]/g, '_'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) return { canceled: true }

      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, pdfBuffer)
      shell.openPath(filePath)
      return { canceled: false, filePath }
    } finally {
      if (!pdfWindow.isDestroyed()) pdfWindow.destroy()
    }
  })

  // Enregistrement générique d'un export (docx, xlsx...) : dialogue, écriture,
  // puis ouverture dans l'application associée — même parcours que le PDF.
  ipcMain.handle('documents:save-file', async (_event, { buffer, defaultName, filterName, extension }:
    { buffer: ArrayBuffer; defaultName: string; filterName: string; extension: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName.replace(/[^\w\-\. ]/g, '_'),
      filters: [{ name: filterName, extensions: [extension] }],
    })
    if (canceled || !filePath) return { canceled: true }
    const dir = dirname(filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, Buffer.from(buffer))
    shell.openPath(filePath)
    return { canceled: false, filePath }
  })

  ipcMain.handle('window:is-maximized', async () => mainWindow?.isMaximized() ?? false)

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })

  // Mise à jour automatique. Le renderer peut se monter après l'annonce d'une
  // mise à jour : `updates:get-state` lui donne l'état courant, puis il suit
  // les changements via l'événement `updates:state`.
  // Empreinte de la machine, exigée par le serveur à la création d'un
  // établissement (un seul essai gratuit par ordinateur).
  ipcMain.handle('device:id', async () => getDeviceId())

  ipcMain.handle('updates:get-state', async () => getUpdateState())
  ipcMain.handle('updates:check', async () => checkForUpdates(true))
  ipcMain.handle('updates:download', async () => downloadUpdate())
  ipcMain.handle('updates:install', async () => {
    installUpdate()
    return { success: true }
  })
}

// Locale française pour Chromium : les <input type="date"> s'affichent en
// jj/mm/aaaa (sinon la locale système, souvent en-US → mm/dd/yyyy).
app.commandLine.appendSwitch('lang', 'fr-FR')
// Chromium limite à 6 connexions simultanées par hôte. Or la synchronisation
// tient ~21 requêtes « longpoll » ouvertes en permanence vers CouchDB (une
// par base) : toute autre requête vers ce serveur attendait derrière — synchro
// manuelle en « délai dépassé », passes de fond bloquées, lenteur générale.
// On lève la limite pour le serveur de synchro (et localhost en développement).
app.commandLine.appendSwitch('ignore-connections-limit', '51.178.50.63,localhost,127.0.0.1')

// ─── Verrouillage de la console de développement (production) ──────────────
// La console Chromium donne la main sur tout ce que l'app protège : lecture
// du localStorage (jetons de session, cache de licence), appels à l'API avec
// la session ouverte, contournement de la lecture seule d'une licence expirée.
// Elle reste disponible en développement uniquement.
//
// Quatre verrous, chacun couvrant une porte différente :
//   1. `devTools: false` sur chaque fenêtre — le verrou de fond ;
//   2. suppression du menu par défaut d'Electron, dont l'accélérateur
//      Ctrl+Maj+I fonctionne même quand la barre de menu est masquée ;
//   3. interception clavier de F12 et Ctrl+Maj+I/J/C (Cmd+Alt+I/J/C sur Mac) ;
//   4. refus de démarrer avec --remote-debugging-port/-pipe, qui ouvrirait la
//      page à un client DevTools externe sans aucun raccourci.
if (!DEVTOOLS_ALLOWED) {
  if (app.commandLine.hasSwitch('remote-debugging-port') || app.commandLine.hasSwitch('remote-debugging-pipe')) {
    // Avant 'ready' : aucune fenêtre n'a encore été créée, il n'y a rien à inspecter.
    process.exit(1)
  }
}

/** Raccourcis qui ouvrent la console Chromium. */
function isDevToolsShortcut(input: Electron.Input): boolean {
  if (input.type !== 'keyDown') return false
  if (input.code === 'F12') return true
  // Code physique ET caractère : couvre aussi bien QWERTY qu'AZERTY.
  const inspect =
    ['KeyI', 'KeyJ', 'KeyC'].includes(input.code) || ['i', 'j', 'c'].includes(input.key.toLowerCase())
  if (!inspect) return false
  return (input.control && input.shift) || (input.meta && input.alt)
}

app.on('web-contents-created', (_event, contents) => {
  if (DEVTOOLS_ALLOWED) return
  contents.on('before-input-event', (event, input) => {
    if (isDevToolsShortcut(input)) event.preventDefault()
  })
  // Filet de sécurité : si une console s'ouvrait malgré tout, on la referme.
  contents.on('devtools-opened', () => contents.closeDevTools())
})

app.whenReady().then(async () => {
  // Doit être identique à l'`appId` d'electron-builder : c'est cette valeur qui
  // relie la fenêtre à son raccourci Windows (icône de la barre des tâches,
  // épinglage, notifications).
  electronApp.setAppUserModelId('mg.sekoliko.desktop')

  // Sans menu, plus d'accélérateurs par défaut (Ctrl+Maj+I, rechargement,
  // zoom). Les raccourcis d'édition — copier, coller, annuler — sont gérés
  // par Chromium lui-même sous Windows et continuent de fonctionner.
  if (!DEVTOOLS_ALLOWED) Menu.setApplicationMenu(null)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIPC()
  registerLocalProtocol()
  setupUpdater()

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspHeader = details.responseHeaders?.['content-security-policy']
    const csp = Array.isArray(cspHeader) ? cspHeader[0] : cspHeader
    if (csp) {
      let fixed = csp
      if (!csp.includes('local-asset:')) {
        fixed = fixed.replace(/img-src[^;]*/, '$& local-asset: http://localhost:3000 http://51.178.50.63:3000')
      }
      if (!csp.includes('51.178.50.63:5984')) {
        fixed = fixed.replace(/connect-src[^;]*/, '$& http://51.178.50.63:3000 http://51.178.50.63:5984')
      }
      if (fixed !== csp) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'content-security-policy': [fixed],
          },
        })
        return
      }
    }
    callback({ responseHeaders: details.responseHeaders })
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  teardownUpdater()
})
