export const EVALUATION_TYPES = [
  'exam',
  'test',
  'homework',
  'oral',
  'project',
  'controle',
  'examen_blanc',
] as const

export type EvaluationType = (typeof EVALUATION_TYPES)[number]

export const EVALUATION_TYPES_UPPER = EVALUATION_TYPES.map((t) => t.toUpperCase())

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  exam: 'Examen',
  test: 'Test',
  homework: 'Devoir',
  oral: 'Oral',
  project: 'Projet',
  controle: 'Contrôle',
  examen_blanc: 'Examen blanc',
}

export function evalTypeToUpper(t: string): string {
  return t.toUpperCase()
}

export function evalTypeToLabel(t: string): string {
  const key = t.toLowerCase() as EvaluationType
  return EVALUATION_TYPE_LABELS[key] || t
}
