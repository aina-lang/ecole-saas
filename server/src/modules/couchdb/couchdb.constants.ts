export const SYNC_ENTITY_TYPES = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance', 'AuditLog', 'Level',
] as const

export type SyncEntityType = typeof SYNC_ENTITY_TYPES[number]

export function getDbName(tenantId: string, entityType: string): string {
  const tid = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `ecole-saas-${tid}-${entityType.toLowerCase()}`
}
