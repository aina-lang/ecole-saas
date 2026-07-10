export interface SubjectLike {
  name: string
  code?: string | null
  level?: string | null
  class?: { id?: string; name?: string } | null
  className?: string | null
}

export function formatSubjectLabel(subject: SubjectLike): string {
  const parts: string[] = []
  if (subject.code) parts.push(subject.code)
  if (subject.level) parts.push(subject.level)
  const className = subject.class?.name ?? subject.className
  if (className) parts.push(className)
  return parts.length ? parts.join(' - ') : subject.name
}
