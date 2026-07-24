export interface UserPhone {
  value: string
  sortOrder: number
}

export interface User {
  id: string
  email: string
  firstName?: string
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
  parent: { id: string; firstName?: string; lastName: string; email?: string | null; phones?: UserPhone[] | null }
}

export interface Student {
  id: string
  registrationNumber: string
  firstName?: string
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
  levelId?: string
  room?: string
  capacity: number
  studentCount: number
}

export interface Subject {
  id: string
  name: string
  code: string | null
  level: string | null
  levelId?: string | null
  coefficient: number
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
  evaluationType: 'exam' | 'test' | 'homework' | 'oral' | 'project' | 'controle' | 'examen_blanc'
  comment?: string
  periodId?: string
  classId?: string
  academicYearId?: string
  teacherId?: string
  evaluationLabel?: string
  isPublished?: boolean
}

export interface Attendance {
  id: string
  studentId: string
  date: string
  halfDay?: 'MORNING' | 'AFTERNOON'
  timetableSlotId?: string
  subjectId?: string
  teacherId?: string
  status: 'present' | 'absent' | 'late' | 'excused' | 'holiday'
  justification?: string
}

export type PromotionDecision = 'ADMIS' | 'REDOUBLANT' | 'EXCLU' | 'A_DELIBERER'
export type ReinscriptionStatus = 'PRE_INSCRIT' | 'BLOQUE' | 'INSCRIT_ACTIF'

export interface StudentEnrollment {
  id: string
  studentId: string
  academicYearId: string
  levelId: string
  classId?: string
  promotionDecision?: PromotionDecision
  reinscriptionStatus: ReinscriptionStatus
  createdAt: string
  updatedAt: string
  student?: Student
  academicYear?: AcademicYear
  level?: Level
  class?: Class
}

export interface AcademicYear {
  id: string
  label: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

export interface FeeStructure {
  id: string
  label: string
  feeType: 'TUITION' | 'ANNUAL' | 'OTHER'
  levelId?: string
  level?: { id: string; name: string }
  amount: number
  dueDay: number
  description?: string
  isActive: boolean
  isMandatory?: boolean
  createdAt?: string
}

export interface Level {
  id: string
  name: string
  sortOrder: number
  nextLevelId?: string
  nextLevel?: { id: string; name: string }
  _count?: { classes: number; feeStructures: number }
}

export interface Payment {
  id: string
  studentId: string
  feeStructureId?: string
  academicYearId?: string
  amount: number
  paidAmount: number
  dueDate: string
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
  paymentMethod?: string
  reference?: string
  receiptNumber?: string
  notes?: string
  paidAt?: string
}

export interface StudentDocument {
  id: string
  studentId: string
  fileName: string
  notes?: string
  fileData?: string
  fileMimeType?: string
  fileOriginalName?: string
  fileSize?: number
  createdAt: string
  updatedAt: string
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
