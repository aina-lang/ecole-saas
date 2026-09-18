import { create } from 'zustand'
import client, { UNAUTHORIZED_EVENT, isOfflineError } from '../api/client'
import { setCurrentTenant, getDocument, createDatabase } from '../lib/db/pouchdb'
import { stopAllSyncs } from '../lib/db/sync-manager'
import {
  saveSession,
  getSession,
  saveLocalPasswordVerifier,
  verifyLocalPassword,
} from '../lib/db/pouchdb-auth'
import { setTokens, clearTokens as clearTokenCache, setTenantId } from '../lib/db/token-cache'

// Le type complet de window.api est déclaré globalement dans preload/index.d.ts
// (Api). Le redéclarer ici en plus étroit écrasait ce type partout ailleurs
// dans le projet (window.api.settings, .file, etc. devenaient "inexistants").

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  isActive: boolean
  photoUrl?: string | null
  /** Mot de passe temporaire remis par le support : le routeur impose son
   *  changement avant tout accès. Renvoyé par /auth/login (auth.service.ts). */
  mustChangePassword?: boolean
}

interface RegisterPayload {
  schoolName: string
  adminEmail: string
  adminFirstName: string
  adminLastName: string
  adminPassword: string
}

/** Identité d'une session locale verrouillée : affichable (écran de déverrouillage) mais sans accès. */
interface LockedSession {
  email: string
  firstName: string
  lastName: string
  tenantId: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  tenantId: string | null
  isAuthenticated: boolean
  onboardingCompleted: boolean
  hydrated: boolean
  lockedSession: LockedSession | null
  /** Ce poste est déjà rattaché à un établissement : la création d'un autre
   *  n'y est plus proposée (un seul essai gratuit par ordinateur). */
  deviceLinked: boolean
  /** Écran de verrouillage : laisse un collègue se connecter avec son propre
   *  compte, sans toucher à la session locale. */
  forgetLockedSession: () => void
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  setUser: (user: User) => void
  completeOnboarding: () => void
  hydrate: () => Promise<void>
}

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem('auth-user', JSON.stringify({ id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim(), email: user.email }))
  } else {
    localStorage.removeItem('auth-user')
  }
}

// L'onboarding est terminé PAR TENANT, pas globalement pour le poste : sans ça,
// une fois qu'un premier compte a fini l'onboarding sur cette machine, tous les
// comptes suivants (nouvelle inscription, autre école) le sautaient — le flag
// legacy non scopé 'onboardingCompleted' restait vrai pour tout le monde.
function onboardingKey(tenantId: string | null | undefined): string {
  return tenantId ? `onboardingCompleted_${tenantId}` : 'onboardingCompleted'
}

function readOnboardingCompleted(tenantId: string | null | undefined): boolean {
  return localStorage.getItem(onboardingKey(tenantId)) === 'true'
}

function markOnboardingCompleted(tenantId: string | null | undefined): void {
  localStorage.setItem(onboardingKey(tenantId), 'true')
}

// Bloquer le login sur une requête réseau serait contraire au principe de
// l'app. Ce plafond garde la question « établissement déjà configuré ? »
// bornée dans le temps : le client axios n'a pas de timeout global (défaut
// axios = infini), donc un serveur joignable mais muet — portail captif,
// perte de paquets, VPS saturé — ferait attendre l'écran de connexion
// indéfiniment, alors qu'on a une réponse locale acceptable.
const SETUP_STATE_TIMEOUT_MS = 8000

// « L'établissement est-il déjà configuré ? » — trois sources, de la plus
// locale à la plus distante, parce que le drapeau localStorage seul ne suffit
// pas : il vit sur le poste, il est donc absent d'une installation neuve,
// d'un poste réinitialisé ou du deuxième ordinateur de l'école, et
// l'assistant de configuration se rouvrait devant des écoles en service
// depuis des mois.
//
//   1. le drapeau local            — instantané, hors ligne ;
//   2. les données répliquées      — instantané, hors ligne : dès que la
//      synchronisation a tourné une fois, les réglages posés par l'assistant
//      — ou des classes et élèves déjà saisis — sont dans PouchDB ;
//   3. le serveur                  — seulement si les deux premières sont
//      muettes, c'est-à-dire en pratique à la toute première connexion sur
//      un poste neuf, qui se fait forcément en ligne.
async function resolveOnboardingCompleted(tenantId: string | null | undefined): Promise<boolean> {
  if (readOnboardingCompleted(tenantId)) return true

  if (await hasReplicatedSchoolConfig()) {
    markOnboardingCompleted(tenantId)
    return true
  }

  try {
    const { data } = await client.get<{ configured: boolean }>('/tenants/me/setup-state', {
      timeout: SETUP_STATE_TIMEOUT_MS,
    })
    if (data?.configured) {
      markOnboardingCompleted(tenantId)
      return true
    }
  } catch {
    // Hors ligne, serveur lent, ou serveur pas encore à jour (route absente) :
    // on retombe sur le comportement d'avant. Au pire l'assistant s'affiche
    // une fois de trop — il est idempotent, il réutilise l'année scolaire déjà
    // répliquée au lieu d'en créer une seconde.
  }
  return false
}

// Lecture purement locale (IndexedDB), sans réseau et sans moteur de synchro
// démarré : createDatabase() ouvre la base du tenant courant, que
// setCurrentTenant() vient de positionner. On cherche exactement ce que
// l'assistant écrit à la fin — voir OnboardingPage.handleFinish.
async function hasReplicatedSchoolConfig(): Promise<boolean> {
  try {
    const [periodSystem, academicYear] = await Promise.all([
      getDocument('TenantSetting', 'period_system'),
      getDocument('TenantSetting', 'academic_year'),
    ])
    if (periodSystem || academicYear) return true
    // Une année scolaire ne prouve rien : l'inscription en crée une d'office.
    // Des classes ou des élèves, si : l'établissement est déjà en service.
    const [classes, students] = await Promise.all([
      createDatabase('Class').info(),
      createDatabase('Student').info(),
    ])
    return classes.doc_count > 0 || students.doc_count > 0
  } catch {
    // Bases absentes ou illisibles : on laisse la question au serveur.
    return false
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  tenantId: null,
  isAuthenticated: false,
  // Valeur par défaut sûre avant tout login — recalculée par tenant dans
  // login() (voir readOnboardingCompleted), jamais lue depuis l'ancien flag
  // global.
  onboardingCompleted: false,
  hydrated: false,
  lockedSession: null,
  deviceLinked: false,

  // Volontairement, une session locale trouvée au démarrage NE reconnecte PAS
  // automatiquement l'utilisateur : sur un poste partagé entre collègues, rouvrir
  // l'app ne doit pas suffire à contourner le verrouillage. Elle sert seulement
  // à préremplir l'écran de déverrouillage (email/nom) ; il faut retaper le mot
  // de passe, vérifié via login() (en ligne contre le serveur, ou hors ligne
  // contre l'empreinte locale — voir verifyLocalPassword).
  hydrate: async () => {
    const session = await getSession()
    if (session) {
      set({
        lockedSession: {
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          tenantId: session.tenantId,
        },
        deviceLinked: true,
        hydrated: true,
      })
    } else {
      set({ hydrated: true })
    }
  },

  login: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    try {
      const { data } = await client.post('/auth/login', {
        email: normalizedEmail,
        password
      })

      if (!data?.accessToken) {
        throw new Error('Réponse du serveur invalide')
      }

      const { user, accessToken, refreshToken, tenantId } = data
      const resolvedTenantId = tenantId ?? user?.tenantId

      setCurrentTenant(resolvedTenantId)
      setTenantId(resolvedTenantId)
      setTokens(accessToken, refreshToken)

      await saveSession({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: resolvedTenantId,
        accessToken,
        refreshToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      // Empreinte locale du mot de passe : seul moyen de déverrouiller l'app hors ligne ensuite.
      await saveLocalPasswordVerifier(normalizedEmail, password, resolvedTenantId)

      // Résolu AVANT de passer isAuthenticated à true : le routeur redirige dès
      // cet instant, et une réponse tardive ferait clignoter l'assistant de
      // configuration devant un établissement déjà en service.
      const onboardingCompleted = await resolveOnboardingCompleted(resolvedTenantId)

      set({
        user,
        accessToken,
        refreshToken,
        tenantId: resolvedTenantId,
        isAuthenticated: true,
        lockedSession: null,
        onboardingCompleted,
      })
      persistUser(user)

      if (typeof window !== 'undefined' && (window as any).api?.auth?.setToken) {
        ;(window as any).api.auth.setToken(accessToken).catch(() => {})
      }
    } catch (err: any) {
      // isOfflineError couvre aussi le délai dépassé : depuis que le client
      // porte un timeout, un serveur muet produit ECONNABORTED et non
      // ERR_NETWORK — sans ça, l'utilisateur voyait une erreur brute au lieu
      // de basculer sur le déverrouillage hors ligne.
      if (isOfflineError(err)) {
        const session = await getSession()
        if (!session || session.email !== normalizedEmail) {
          throw new Error('Aucune session locale trouvée. Connectez-vous en ligne d\'abord.')
        }
        // Déverrouillage hors ligne : le mot de passe DOIT être vérifié contre
        // l'empreinte locale — une simple correspondance d'email ne suffit pas
        // (sinon n'importe qui devine l'email et rentre avec un mot de passe
        // quelconque). Si aucune empreinte n'a jamais été enregistrée (compte
        // jamais connecté sur ce poste depuis ce correctif), on refuse : fail-closed.
        const passwordValid = await verifyLocalPassword(normalizedEmail, password)
        if (!passwordValid) {
          throw new Error('Mot de passe incorrect.')
        }
        setCurrentTenant(session.tenantId)
        setTenantId(session.tenantId)
        setTokens(session.accessToken, session.refreshToken)
        set({
          user: {
            id: session.userId,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
            role: session.role,
            tenantId: session.tenantId,
            isActive: true,
          },
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          tenantId: session.tenantId,
          isAuthenticated: true,
          lockedSession: null,
          // Déverrouillage hors ligne : uniquement les deux sources locales,
          // jamais le serveur.
          onboardingCompleted:
            readOnboardingCompleted(session.tenantId) || (await hasReplicatedSchoolConfig()),
        })
        persistUser(get().user)
        return
      }
      throw err
    }
  },

  // Verrouille l'app (utile entre collègues sur un poste partagé) : coupe l'accès
  // aux données et à la sync immédiatement, mais NE détruit PAS la session/l'empreinte
  // locale du mot de passe — sinon un déverrouillage hors ligne deviendrait impossible.
  // Le même utilisateur peut se reconnecter via login(), en ligne ou hors ligne,
  // en retapant son (vrai) mot de passe.
  logout: () => {
    const current = get().user
    stopAllSyncs()
    clearTokenCache()
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      isAuthenticated: false,
      deviceLinked: true,
      lockedSession: current
        ? { email: current.email, firstName: current.firstName, lastName: current.lastName, tenantId: current.tenantId }
        : get().lockedSession,
    })
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  },

  register: async (payload: RegisterPayload) => {
    // Empreinte de la machine : le serveur n'ouvre qu'un essai gratuit par
    // ordinateur, et refuse une création sans elle.
    const deviceId = await window.api?.device?.id().catch(() => undefined)
    await client.post('/auth/register', {
      ...payload,
      adminEmail: payload.adminEmail.trim().toLowerCase(),
      deviceId,
    })
  },

  forgetLockedSession: () => {
    // La session locale (empreinte du mot de passe, déverrouillage hors
    // ligne) est conservée : on ne fait que libérer l'écran de connexion.
    set({ lockedSession: null, deviceLinked: true })
  },

  refreshAuth: async () => {
    const { refreshToken } = get()
    if (!refreshToken) {
      return
    }

    try {
      const { data } = await client.post('/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken, user } = data

      if (user?.tenantId) {
        setCurrentTenant(user.tenantId)
        setTenantId(user.tenantId)
      }

      setTokens(accessToken, newRefreshToken)

      const session = await getSession()
      if (session) {
        await saveSession({ ...session, accessToken, refreshToken: newRefreshToken, updatedAt: new Date().toISOString() })
      }

      set({
        user,
        accessToken,
        refreshToken: newRefreshToken,
        isAuthenticated: true,
      })

      if (typeof window !== 'undefined' && (window as any).api?.auth?.setToken) {
        ;(window as any).api.auth.setToken(accessToken).catch(() => {})
      }
    } catch {
      // Échec du refresh — ne pas déconnecter, les tokens seront réessayés
    }
  },

  setUser: (user: User) => {
    set({ user })
  },

  completeOnboarding: () => {
    markOnboardingCompleted(get().tenantId)
    set({ onboardingCompleted: true })
  }
}))
