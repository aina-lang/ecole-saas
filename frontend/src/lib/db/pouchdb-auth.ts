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
  passwordHash: string
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
