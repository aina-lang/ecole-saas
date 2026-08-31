// Horloge de confiance + petit stockage durable.
//
// Problème : l'horloge système est sous le contrôle de l'utilisateur, et
// localStorage se vide en un clic. Or deux choses en dépendent :
//   - l'expiration de la licence hors ligne (lecture seule le jour J) ;
//   - les tampons createdAt/updatedAt qui départagent les conflits de synchro
//     (dernière écriture gagnante) — une horloge fausse corrompt la fusion.
//
// Réponse en trois couches, toutes locales (aucun réseau requis après le
// premier contact) :
//   1. ANCRE SERVEUR — chaque réponse HTTP porte X-Server-Time ; on mémorise
//      le décalage (serveur − local). Le « maintenant » utilisé partout est
//      l'heure locale CORRIGÉE de ce décalage, donc une horloge reculée avant
//      la première utilisation est neutralisée dès le premier appel.
//   2. CLIQUET MONOTONE — on mémorise le dernier instant légitime observé et
//      on y ajoute le temps monotone écoulé depuis (performance.now(), que
//      l'utilisateur ne peut pas reculer). Figer ou reculer l'horloge en cours
//      de session ne rend donc aucun temps.
//   3. STOCKAGE DURABLE — l'état (cliquet, décalage, cache licence) est écrit
//      dans localStorage ET, via le processus principal Electron, dans deux
//      fichiers hors du profil du navigateur. Vider localStorage ne suffit
//      plus ; au chargement on prend le cliquet le plus avancé des trois.

interface ClockState {
  /** Dernier instant légitime connu (ms epoch, heure serveur si connue). */
  ratchet: number
  /** serveur − Date.now() en ms, null tant qu'aucun serveur n'a été vu. */
  serverOffset: number | null
  /** Quand serverOffset a été appris (ms epoch), pour départager les sources. */
  anchoredAt: number
  /** Petites valeurs durables (cache licence par établissement…). */
  durable: Record<string, unknown>
}

const LS_KEY = 'trusted_clock_state'
const state: ClockState = { ratchet: 0, serverOffset: null, anchoredAt: 0, durable: {} }
let perfAtRatchet = performance.now()
let ready = false

type DurableApi = { load: () => Promise<Partial<ClockState> | null>; save: (s: ClockState) => Promise<unknown> }
function durableApi(): DurableApi | null {
  return (window as any).api?.clock ?? null
}

function mergeInto(src: Partial<ClockState> | null | undefined): void {
  if (!src) return
  if (typeof src.ratchet === 'number' && src.ratchet > state.ratchet) {
    state.ratchet = src.ratchet
    perfAtRatchet = performance.now()
  }
  if (typeof src.serverOffset === 'number' && (src.anchoredAt ?? 0) >= state.anchoredAt) {
    state.serverOffset = src.serverOffset
    state.anchoredAt = src.anchoredAt ?? 0
  }
  if (src.durable && typeof src.durable === 'object') {
    state.durable = { ...src.durable, ...state.durable }
  }
}

function readLocalStorage(): Partial<ClockState> | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Partial<ClockState>) : null
  } catch {
    return null
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persist(): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* quota / privé */ }
  // Écriture fichier regroupée (pas un IPC par frappe).
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    durableApi()?.save({ ...state }).catch(() => { /* hors Electron */ })
  }, 250)
}

/** À appeler une fois au démarrage du renderer (avant le premier rendu utile). */
export async function initTrustedClock(): Promise<void> {
  mergeInto(readLocalStorage())
  try {
    mergeInto(await durableApi()?.load())
  } catch { /* hors Electron : localStorage seul */ }
  ready = true
  bumpRatchet()
}

/** Heure locale corrigée du décalage serveur (sans cliquet). */
function correctedWallClock(): number {
  return Date.now() + (state.serverOffset ?? 0)
}

/** Le « maintenant » de confiance : jamais antérieur au dernier instant
 * légitime + temps monotone écoulé, et corrigé du décalage serveur. */
export function trustedNow(): number {
  const monotonic = state.ratchet + (performance.now() - perfAtRatchet)
  return Math.max(correctedWallClock(), monotonic)
}

export function trustedNowIso(): string {
  return new Date(trustedNow()).toISOString()
}

/** Fait avancer le cliquet jusqu'au « maintenant » de confiance. */
export function bumpRatchet(): void {
  const now = trustedNow()
  if (now > state.ratchet) {
    state.ratchet = now
    perfAtRatchet = performance.now()
    persist()
  }
}

/** Appelé par le client HTTP à chaque réponse portant X-Server-Time. */
export function learnServerTime(serverMs: number): void {
  if (!Number.isFinite(serverMs) || serverMs < 1_600_000_000_000) return
  state.serverOffset = serverMs - Date.now()
  state.anchoredAt = serverMs
  if (serverMs > state.ratchet) {
    state.ratchet = serverMs
    perfAtRatchet = performance.now()
  }
  persist()
}

/** Décalage horloge locale vs serveur (ms, positif = PC en retard). null si inconnu. */
export function clockSkewMs(): number | null {
  return state.serverOffset
}

export function hasServerAnchor(): boolean {
  return state.serverOffset !== null
}

export function getDurable<T = unknown>(key: string): T | undefined {
  if (!ready) mergeInto(readLocalStorage())
  return state.durable[key] as T | undefined
}

export function setDurable(key: string, value: unknown): void {
  state.durable[key] = value
  persist()
}

export function removeDurable(key: string): void {
  delete state.durable[key]
  persist()
}
