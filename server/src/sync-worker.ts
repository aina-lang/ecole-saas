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

function dbName(tenantId: string, entity: string): string {
  const tid = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `ecole-saas-${tid}-${entity.toLowerCase()}`
}

function stripMeta(doc: any) {
  const { _id, _rev, _deleted, _revisions, _attachments, ...rest } = doc
  return { id: _id, ...rest }
}

function connectRelations(data: any): any {
  const relations: Record<string, string> = {
    classId: 'class',
    studentId: 'student',
    subjectId: 'subject',
    teacherId: 'teacher',
    userId: 'user',
    periodId: 'period',
    academicYearId: 'academicYear',
  };
  for (const [fk, rel] of Object.entries(relations)) {
    if (data[fk]) {
      data[rel] = { connect: { id: data[fk] } };
      delete data[fk];
    }
  }
  return data;
}

async function resolveTenantId(entity: string, data: any): Promise<string | null> {
  if (data.tenantId) return data.tenantId;
  if (entity === 'Grade' && data.studentId) {
    const student = await (prisma.student as any).findFirst({
      where: { id: data.studentId },
      select: { tenantId: true },
    });
    if (student?.tenantId) return student.tenantId;
  }
  if (entity === 'Attendance' && data.studentId) {
    const student = await (prisma.student as any).findFirst({
      where: { id: data.studentId },
      select: { tenantId: true },
    });
    if (student?.tenantId) return student.tenantId;
  }
  if (entity === 'Payment' && data.studentId) {
    const student = await (prisma.student as any).findFirst({
      where: { id: data.studentId },
      select: { tenantId: true },
    });
    if (student?.tenantId) return student.tenantId;
  }
  return null;
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

  let tenantId = data.tenantId || data.tenant_id
  if (!tenantId) {
    tenantId = await resolveTenantId(entity, data)
  }
  if (!tenantId) return

  const model = entityModel(entity)
  const id = change.id

  if (change.deleted) {
    try {
      const existing = await (model as any).findFirst({ where: { id } });
      if (existing && existing.tenantId !== tenantId) {
        console.error(
          `[sync-worker] ${entity}/${id}: tenantId mismatch on delete — ` +
          `CouchDB dit tenantId=${tenantId}, PostgreSQL a tenantId=${existing.tenantId}. ` +
          `Suppression BLOQUÉE.`
        );
        return;
      }
      await model.update({ where: { id }, data: { deletedAt: new Date() } })
    }
    catch {}
    return
  }

  try {
    const existing = await (model as any).findFirst({ where: { id } });
    if (existing && existing.tenantId !== tenantId) {
      console.error(
        `[sync-worker] ${entity}/${id}: tenantId mismatch — ` +
        `CouchDB dit tenantId=${tenantId}, PostgreSQL a tenantId=${existing.tenantId}. ` +
        `Mise à jour BLOQUÉE (possible fuite de données inter-tenants).`
      );
      return;
    }

    connectRelations(data)

    await model.upsert({
      where: { id },
      create: { ...data, id, tenantId },
      update: data,
    })
  } catch (err: any) {
    console.error(`[sync-worker] ${entity}/${id}: ${err.message}`)
  }
}

const activeFeeds = new Set<string>()

async function startChangeFeed(tenantId: string, entity: string) {
  const dbStr = dbName(tenantId, entity)
  if (activeFeeds.has(dbStr)) return
  activeFeeds.add(dbStr)

  const url = `${getAuthUrl()}/${dbStr}`
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
      console.log(`[sync-worker] Created CouchDB database: ${dbStr}`)
    } catch {
      console.warn(`[sync-worker] Database ${dbStr} not available, retrying in 10s`)
      activeFeeds.delete(dbStr)
      setTimeout(() => startChangeFeed(tenantId, entity), 10000)
      return
    }
  }

  const feed = db.changes({ since: 'now', live: true, include_docs: true, heartbeat: 10000 })

  feed.on('change', (change) => processChange(entity, change))
  feed.on('error', (err) => {
    console.error(`[sync-worker] Changes feed error for ${dbStr}: ${err.message}`)
    activeFeeds.delete(dbStr)
    setTimeout(() => startChangeFeed(tenantId, entity), 5000)
  })

  console.log(`[sync-worker] Watching CouchDB → PostgreSQL: ${dbStr}`)
}

async function pollTenants() {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true } })
    for (const tenant of tenants) {
      for (const entity of ENTITIES) {
        startChangeFeed(tenant.id, entity)
      }
    }
  } catch (err: any) {
    console.error(`[sync-worker] Error polling tenants: ${err.message}`)
  }
  setTimeout(pollTenants, 30000)
}

async function main() {
  console.log(`[sync-worker] Starting CouchDB→PostgreSQL sync (${COUCH_URL})`)
  console.log(`[sync-worker] Entities: ${ENTITIES.join(', ')}`)

  await prisma.$connect()
  console.log('[sync-worker] Connected to PostgreSQL')

  pollTenants()
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
