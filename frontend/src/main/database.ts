import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'

let db: SqlJsDatabase
let dbPath: string

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  const SQL = await initSqlJs()
  dbPath = join(app.getPath('userData'), 'ecole-saas.db')

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  initializeSchema()
  saveDatabase()
  return db
}

function saveDatabase() {
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}

function initializeSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
      payload TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      device_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','synced','conflict','error')),
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS id_mappings (
      local_id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS students_local (
      id TEXT PRIMARY KEY,
      registration_number TEXT,
      first_name TEXT,
      last_name TEXT,
      birth_date TEXT,
      birth_place TEXT,
      gender TEXT,
      nationality TEXT,
      address TEXT,
      phone_number TEXT,
      email TEXT,
      photo_url TEXT,
      blood_type TEXT,
      medical_notes TEXT,
      allergies TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      status TEXT DEFAULT 'ACTIVE',
      class_id TEXT,
      enrollment_date TEXT,
      version INTEGER DEFAULT 1,
      updated_by TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS grades_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      student_id TEXT,
      subject_id TEXT,
      teacher_id TEXT,
      period_id TEXT,
      value REAL,
      max_value REAL DEFAULT 20,
      coefficient REAL DEFAULT 1,
      evaluation_type TEXT DEFAULT 'EXAM',
      evaluation_label TEXT,
      comment TEXT,
      semester INTEGER DEFAULT 1,
      is_published INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updated_by TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      student_id TEXT,
      date TEXT,
      status TEXT DEFAULT 'PRESENT',
      justification TEXT,
      version INTEGER DEFAULT 1,
      updated_by TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS classes_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT,
      level TEXT,
      room TEXT,
      capacity INTEGER DEFAULT 30,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('device_id', '');
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('last_sync_timestamp', '');
  `)
}

export function getDeviceId(): string {
  const stmt = db.exec("SELECT value FROM sync_metadata WHERE key = 'device_id'")
  if (stmt.length > 0 && stmt[0].values.length > 0 && stmt[0].values[0][0]) {
    return stmt[0].values[0][0] as string
  }
  const deviceId = randomUUID()
  db.run("UPDATE sync_metadata SET value = ? WHERE key = 'device_id'", [deviceId])
  saveDatabase()
  return deviceId
}

export function setLastSyncTimestamp(timestamp: string) {
  db.run("UPDATE sync_metadata SET value = ? WHERE key = 'last_sync_timestamp'", [timestamp])
  saveDatabase()
}

export function getLastSyncTimestamp(): string | null {
  const stmt = db.exec("SELECT value FROM sync_metadata WHERE key = 'last_sync_timestamp'")
  if (stmt.length > 0 && stmt[0].values.length > 0 && stmt[0].values[0][0]) {
    return stmt[0].values[0][0] as string
  }
  return null
}

export function addToOutbox(
  entityType: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: any,
  version: number = 1,
) {
  const deviceId = getDeviceId()
  const id = randomUUID()
  db.run(
    'INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, version, device_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, entityType, entityId, operation, JSON.stringify(payload), version, deviceId, 'pending'],
  )
  saveDatabase()
  return id
}

export function getPendingEntries(limit: number = 500): any[] {
  const stmt = db.exec(
    `SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ${limit}`,
  )
  return parseResults(stmt)
}

export function markEntrySynced(id: string, serverId?: string) {
  db.run("UPDATE sync_outbox SET status = 'synced', synced_at = datetime('now') WHERE id = ?", [id])
  if (serverId) {
    const stmt = db.exec('SELECT entity_type, entity_id FROM sync_outbox WHERE id = ?', [id])
    if (stmt.length > 0 && stmt[0].values.length > 0) {
      const entityId = stmt[0].values[0][1] as string
      const entityType = stmt[0].values[0][0] as string
      db.run(
        'INSERT OR REPLACE INTO id_mappings (local_id, server_id, entity_type) VALUES (?, ?, ?)',
        [entityId, serverId, entityType],
      )
    }
  }
  saveDatabase()
}

export function markEntryConflict(id: string, errorMessage: string) {
  db.run("UPDATE sync_outbox SET status = 'conflict', error_message = ? WHERE id = ?", [
    errorMessage,
    id,
  ])
  saveDatabase()
}

export function markEntryError(id: string, errorMessage: string) {
  db.run("UPDATE sync_outbox SET status = 'error', error_message = ? WHERE id = ?", [
    errorMessage,
    id,
  ])
  saveDatabase()
}

export function getConflictCount(): number {
  const stmt = db.exec("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'conflict'")
  if (stmt.length > 0 && stmt[0].values.length > 0) {
    return stmt[0].values[0][0] as number
  }
  return 0
}

export function getPendingCount(): number {
  const stmt = db.exec("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'")
  if (stmt.length > 0 && stmt[0].values.length > 0) {
    return stmt[0].values[0][0] as number
  }
  return 0
}

export function getConflicts(): any[] {
  const stmt = db.exec("SELECT * FROM sync_outbox WHERE status = 'conflict' ORDER BY created_at DESC")
  return parseResults(stmt)
}

export function getServerId(localId: string): string | null {
  const stmt = db.exec('SELECT server_id FROM id_mappings WHERE local_id = ?', [localId])
  if (stmt.length > 0 && stmt[0].values.length > 0) {
    return stmt[0].values[0][0] as string
  }
  return null
}

export function saveLocalStudents(students: any[]) {
  const tx = () => {
    for (const s of students) {
      db.run(
        `INSERT OR REPLACE INTO students_local (id, registration_number, first_name, last_name, birth_date, birth_place, gender, nationality, address, phone_number, email, photo_url, blood_type, medical_notes, allergies, emergency_contact, emergency_phone, status, class_id, enrollment_date, version, updated_by, device_id, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
        [
          s.id,
          s.registrationNumber,
          s.firstName,
          s.lastName,
          s.birthDate || null,
          s.birthPlace || null,
          s.gender || null,
          s.nationality || null,
          s.address || null,
          s.phoneNumber || null,
          s.email || null,
          s.photoUrl || null,
          s.bloodType || null,
          s.medicalNotes || null,
          s.allergies || null,
          s.emergencyContact || null,
          s.emergencyPhone || null,
          s.status || 'ACTIVE',
          s.classId || null,
          s.enrollmentDate || null,
          s.version || 1,
          s.updatedBy || null,
          s.deviceId || null,
        ],
      )
    }
  }
  tx()
  saveDatabase()
}

export function getLocalStudents(filters?: any): any[] {
  let query = "SELECT * FROM students_local WHERE deleted_at IS NULL"
  const params: any[] = []
  if (filters?.classId) {
    query += ' AND class_id = ?'
    params.push(filters.classId)
  }
  if (filters?.search) {
    query += ' AND (first_name LIKE ? OR last_name LIKE ? OR registration_number LIKE ?)'
    const search = `%${filters.search}%`
    params.push(search, search, search)
  }
  query += ' ORDER BY last_name ASC'
  const stmt = db.exec(query, params)
  return parseResults(stmt).map(mapStudentRow)
}

function mapStudentRow(row: any): any {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    gender: row.gender,
    status: row.status,
    classId: row.class_id,
    phoneNumber: row.phone_number,
    email: row.email,
  }
}

function parseResults(stmts: any[]): any[] {
  if (stmts.length === 0) return []
  const stmt = stmts[0]
  if (!stmt.columns || !stmt.values) return []
  const columns = stmt.columns as string[]
  return stmt.values.map((row: any[]) => {
    const obj: any = {}
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i]
    })
    return obj
  })
}

export function saveLocalGrades(grades: any[]) {
  for (const g of grades) {
    db.run(
      `INSERT OR REPLACE INTO grades_local (id, tenant_id, student_id, subject_id, teacher_id, period_id, value, max_value, coefficient, evaluation_type, evaluation_label, comment, semester, is_published, version, updated_by, device_id, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
      [
        g.id,
        g.tenantId || null,
        g.studentId,
        g.subjectId,
        g.teacherId || null,
        g.periodId || null,
        g.value,
        g.maxValue || 20,
        g.coefficient || 1,
        g.evaluationType || 'EXAM',
        g.evaluationLabel || null,
        g.comment || null,
        g.semester || 1,
        g.isPublished ? 1 : 0,
        g.version || 1,
        g.updatedBy || null,
        g.deviceId || null,
      ],
    )
  }
  saveDatabase()
}

export function saveLocalAttendance(records: any[]) {
  for (const r of records) {
    db.run(
      `INSERT OR REPLACE INTO attendance_local (id, tenant_id, student_id, date, status, justification, version, updated_by, device_id, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
      [
        r.id,
        r.tenantId || null,
        r.studentId,
        r.date,
        r.status || 'PRESENT',
        r.justification || null,
        r.version || 1,
        r.updatedBy || null,
        r.deviceId || null,
      ],
    )
  }
  saveDatabase()
}

export function closeDatabase() {
  if (db) {
    saveDatabase()
    db.close()
  }
}
