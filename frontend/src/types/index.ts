export interface UserPhone {
  value: string
  sortOrder: number
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phones?: UserPhone[] | null
  role: string
  tenantId: string
  isActive: boolean
  photoUrl?: string | null
}

export interface StudentParentLink {
  id: string
  relation: 'PARENT' | 'TUTEUR'
  isPrimary: boolean
  parent: { id: string; firstName: string; lastName: string; email?: string | null; phones?: UserPhone[] | null }
}

export interface Student {
  id: string
  registrationNumber: string
  firstName: string
  lastName: string
  birthDate: string
  gender: 'M' | 'F'
  classId: string
  status: 'active' | 'inactive' | 'graduated' | 'suspended'
  photoUrl?: string | null
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  address?: string
  parents?: StudentParentLink[]
  createdAt: string
  updatedAt: string
}

export interface Class {
  id: string
  name: string
  level: string
  room?: string
  capacity: number
  studentCount: number
}

export interface Subject {
  id: string
  name: string
  code: string | null
  level: string | null
  coefficient: number
  classId: string | null
  class?: { id: string; name: string } | null
}

export interface Teacher {
  id: string
  userId: string
  user: User
  specialty: string
}

export interface Grade {
  id: string
  studentId: string
  subjectId: string
  value: number
  maxValue: number
  coefficient: number
  evaluationType: 'exam' | 'test' | 'homework' | 'project'
  comment?: string
  periodId?: string
  semester?: number
}

export interface Attendance {
  id: string
  studentId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  justification?: string
}

export interface Payment {
  id: string
  studentId: string
  amount: number
  paidAmount: number
  dueDate: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
}

export interface Message {
  id: string
  subject: string
  body: string
  senderId: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'draft' | 'sent' | 'read' | 'archived'
  createdAt: string
}

export interface SyncEntry {
  localId: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  version: number
  deviceId: string
  status: 'pending' | 'synced' | 'conflict' | 'failed'
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}
