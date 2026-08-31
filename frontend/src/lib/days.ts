/**
 * Jours de la semaine de l'emploi du temps — source unique partagée entre la
 * grille à l'écran (TimetablePage) et l'export PDF (lib/pdf/timetable) : les
 * deux doivent avoir le même ordre et les mêmes libellés.
 * `value` suit la convention TimetableSlot.dayOfWeek (1 = lundi ... 0 = dimanche).
 */
export const DAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
] as const
