import { create } from 'zustand'
import client, { UNAUTHORIZED_EVENT } from '../api/client'
import { setCurrentTenant } from '../lib/db/pouchdb'
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

      set({
        user,
        accessToken,
        refreshToken,
        tenantId: resolvedTenantId,
        isAuthenticated: true,
        lockedSession: null,
        onboardingCompleted: readOnboardingCompleted(resolvedTenantId),
      })
      persistUser(user)

      if (typeof window !== 'undefined' && (window as any).api?.auth?.setToken) {
        ;(window as any).api.auth.setToken(accessToken).catch(() => {})
      }
    } catch (err: any) {
      if (!navigator.onLine || err?.code === 'ERR_NETWORK') {
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
          onboardingCompleted: readOnboardingCompleted(session.tenantId),
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
      lockedSession: current
        ? { email: current.email, firstName: current.firstName, lastName: current.lastName, tenantId: current.tenantId }
        : get().lockedSession,
    })
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  },

  register: async (payload: RegisterPayload) => {
    await client.post('/auth/register', {
      ...payload,
      adminEmail: payload.adminEmail.trim().toLowerCase()
    })
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
    localStorage.setItem(onboardingKey(get().tenantId), 'true')
    set({ onboardingCompleted: true })
  }
}))
