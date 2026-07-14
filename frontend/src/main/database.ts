import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

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
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'TEACHER',
      is_active INTEGER DEFAULT 1,
      specialty TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_phones_local (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      value TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teachers_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      user_id TEXT,
      employee_id TEXT,
      specialty TEXT,
      qualification TEXT,
      hire_date TEXT,
      status TEXT DEFAULT 'ACTIVE',
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subjects_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT,
      code TEXT,
      coefficient REAL DEFAULT 1,
      category TEXT DEFAULT 'ACADEMIC',
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS timetable_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      class_id TEXT,
      subject_id TEXT,
      teacher_id TEXT,
      day_of_week INTEGER,
      start_time TEXT,
      end_time TEXT,
      room TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fees_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT,
      amount REAL,
      category TEXT,
      due_date TEXT,
      is_mandatory INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      student_id TEXT,
      fee_id TEXT,
      amount REAL,
      payment_date TEXT,
      payment_method TEXT,
      transaction_id TEXT,
      notes TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teacher_attendance_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      teacher_id TEXT,
      date TEXT,
      status TEXT DEFAULT 'PRESENT',
      justification TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teacher_payments_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      teacher_id TEXT,
      amount REAL,
      payment_date TEXT,
      payment_method TEXT,
      month INTEGER,
      year INTEGER,
      status TEXT DEFAULT 'PENDING',
      notes TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teacher_contracts_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      teacher_id TEXT,
      contract_type TEXT,
      start_date TEXT,
      end_date TEXT,
      salary REAL,
      hours_per_week REAL,
      status TEXT DEFAULT 'ACTIVE',
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      sender_id TEXT,
      subject TEXT,
      body TEXT,
      is_read INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS message_recipients_local (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      recipient_id TEXT,
      recipient_role TEXT,
      FOREIGN KEY (message_id) REFERENCES messages_local(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings_local (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs_local (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      timestamp TEXT,
      user_id TEXT,
      user_name TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS batch_operations_local (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','error')),
      result TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS file_uploads (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      local_path TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      remote_url TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','synced','error')),
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
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

function getSearchColumns(entityType: string): string[] {
  const map: Record<string, string[]> = {
    Student: ['first_name', 'last_name', 'registration_number'],
    Subject: ['name', 'code'],
    Class: ['name', 'level'],
    Grade: ['evaluation_type', 'evaluation_label'],
    Attendance: ['status', 'justification'],
    Teacher: ['specialty', 'employee_id'],
    User: ['email', 'first_name', 'last_name'],
  }
  return map[entityType] || ['name', 'code']
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

function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(snakeToCamel)
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result
}

const LOCAL_TABLES: Record<string, { table: string; columns: string[]; placeholders: (data: any) => any[]; conflicts: string }> = {
  Student: {
    table: 'students_local',
    columns: ['id', 'registration_number', 'first_name', 'last_name', 'birth_date', 'birth_place', 'gender', 'nationality', 'address', 'phone_number', 'email', 'photo_url', 'blood_type', 'medical_notes', 'allergies', 'emergency_contact', 'emergency_phone', 'status', 'class_id', 'enrollment_date', 'version', 'updated_by', 'device_id'],
    placeholders: (d) => [d.id, d.registrationNumber, d.firstName, d.lastName, d.birthDate || null, d.birthPlace || null, d.gender || null, d.nationality || null, d.address || null, d.phoneNumber || null, d.email || null, d.photoUrl || null, d.bloodType || null, d.medicalNotes || null, d.allergies || null, d.emergencyContact || null, d.emergencyPhone || null, d.status || 'ACTIVE', d.classId || null, d.enrollmentDate || null, d.version || 1, d.updatedBy || null, d.deviceId || null],
    conflicts: 'id',
  },
  Grade: {
    table: 'grades_local',
    columns: ['id', 'tenant_id', 'student_id', 'subject_id', 'teacher_id', 'period_id', 'value', 'max_value', 'coefficient', 'evaluation_type', 'evaluation_label', 'comment', 'semester', 'is_published', 'version', 'updated_by', 'device_id'],
    placeholders: (d) => [d.id, d.tenantId || null, d.studentId, d.subjectId, d.teacherId || null, d.periodId || null, d.value, d.maxValue || 20, d.coefficient || 1, d.evaluationType || 'EXAM', d.evaluationLabel || null, d.comment || null, d.semester || 1, d.isPublished ? 1 : 0, d.version || 1, d.updatedBy || null, d.deviceId || null],
    conflicts: 'id',
  },
  Attendance: {
    table: 'attendance_local',
    columns: ['id', 'tenant_id', 'student_id', 'date', 'status', 'justification', 'version', 'updated_by', 'device_id'],
    placeholders: (d) => [d.id, d.tenantId || null, d.studentId, d.date, d.status || 'PRESENT', d.justification || null, d.version || 1, d.updatedBy || null, d.deviceId || null],
    conflicts: 'id',
  },
  Class: {
    table: 'classes_local',
    columns: ['id', 'tenant_id', 'name', 'level', 'room', 'capacity', 'deleted_at'],
    placeholders: (d) => [d.id, d.tenantId || null, d.name, d.level || null, d.room || null, d.capacity || 30, d.deletedAt || null],
    conflicts: 'id',
  },
  User: {
    table: 'users_local',
    columns: ['id', 'tenant_id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'specialty', 'version'],
    placeholders: (d) => [d.id, d.tenantId || null, d.email || null, d.firstName, d.lastName, d.role || 'TEACHER', d.isActive !== undefined ? (d.isActive ? 1 : 0) : 1, d.specialty || null, d.version || 1],
    conflicts: 'id',
  },
  Teacher: {
    table: 'teachers_local',
    columns: ['id', 'tenant_id', 'user_id', 'employee_id', 'specialty', 'qualification', 'hire_date', 'status'],
    placeholders: (d) => [d.id, d.tenantId || null, d.userId || null, d.employeeId || null, d.specialty || null, d.qualification || null, d.hireDate || null, d.status || 'ACTIVE'],
    conflicts: 'id',
  },
  Subject: {
    table: 'subjects_local',
    columns: ['id', 'tenant_id', 'name', 'code', 'coefficient', 'category'],
    placeholders: (d) => [d.id, d.tenantId || null, d.name, d.code || null, d.coefficient || 1, d.category || 'ACADEMIC'],
    conflicts: 'id',
  },
  Timetable: {
    table: 'timetable_local',
    columns: ['id', 'tenant_id', 'class_id', 'subject_id', 'teacher_id', 'day_of_week', 'start_time', 'end_time', 'room'],
    placeholders: (d) => [d.id, d.tenantId || null, d.classId, d.subjectId, d.teacherId || null, d.dayOfWeek, d.startTime, d.endTime, d.room || null],
    conflicts: 'id',
  },
  Fee: {
    table: 'fees_local',
    columns: ['id', 'tenant_id', 'name', 'amount', 'category', 'due_date', 'is_mandatory'],
    placeholders: (d) => [d.id, d.tenantId || null, d.name, d.amount || 0, d.category || null, d.dueDate || null, d.isMandatory ? 1 : 0],
    conflicts: 'id',
  },
  Payment: {
    table: 'payments_local',
    columns: ['id', 'tenant_id', 'student_id', 'fee_id', 'amount', 'payment_date', 'payment_method', 'transaction_id', 'notes'],
    placeholders: (d) => [d.id, d.tenantId || null, d.studentId, d.feeId || null, d.amount || 0, d.paymentDate || null, d.paymentMethod || null, d.transactionId || null, d.notes || null],
    conflicts: 'id',
  },
  TeacherAttendance: {
    table: 'teacher_attendance_local',
    columns: ['id', 'tenant_id', 'teacher_id', 'date', 'status', 'justification', 'deleted_at'],
    placeholders: (d) => [d.id, d.tenantId || null, d.teacherId, d.date, d.status || 'PRESENT', d.justification || null, d.deletedAt || null],
    conflicts: 'id',
  },
  TeacherPayment: {
    table: 'teacher_payments_local',
    columns: ['id', 'tenant_id', 'teacher_id', 'amount', 'payment_date', 'payment_method', 'month', 'year', 'status', 'notes', 'deleted_at'],
    placeholders: (d) => [d.id, d.tenantId || null, d.teacherId, d.amount || 0, d.paymentDate || null, d.paymentMethod || null, d.month || null, d.year || null, d.status || 'PENDING', d.notes || null, d.deletedAt || null],
    conflicts: 'id',
  },
  TeacherContract: {
    table: 'teacher_contracts_local',
    columns: ['id', 'tenant_id', 'teacher_id', 'contract_type', 'start_date', 'end_date', 'salary', 'hours_per_week', 'status'],
    placeholders: (d) => [d.id, d.tenantId || null, d.teacherId, d.contractType || null, d.startDate || null, d.endDate || null, d.salary || 0, d.hoursPerWeek || 0, d.status || 'ACTIVE'],
    conflicts: 'id',
  },
  Message: {
    table: 'messages_local',
    columns: ['id', 'tenant_id', 'sender_id', 'subject', 'body', 'is_read', 'is_archived'],
    placeholders: (d) => [d.id, d.tenantId || null, d.senderId, d.subject || '', d.body || '', d.isRead ? 1 : 0, d.isArchived ? 1 : 0],
    conflicts: 'id',
  },
}

export function getLocalTableConfig(entityType: string) {
  return LOCAL_TABLES[entityType] || null
}

export function saveEntity(entityType: string, data: any) {
  const config = LOCAL_TABLES[entityType]
  if (!config) {
    console.warn(`No local table configured for entity: ${entityType}`)
    return false
  }

  const allPlaceholders = config.placeholders(data)
  const cols = config.columns.join(', ')
  const placeholders = config.columns.map(() => '?').join(', ')
  const excludedCols = config.columns.map((col) => `${col}=excluded.${col}`).join(', ')
  const sql = `INSERT INTO ${config.table} (${cols}) VALUES (${placeholders}) ON CONFLICT(${config.conflicts}) DO UPDATE SET ${excludedCols}, updated_at=datetime('now')`
  db.run(sql, allPlaceholders)
  saveDatabase()
  return true
}

export function queryEntities(entityType: string, filters?: Record<string, any>): any[] {
  const config = LOCAL_TABLES[entityType]
  if (!config) return []

  let sql = `SELECT * FROM ${config.table} WHERE deleted_at IS NULL`
  const params: any[] = []
  let limit: number | null = null
  let offset: number | null = null

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue
      if (key === 'limit') {
        limit = value
        continue
      }
      if (key === 'offset') {
        offset = value
        continue
      }
      if (key === 'page' || key === 'pageSize') {
        continue
      }
      if (key === 'search') {
        const searchCols = getSearchColumns(entityType)
        const clauses = searchCols.map((col) => `${col} LIKE ?`).join(' OR ')
        sql += ` AND (${clauses})`
        const s = `%${value}%`
        params.push(...searchCols.map(() => s))
        continue
      }
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      sql += ` AND ${col} = ?`
      params.push(value)
    }
  }

  sql += ' ORDER BY created_at DESC'
  if (limit !== null) {
    sql += ' LIMIT ?'
    params.push(limit)
  }
  if (offset !== null) {
    sql += ' OFFSET ?'
    params.push(offset)
  }

  const stmt = db.exec(sql, params)
  return parseResults(stmt).map(snakeToCamel)
}

export function getEntityById(entityType: string, id: string): any | null {
  const config = LOCAL_TABLES[entityType]
  if (!config) return null

  const sql = `SELECT * FROM ${config.table} WHERE id = ? AND deleted_at IS NULL`
  const stmt = db.exec(sql, [id])
  const results = parseResults(stmt).map(snakeToCamel)
  return results.length > 0 ? results[0] : null
}

export function softDeleteEntity(entityType: string, id: string) {
  const config = LOCAL_TABLES[entityType]
  if (!config) return false

  db.run(`UPDATE ${config.table} SET deleted_at = datetime('now'), synced = 0 WHERE id = ?`, [id])
  saveDatabase()
  return true
}

export function markEntitySynced(entityType: string, id: string) {
  const config = LOCAL_TABLES[entityType]
  if (!config) return

  db.run(`UPDATE ${config.table} SET synced = 1 WHERE id = ?`, [id])
  saveDatabase()
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

export const UPLOADS_DIR = join(app.getPath('userData'), 'uploads')

function ensureUploadsDir(subdir: string = ''): string {
  const dir = subdir ? join(UPLOADS_DIR, subdir) : UPLOADS_DIR
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function saveFileLocally(
  buffer: Buffer,
  entityType: string,
  entityId: string,
  fieldName: string,
  originalName: string,
  mimeType: string,
): { id: string; localPath: string } {
  const ext = originalName.split('.').pop() || 'bin'
  const fileName = `${fieldName}-${randomUUID()}.${ext}`
  const subdir = join(entityType.toLowerCase(), entityId)
  const dir = ensureUploadsDir(subdir)
  const localPath = join(dir, fileName)
  writeFileSync(localPath, buffer)

  const id = randomUUID()
  db.run(
    `INSERT INTO file_uploads (id, entity_type, entity_id, field_name, local_path, original_name, mime_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, entityType, entityId, fieldName, localPath, originalName, mimeType],
  )
  saveDatabase()
  return { id, localPath }
}

export function getLocalFilePath(localPath: string): string {
  if (existsSync(localPath)) return localPath
  return ''
}

export function markFileSynced(id: string, remoteUrl: string) {
  db.run(
    `UPDATE file_uploads SET status = 'synced', remote_url = ?, synced_at = datetime('now') WHERE id = ?`,
    [remoteUrl, id],
  )
  saveDatabase()
}

export function markFileError(id: string) {
  db.run(`UPDATE file_uploads SET status = 'error' WHERE id = ?`, [id])
  saveDatabase()
}

export function getPendingFileUploads(): any[] {
  const stmt = db.exec(
    `SELECT * FROM file_uploads WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`,
  )
  return parseResults(stmt)
}

export function getFileUploadByEntity(
  entityType: string,
  entityId: string,
  fieldName: string,
): any | null {
  const stmt = db.exec(
    `SELECT * FROM file_uploads WHERE entity_type = ? AND entity_id = ? AND field_name = ? ORDER BY created_at DESC LIMIT 1`,
    [entityType, entityId, fieldName],
  )
  const results = parseResults(stmt)
  return results.length > 0 ? results[0] : null
}

export function getFileUploadCount(): number {
  const stmt = db.exec("SELECT COUNT(*) as count FROM file_uploads WHERE status = 'pending'")
  if (stmt.length > 0 && stmt[0].values.length > 0) {
    return stmt[0].values[0][0] as number
  }
  return 0
}

export function closeDatabase() {
  if (db) {
    saveDatabase()
    db.close()
  }
}

export function getSetting(key: string): string | null {
  const stmt = db.exec('SELECT value FROM settings_local WHERE key = ?', [key])
  if (stmt.length > 0 && stmt[0].values.length > 0) return stmt[0].values[0][0] as string
  return null
}

export function setSetting(key: string, value: string) {
  db.run(
    'INSERT OR REPLACE INTO settings_local (key, value, synced, updated_at) VALUES (?, ?, 0, datetime(\'now\'))',
    [key, value],
  )
  saveDatabase()
}

export function getAllSettings(): Record<string, string> {
  const stmt = db.exec('SELECT key, value FROM settings_local')
  const result: Record<string, string> = {}
  for (const row of parseResults(stmt)) {
    result[row.key] = row.value
  }
  return result
}

export function saveAuditLog(entry: {
  id: string
  tenantId?: string
  userId?: string
  userName?: string
  action: string
  entityType?: string
  entityId?: string
  details?: any
}) {
  db.run(
    `INSERT INTO audit_logs_local (id, tenant_id, timestamp, user_id, user_name, action, entity_type, entity_id, details, synced)
     VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, 0)`,
    [
      entry.id,
      entry.tenantId || null,
      entry.userId || null,
      entry.userName || null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      entry.details ? JSON.stringify(entry.details) : null,
    ],
  )
  saveDatabase()
}

export function getAuditLogs(filters?: { action?: string; entityType?: string; limit?: number; offset?: number }): any[] {
  let sql = 'SELECT * FROM audit_logs_local WHERE 1=1'
  const params: any[] = []
  if (filters?.action) { sql += ' AND action = ?'; params.push(filters.action) }
  if (filters?.entityType) { sql += ' AND entity_type = ?'; params.push(filters.entityType) }
  sql += ' ORDER BY timestamp DESC'
  if (filters?.limit) sql += ` LIMIT ${filters.limit}`
  if (filters?.offset) sql += ` OFFSET ${filters.offset}`
  const stmt = db.exec(sql, params)
  return parseResults(stmt).map((r: any) => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : null,
  }))
}

export function saveBatchOperation(op: {
  id: string
  operationType: string
  entityType?: string
  payload: any
}) {
  db.run(
    `INSERT INTO batch_operations_local (id, operation_type, entity_type, payload, status, synced)
     VALUES (?, ?, ?, ?, 'pending', 0)`,
    [op.id, op.operationType, op.entityType || null, JSON.stringify(op.payload)],
  )
  saveDatabase()
}

export function getPendingBatchOperations(): any[] {
  const stmt = db.exec(
    "SELECT * FROM batch_operations_local WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50",
  )
  return parseResults(stmt).map((r: any) => ({ ...r, payload: JSON.parse(r.payload) }))
}
