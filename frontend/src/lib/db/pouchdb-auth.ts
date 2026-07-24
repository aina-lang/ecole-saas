import PouchDB from 'pouchdb'

const AUTH_DB_NAME = 'ecole_saas_auth'

let db: PouchDB.Database | null = null

function getDb(): PouchDB.Database {
  if (!db) {
    db = new PouchDB(AUTH_DB_NAME, { adapter: 'idb' })
  }
  return db
}

export interface AuthSession {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  accessToken: string
  refreshToken: string
  createdAt: string
  updatedAt: string
}

export interface StoredCredentials {
  email: string
  /** Vérificateur PBKDF2 local — dérivé du mot de passe, jamais le hash serveur (bcrypt). */
  passwordHash: string
  salt: string
  tenantId: string
}

const SESSION_ID = '_local/session'
const CREDENTIALS_ID = '_local/credentials'

export async function saveSession(session: AuthSession): Promise<void> {
  const database = getDb()
  try {
    const existing = await database.get(SESSION_ID)
    await database.put({ ...existing, ...session, _id: SESSION_ID })
  } catch {
    await database.put({ ...session, _id: SESSION_ID })
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const database = getDb()
  try {
    const doc = await database.get(SESSION_ID)
    const { _id, _rev, ...session } = doc as any
    return session as AuthSession
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const database = getDb()
  try {
    const doc = await database.get(SESSION_ID)
    await database.remove(doc)
  } catch {
  }
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  const database = getDb()
  try {
    const existing = await database.get(CREDENTIALS_ID)
    await database.put({ ...existing, ...creds, _id: CREDENTIALS_ID })
  } catch {
    await database.put({ ...creds, _id: CREDENTIALS_ID })
  }
}

export async function getCredentials(): Promise<StoredCredentials | null> {
  const database = getDb()
  try {
    const doc = await database.get(CREDENTIALS_ID)
    const { _id, _rev, ...creds } = doc as any
    return creds as StoredCredentials
  } catch {
    return null
  }
}

export async function clearCredentials(): Promise<void> {
  const database = getDb()
  try {
    const doc = await database.get(CREDENTIALS_ID)
    await database.remove(doc)
  } catch {
  }
}

export async function destroyAuthDb(): Promise<void> {
  const database = getDb()
  try {
    await database.destroy()
  } catch {
  }
  db = null
}

// ─── Vérification locale du mot de passe (déverrouillage hors ligne) ──────────
// Permet à un utilisateur de reverrouiller/déverrouiller l'app sans réseau,
// sans jamais faire confiance à un simple email retapé : le mot de passe est
// vérifié contre une empreinte PBKDF2 dérivée localement (pas le hash bcrypt
// du serveur, qu'on n'a et ne doit jamais avoir côté client).

const PBKDF2_ITERATIONS = 210_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** À appeler juste après un login en ligne réussi, avec le mot de passe en clair (jamais stocké tel quel). */
export async function saveLocalPasswordVerifier(
  email: string,
  password: string,
  tenantId: string,
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const passwordHash = await derivePasswordHash(password, salt)
  await saveCredentials({ email, passwordHash, salt: bytesToBase64(salt), tenantId })
}

/** Vérifie un mot de passe saisi hors ligne contre l'empreinte locale. Fail-closed si rien n'est stocké. */
export async function verifyLocalPassword(email: string, password: string): Promise<boolean> {
  const creds = await getCredentials()
  if (!creds || creds.email !== email) return false
  const candidate = await derivePasswordHash(password, base64ToBytes(creds.salt))
  return constantTimeEqual(candidate, creds.passwordHash)
}
