import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'ecole-saas.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initializeSchema()
  }
  return db
}

function initializeSchema() {
  db.exec(`
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
  const stmt = db.prepare("SELECT value FROM sync_metadata WHERE key = 'device_id'")
  const row = stmt.get() as { value: string } | undefined
  if (row && row.value) return row.value
  const deviceId = uuidv4()
  db.prepare("UPDATE sync_metadata SET value = ? WHERE key = 'device_id'").run(deviceId)
  return deviceId
}

export function setLastSyncTimestamp(timestamp: string) {
  db.prepare("UPDATE sync_metadata SET value = ? WHERE key = 'last_sync_timestamp'").run(timestamp)
}

export function getLastSyncTimestamp(): string | null {
  const row = db.prepare("SELECT value FROM sync_metadata WHERE key = 'last_sync_timestamp'").get() as { value: string } | undefined
  return row?.value || null
}

export function addToOutbox(
  entityType: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: any,
  version: number = 1,
) {
  const deviceId = getDeviceId()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, version, device_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, entityType, entityId, operation, JSON.stringify(payload), version, deviceId)
  return id
}

export function getPendingEntries(limit: number = 500): any[] {
  return db.prepare(`
    SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?
  `).all(limit)
}

export function markEntrySynced(id: string, serverId?: string) {
  db.prepare(`
    UPDATE sync_outbox SET status = 'synced', synced_at = datetime('now') WHERE id = ?
  `).run(id)
  if (serverId) {
    const entry = db.prepare('SELECT entity_type, entity_id FROM sync_outbox WHERE id = ?').get(id) as any
    if (entry) {
      db.prepare(`
        INSERT OR REPLACE INTO id_mappings (local_id, server_id, entity_type) VALUES (?, ?, ?)
      `).run(entry.entity_id, serverId, entry.entity_type)
    }
  }
}

export function markEntryConflict(id: string, errorMessage: string) {
  db.prepare(`
    UPDATE sync_outbox SET status = 'conflict', error_message = ? WHERE id = ?
  `).run(errorMessage, id)
}

export function markEntryError(id: string, errorMessage: string) {
  db.prepare(`
    UPDATE sync_outbox SET status = 'error', error_message = ? WHERE id = ?
  `).run(errorMessage, id)
}

export function getConflictCount(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'conflict'").get() as { count: number }
  return row.count
}

export function getPendingCount(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'").get() as { count: number }
  return row.count
}

export function getConflicts(): any[] {
  return db.prepare("SELECT * FROM sync_outbox WHERE status = 'conflict' ORDER BY created_at DESC").all()
}

export function getServerId(localId: string): string | null {
  const row = db.prepare('SELECT server_id FROM id_mappings WHERE local_id = ?').get(localId) as { server_id: string } | undefined
  return row?.server_id || null
}

export function saveLocalStudents(students: any[]) {
  const upsert = db.prepare(`
    INSERT INTO students_local (id, registration_number, first_name, last_name, birth_date, birth_place, gender, nationality, address, phone_number, email, photo_url, blood_type, medical_notes, allergies, emergency_contact, emergency_phone, status, class_id, enrollment_date, version, updated_by, device_id, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      status = excluded.status,
      class_id = excluded.class_id,
      version = excluded.version,
      updated_at = datetime('now'),
      synced = 1
  `)
  const tx = db.transaction((students: any[]) => {
    for (const s of students) {
      upsert.run(
        s.id, s.registrationNumber, s.firstName, s.lastName, s.birthDate, s.birthPlace,
        s.gender, s.nationality, s.address, s.phoneNumber, s.email, s.photoUrl,
        s.bloodType, s.medicalNotes, s.allergies, s.emergencyContact, s.emergencyPhone,
        s.status, s.classId, s.enrollmentDate, s.version || 1, s.updatedBy, s.deviceId
      )
    }
  })
  tx(students)
}

export function getLocalStudents(filters?: any): any[] {
  let query = "SELECT * FROM students_local WHERE deleted_at IS NULL"
  const params: any[] = []
  if (filters?.classId) {
    query += " AND class_id = ?"
    params.push(filters.classId)
  }
  if (filters?.search) {
    query += " AND (first_name LIKE ? OR last_name LIKE ? OR registration_number LIKE ?)"
    const search = `%${filters.search}%`
    params.push(search, search, search)
  }
  query += " ORDER BY last_name ASC"
  return db.prepare(query).all(...params)
}

export function saveLocalGrades(grades: any[]) {
  const upsert = db.prepare(`
    INSERT INTO grades_local (id, tenant_id, student_id, subject_id, teacher_id, period_id, value, max_value, coefficient, evaluation_type, evaluation_label, comment, semester, is_published, version, updated_by, device_id, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET
      value = excluded.value,
      max_value = excluded.max_value,
      coefficient = excluded.coefficient,
      evaluation_label = excluded.evaluation_label,
      comment = excluded.comment,
      is_published = excluded.is_published,
      version = excluded.version,
      updated_at = datetime('now'),
      synced = 1
  `)
  const tx = db.transaction((grades: any[]) => {
    for (const g of grades) {
      upsert.run(
        g.id, g.tenantId, g.studentId, g.subjectId, g.teacherId, g.periodId,
        g.value, g.maxValue, g.coefficient, g.evaluationType, g.evaluationLabel,
        g.comment, g.semester, g.isPublished ? 1 : 0,
        g.version || 1, g.updatedBy, g.deviceId
      )
    }
  })
  tx(grades)
}

export function saveLocalAttendance(records: any[]) {
  const upsert = db.prepare(`
    INSERT INTO attendance_local (id, tenant_id, student_id, date, status, justification, version, updated_by, device_id, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      justification = excluded.justification,
      version = excluded.version,
      updated_at = datetime('now'),
      synced = 1
  `)
  const tx = db.transaction((records: any[]) => {
    for (const r of records) {
      upsert.run(
        r.id, r.tenantId, r.studentId, r.date, r.status, r.justification,
        r.version || 1, r.updatedBy, r.deviceId
      )
    }
  })
  tx(records)
}

export function closeDatabase() {
  if (db) {
    db.close()
  }
}
