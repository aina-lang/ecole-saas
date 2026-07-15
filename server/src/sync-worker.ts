import PouchDB from 'pouchdb'
import { PrismaClient } from '@prisma/client'

const COUCH_URL = process.env.COUCHDB_URL || 'http://localhost:5984'
const COUCH_USER = process.env.COUCHDB_USER || ''
const COUCH_PASS = process.env.COUCHDB_PASS || ''

const ENTITIES = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
] as const

function getAuthUrl(): string {
  if (COUCH_USER && COUCH_PASS) {
    return COUCH_URL.replace('://', `://${COUCH_USER}:${encodeURIComponent(COUCH_PASS)}@`)
  }
  return COUCH_URL
}

function dbName(entity: string): string {
  return `ecole-saas-${entity.toLowerCase()}`
}

function stripMeta(doc: any) {
  const { _id, _rev, _deleted, _revisions, _attachments, ...rest } = doc
  return { id: _id, ...rest }
}

const prisma = new PrismaClient()
const entityModel = (name: string) => {
  const map: Record<string, string> = {
    Student: 'student', Grade: 'grade', Attendance: 'attendance',
    Class: 'class', Subject: 'subject', Teacher: 'teacher',
    Payment: 'payment', FeeStructure: 'feeStructure',
    Message: 'message', TimetableSlot: 'timetableSlot',
    TeacherAttendance: 'teacherAttendance',
    TeacherContract: 'teacherContract',
    TeacherPayment: 'teacherPayment',
  }
  return prisma[map[name]] as any
}

async function processChange(entity: string, change: any) {
  if (!change.doc || change.doc._id.startsWith('_design/')) return
  const data = stripMeta(change.doc)
  const tenantId = data.tenantId || data.tenant_id
  if (!tenantId) return

  const model = entityModel(entity)
  const id = change.id

  if (change.deleted) {
    try { await model.update({ where: { id }, data: { deletedAt: new Date() } }) }
    catch {}
    return
  }

  try {
    await model.upsert({
      where: { id },
      create: { ...data, id, tenantId },
      update: data,
    })
  } catch (err: any) {
    console.error(`[sync-worker] ${entity}/${id}: ${err.message}`)
  }
}

async function startChangeFeed(entity: string) {
  const url = `${getAuthUrl()}/${dbName(entity)}`
  const db = new PouchDB(url)

  try {
    await db.info()
  } catch {
    try {
      const headers: Record<string, string> = {}
      if (COUCH_USER && COUCH_PASS) {
        headers['Authorization'] = `Basic ${Buffer.from(`${COUCH_USER}:${COUCH_PASS}`).toString('base64')}`
      }
      await fetch(url, { method: 'PUT', headers })
      console.log(`[sync-worker] Created CouchDB database: ${dbName(entity)}`)
    } catch {
      console.warn(`[sync-worker] Database ${dbName(entity)} not available, retrying in 10s`)
      setTimeout(() => startChangeFeed(entity), 10000)
      return
    }
  }

  const feed = db.changes({ since: 'now', live: true, include_docs: true, heartbeat: 10000 })

  feed.on('change', (change) => processChange(entity, change))
  feed.on('error', (err) => {
    console.error(`[sync-worker] Changes feed error for ${entity}: ${err.message}`)
    setTimeout(() => startChangeFeed(entity), 5000)
  })

  console.log(`[sync-worker] Watching CouchDB → PostgreSQL: ${dbName(entity)}`)
}

async function main() {
  console.log(`[sync-worker] Starting CouchDB→PostgreSQL sync (${COUCH_URL})`)
  console.log(`[sync-worker] Entities: ${ENTITIES.join(', ')}`)

  await prisma.$connect()
  console.log('[sync-worker] Connected to PostgreSQL')

  for (const entity of ENTITIES) {
    startChangeFeed(entity)
  }
}

main().catch((err) => {
  console.error('[sync-worker] Fatal:', err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  console.log('[sync-worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('[sync-worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})
