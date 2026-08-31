import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Teacher, ClassItem, Student, Attendance, Subject, Period, Grade, TimetableSlot, InboxItem } from './types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<Teacher>('/teachers/me')).data })
}

export function useClasses() {
  return useQuery({ queryKey: ['classes'], queryFn: async () => (await api.get<ClassItem[]>('/classes')).data })
}

/** Classes de l'enseignant connecté (toutes pour un admin). */
export function useMyClasses() {
  const me = useMe()
  const classes = useClasses()
  const mine = me.data?.classes?.length
    ? (classes.data ?? []).filter((c) => me.data!.classes.some((mc) => mc.id === c.id))
    : classes.data ?? []
  return { data: mine, isLoading: me.isLoading || classes.isLoading, refetch: () => Promise.all([me.refetch(), classes.refetch()]), error: me.error ?? classes.error }
}

/** Tous les élèves d'une classe, page par page (l'API plafonne à 100 par page :
 * demander 500 renvoyait une erreur 400 → liste vide dans l'app). */
export async function fetchClassStudents(classId: string): Promise<Student[]> {
  const all: Student[] = []
  for (let page = 1; page <= 20; page++) {
    const { data } = await api.get<{ data: Student[]; total?: number } | Student[]>('/students', { params: { classId, limit: 100, page } })
    const list = Array.isArray(data) ? data : data.data
    all.push(...list)
    const total = Array.isArray(data) ? list.length : (data.total ?? list.length)
    if (list.length < 100 || all.length >= total) break
  }
  return all.sort((a, b) => a.lastName.localeCompare(b.lastName))
}

export function useClassStudents(classId?: string) {
  return useQuery({
    queryKey: ['students', classId],
    enabled: !!classId,
    queryFn: () => fetchClassStudents(classId!),
  })
}

export function useAttendance(classId?: string, date?: string) {
  return useQuery({
    queryKey: ['attendance', classId, date],
    enabled: !!classId && !!date,
    queryFn: async () => (await api.get<Attendance[]>('/attendance', { params: { classId, date } })).data,
  })
}

export function useClassSubjects(classId?: string) {
  return useQuery({
    queryKey: ['subjects', classId],
    enabled: !!classId,
    queryFn: async () => (await api.get<Subject[]>(`/classes/${classId}/subjects`)).data,
  })
}

export function usePeriods() {
  return useQuery({
    queryKey: ['periods'],
    queryFn: async () => (await api.get<{ academicYear: { id: string; label: string } | null; periods: Period[] }>('/grades/periods')).data,
  })
}

export function useGrades(classId?: string, subjectId?: string, periodId?: string) {
  return useQuery({
    queryKey: ['grades', classId, subjectId, periodId ?? ''],
    enabled: !!classId && !!subjectId,
    queryFn: async () => (await api.get<Grade[]>('/grades', { params: { classId, subjectId, periodId: periodId || undefined } })).data,
  })
}

export function useTimetable(classId?: string) {
  return useQuery({
    queryKey: ['timetable', classId],
    enabled: !!classId,
    queryFn: async () => (await api.get<TimetableSlot[]>('/timetable', { params: { classId } })).data,
  })
}

export function useInbox() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get<{ data: InboxItem[]; total: number }>('/communications/inbox', { params: { limit: 50 } })).data,
  })
}
