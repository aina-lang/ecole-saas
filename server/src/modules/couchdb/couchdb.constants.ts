export const SYNC_ENTITY_TYPES = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
] as const

export type SyncEntityType = typeof SYNC_ENTITY_TYPES[number]

export function getDbName(entityType: string): string {
  return `ecole-saas-${entityType.toLowerCase()}`
}
