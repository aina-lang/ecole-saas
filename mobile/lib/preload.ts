import { queryClient } from './query'
import { api } from './api'
import type { Teacher, ClassItem, Subject, Period, TimetableSlot, Attendance } from './types'
import { fetchClassStudents } from './queries'

// Préchargement « offline-first » : dès qu'on est en ligne (connexion, retour
// au premier plan), on télécharge d'office TOUT ce dont l'enseignant a besoin
// hors ligne — ses classes, leurs élèves, matières, emplois du temps, les
// périodes et l'appel du jour — sous les mêmes clés que lib/queries.ts.
// Plus besoin d'avoir « déjà ouvert » un écran pour le retrouver sans réseau.

const today = () => new Date().toISOString().slice(0, 10)

export async function preloadTeacherData(): Promise<{ classes: number }> {
  const me = await queryClient.fetchQuery({ queryKey: ['me'], queryFn: async () => (await api.get<Teacher>('/teachers/me')).data, staleTime: 0 })
  const classes = await queryClient.fetchQuery({ queryKey: ['classes'], queryFn: async () => (await api.get<ClassItem[]>('/classes')).data, staleTime: 0 })
  const mine = me.classes?.length ? classes.filter((c) => me.classes.some((mc) => mc.id === c.id)) : classes

  await queryClient.prefetchQuery({
    queryKey: ['periods'],
    queryFn: async () => (await api.get<{ academicYear: { id: string; label: string } | null; periods: Period[] }>('/grades/periods')).data,
    staleTime: 0,
  })

  // Par classe, en parallèle limité (4 classes à la fois) pour ménager le réseau mobile.
  const chunk = 4
  for (let i = 0; i < mine.length; i += chunk) {
    await Promise.all(mine.slice(i, i + chunk).map((c) => Promise.all([
      queryClient.prefetchQuery({ queryKey: ['students', c.id], queryFn: () => fetchClassStudents(c.id), staleTime: 0 }),
      queryClient.prefetchQuery({ queryKey: ['subjects', c.id], queryFn: async () => (await api.get<Subject[]>(`/classes/${c.id}/subjects`)).data, staleTime: 0 }),
      queryClient.prefetchQuery({ queryKey: ['timetable', c.id], queryFn: async () => (await api.get<TimetableSlot[]>('/timetable', { params: { classId: c.id } })).data, staleTime: 0 }),
      queryClient.prefetchQuery({ queryKey: ['attendance', c.id, today()], queryFn: async () => (await api.get<Attendance[]>('/attendance', { params: { classId: c.id, date: today() } })).data, staleTime: 0 }),
    ])))
  }
  return { classes: mine.length }
}
