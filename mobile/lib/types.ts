export interface SessionUser {
  id: string
  email: string
  firstName?: string | null
  lastName: string
  role: string
  tenantId: string
  mustChangePassword?: boolean
}

export interface Teacher {
  id: string
  userId: string
  specialty?: string | null
  user?: { firstName?: string | null; lastName: string; email?: string | null; photoUrl?: string | null }
  classes: { id: string; name: string }[]
  subjects: { id: string; name: string; code?: string | null; level?: string | null }[]
}

export interface ClassItem {
  id: string
  name: string
  level?: string | null
  room?: string | null
  capacity?: number | null
  _count?: { students: number; teachers?: number }
}

export interface Student {
  id: string
  firstName?: string | null
  lastName: string
  registrationNumber?: string
  gender?: string | null
  photoUrl?: string | null
  classId?: string | null
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'

export interface Attendance {
  id: string
  studentId: string
  classId?: string | null
  date: string
  status: AttendanceStatus
  justification?: string | null
}

export interface Subject { id: string; name: string; code?: string | null; coefficient?: number | null }
export interface Period { id: string; label: string; startDate: string; endDate: string }

export interface Grade {
  id: string
  studentId: string
  subjectId: string
  periodId?: string | null
  value: number
  maxValue: number
  coefficient: number
  evaluationType: string
  evaluationLabel?: string | null
  comment?: string | null
  createdAt: string
}

export interface TimetableSlot {
  id: string
  classId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string | null
  isRecreation?: boolean
  subject?: { id: string; name: string; code?: string | null } | null
  teacherId?: string | null
  class?: { id: string; name: string } | null
}

export interface InboxItem {
  id: string
  readAt?: string | null
  createdAt: string
  message: {
    id: string
    subject?: string | null
    body: string
    createdAt: string
    sender: { id: string; firstName?: string | null; lastName: string }
  }
}
