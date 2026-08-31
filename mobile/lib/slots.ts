import type { TimetableSlot } from './types'
import { toMinutes } from './days'

/** Tolérance avant/après le créneau (minutes) — identique au serveur. */
export const SLOT_TOLERANCE_MIN = 15

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Créneaux de l'enseignant (ou tous si admin) pour aujourd'hui, triés. */
export function todaySlots(slots: TimetableSlot[], teacherId?: string | null, d = new Date()): TimetableSlot[] {
  const day = d.getDay()
  return slots
    .filter((s) => s.dayOfWeek === day && !s.isRecreation && !(!s.subject && /r[ée]cr[ée]/i.test(s.room ?? '')) && (!teacherId || s.teacherId === teacherId))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}

/** Le créneau en cours (avec tolérance), sinon null. */
export function currentSlot(slots: TimetableSlot[], teacherId?: string | null, d = new Date()): TimetableSlot | null {
  const m = nowMinutes(d)
  return todaySlots(slots, teacherId, d).find((s) => m >= toMinutes(s.startTime) - SLOT_TOLERANCE_MIN && m <= toMinutes(s.endTime) + SLOT_TOLERANCE_MIN) ?? null
}

/** Le prochain créneau d'aujourd'hui pas encore commencé, sinon null. */
export function nextSlot(slots: TimetableSlot[], teacherId?: string | null, d = new Date()): TimetableSlot | null {
  const m = nowMinutes(d)
  return todaySlots(slots, teacherId, d).find((s) => toMinutes(s.startTime) - SLOT_TOLERANCE_MIN > m) ?? null
}
