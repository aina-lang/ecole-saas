import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { Level, Class, StudentEnrollment, Student } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export function DispatchPage() {
  const queryClient = useQueryClient()
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: () => queryEntities<Level>('Level'),
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedLevelId, levels.length],
    // Par levelId OU par nom de niveau : les classes créées avant le
    // référentiel des niveaux ne portent que le nom (« 6ème »).
    queryFn: async () => {
      const all = await queryEntities<Class & { level?: string | null; levelId?: string | null; deletedAt?: string | null }>('Class')
      const lvl = (levels ?? []).find((l) => l.id === selectedLevelId)
      return all.filter((c) => !c.deletedAt && (c.levelId === selectedLevelId || (!!lvl && c.level === lvl.name)))
    },
    enabled: !!selectedLevelId,
  })

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => queryEntities<StudentEnrollment>('StudentEnrollment' as any),
  })

  const { data: allStudents = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => queryEntities<Student>('Student'),
  })

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>()
    for (const s of allStudents) {
      map.set(s.id, s)
    }
    return map
  }, [allStudents])

  const enrollments = useMemo(() => {
    return allEnrollments.filter((e) => e.levelId === selectedLevelId && e.reinscriptionStatus === 'INSCRIT_ACTIF')
  }, [allEnrollments, selectedLevelId])

  const unassigned = useMemo(() => {
    return enrollments
      .filter((e) => {
        if (e.classId && !(e.studentId in assignments)) return false
        return !e.classId || (e.studentId in assignments && !assignments[e.studentId])
      })
      .filter((e) => {
        const targetClassId = assignments[e.studentId]
        return !targetClassId || targetClassId === ''
      })
      .map((e) => ({
        ...e,
        student: studentMap.get(e.studentId),
      }))
      .filter((e) => e.student)
  }, [enrollments, assignments, studentMap])

  const classBuckets = useMemo(() => {
    return classes.map((c) => {
      const assignedIds = enrollments
        .filter((e) => {
          const manual = assignments[e.studentId]
          if (manual !== undefined) return manual === c.id
          return e.classId === c.id
        })
        .map((e) => e.studentId)
      const assignedStudents = assignedIds
        .map((id) => ({ id, student: studentMap.get(id) }))
        .filter((s) => s.student)
      const maleCount = assignedStudents.filter((s) => s.student!.gender === 'M').length
      const femaleCount = assignedStudents.filter((s) => s.student!.gender === 'F').length
      return {
        class: c,
        studentIds: assignedIds,
        studentCount: assignedIds.length,
        maleCount,
        femaleCount,
      }
    })
  }, [classes, enrollments, assignments, studentMap])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const affectedEnrollments = enrollments.filter((e) => {
        const target = assignments[e.studentId]
        return target !== undefined && target !== e.classId
      })
      for (const enrollment of affectedEnrollments) {
        const newClassId = assignments[enrollment.studentId] || null
        await saveEntity('StudentEnrollment' as any, {
          ...enrollment,
          classId: newClassId,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      toast.success('Affectations enregistrées')
      setAssignments({})
      setSelectedStudentId(null)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const autoRepartir = useCallback(() => {
    const pool = unassigned
    if (pool.length === 0 || classes.length === 0) return

    const currentAssignments: Record<string, string> = {}
    for (const enrollment of enrollments) {
      if (enrollment.classId) {
        currentAssignments[enrollment.studentId] = enrollment.classId
      }
    }

    const males = pool.filter((e) => e.student?.gender === 'M')
    const females = pool.filter((e) => e.student?.gender === 'F')

    const classCapacities = classes.map((c) => {
      const currentCount = classBuckets.find((b) => b.class.id === c.id)?.studentCount ?? 0
      return { id: c.id, capacity: c.capacity, currentCount }
    })

    const remainingSlots = classCapacities.map((c) => ({
      id: c.id,
      remaining: c.capacity - c.currentCount,
    }))
    const totalRemaining = remainingSlots.reduce((s, r) => s + r.remaining, 0)
    if (totalRemaining < pool.length) {
      toast.error('Capacité insuffisante dans les classes')
      return
    }

    const maleSlots = remainingSlots.map((r) => ({
      id: r.id,
      target: Math.round((r.remaining / totalRemaining) * males.length),
    }))
    let maleAssigned = maleSlots.reduce((s, m) => s + m.target, 0)
    let diff = males.length - maleAssigned
    for (let i = 0; diff !== 0 && i < maleSlots.length; i++) {
      const adjust = Math.sign(diff)
      maleSlots[i].target += adjust
      diff -= adjust
    }

    const femaleSlots = remainingSlots.map((r) => ({
      id: r.id,
      target: Math.round((r.remaining / totalRemaining) * females.length),
    }))
    let femaleAssigned = femaleSlots.reduce((s, f) => s + f.target, 0)
    diff = females.length - femaleAssigned
    for (let i = 0; diff !== 0 && i < femaleSlots.length; i++) {
      const adjust = Math.sign(diff)
      femaleSlots[i].target += adjust
      diff -= adjust
    }

    const newAssignments: Record<string, string> = { ...currentAssignments }
    let maleIdx = 0
    for (const slot of maleSlots) {
      for (let i = 0; i < slot.target && maleIdx < males.length; i++) {
        newAssignments[males[maleIdx].studentId] = slot.id
        maleIdx++
      }
    }
    let femaleIdx = 0
    for (const slot of femaleSlots) {
      for (let i = 0; i < slot.target && femaleIdx < females.length; i++) {
        newAssignments[females[femaleIdx].studentId] = slot.id
        femaleIdx++
      }
    }

    setAssignments(newAssignments)
    toast.success('Répartition automatique effectuée')
  }, [unassigned, classes, enrollments, classBuckets])

  const handleStudentClick = useCallback((studentId: string) => {
    setSelectedStudentId((prev) => (prev === studentId ? null : studentId))
  }, [])

  const handleClassClick = useCallback(
    (classId: string) => {
      if (!selectedStudentId) return
      setAssignments((prev) => {
        if (prev[selectedStudentId] === classId) {
          const next = { ...prev }
          delete next[selectedStudentId]
          return next
        }
        return { ...prev, [selectedStudentId]: classId }
      })
      setSelectedStudentId(null)
    },
    [selectedStudentId]
  )

  const hasChanges = useMemo(() => {
    return Object.keys(assignments).length > 0
  }, [assignments])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Répartition des élèves"
        description="Affecter les élèves aux classes après validation financière"
        actions={
          hasChanges ? (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <div className="w-72">
          <Select value={selectedLevelId} onValueChange={(v) => { setSelectedLevelId(v); setSelectedStudentId(null); setAssignments({}) }}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un niveau" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedLevelId && (
          <Badge variant="outline" className="text-sm">
            {unassigned.length} élève{unassigned.length !== 1 ? 's' : ''} non affecté{unassigned.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </FilterBar>

      {selectedLevelId && (
        <div className="space-y-5">
          {/* File d'attente : en bandeau, élèves sous forme de puces sélectionnables */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Élèves non affectés</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStudentId
                      ? `${(studentMap.get(selectedStudentId)?.lastName ?? '')} ${(studentMap.get(selectedStudentId)?.firstName ?? '')} sélectionné — cliquez sur la classe de destination (ou re-cliquez l’élève pour annuler).`
                      : unassigned.length === 0
                        ? 'Tous les élèves de ce niveau ont une classe. Cliquez sur un élève dans une classe, puis sur une autre classe pour le déplacer.'
                        : 'Cliquez sur un élève (en attente ou déjà placé), puis sur une classe pour l’y déplacer.'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={autoRepartir}
                  disabled={unassigned.length === 0 || classes.length === 0}
                >
                  Auto-répartir
                </Button>
              </div>
              {unassigned.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {unassigned.map((enrollment) => {
                    const st = enrollment.student!
                    const isSelected = selectedStudentId === enrollment.studentId
                    return (
                      <button
                        key={enrollment.id}
                        type="button"
                        onClick={() => handleStudentClick(enrollment.studentId)}
                        className={cn(
                          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                        )}
                      >
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold', isSelected ? 'bg-white/20 text-white' : st.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700')}>{st.gender === 'M' ? 'G' : 'F'}</span>
                        {st.lastName} {st.firstName}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Classes</h3>
              <p className="text-sm text-muted-foreground">{classBuckets.length} classe{classBuckets.length > 1 ? 's' : ''} · {classBuckets.reduce((n, b) => n + b.studentCount, 0)} élèves placés</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {classBuckets.map((bucket) => {
                const capacity = bucket.class.capacity
                const count = bucket.studentCount
                const isFull = count >= capacity
                const remaining = capacity - count
                const fillPercent = Math.min((count / capacity) * 100, 100)

                return (
                  <Card
                    key={bucket.class.id}
                    className={`cursor-pointer transition-colors ${
                      selectedStudentId ? 'hover:border-primary hover:shadow-md' : ''
                    } ${isFull ? 'opacity-80' : ''}`}
                    onClick={() => handleClassClick(bucket.class.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{bucket.class.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-transparent tabular-nums',
                            isFull
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              : remaining <= 3
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {count}/{capacity}
                        </Badge>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isFull ? 'bg-red-500' : remaining <= 3 ? 'bg-amber-500' : 'bg-primary',
                          )}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isFull ? 'Classe complète' : `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
                      </p>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{bucket.maleCount} garçon{bucket.maleCount > 1 ? 's' : ''}</span>
                        <span>{bucket.femaleCount} fille{bucket.femaleCount > 1 ? 's' : ''}</span>
                      </div>
                      {bucket.studentIds.length > 0 && (() => {
                        const isOpen = expanded.has(bucket.class.id)
                        const LIMIT = 30
                        const visible = isOpen ? bucket.studentIds : bucket.studentIds.slice(0, LIMIT)
                        const hidden = bucket.studentIds.length - visible.length
                        return (
                          <div className="mt-3 rounded-md border">
                            <ul className="grid grid-cols-1 sm:grid-cols-2">
                              {visible.map((sid, idx) => {
                                const student = studentMap.get(sid)
                                if (!student) return null
                                const cameFromPool =
                                  assignments[sid] === bucket.class.id &&
                                  !enrollments.find((e) => e.studentId === sid)?.classId
                                return (
                                  <li
                                    key={sid}
                                    role="button"
                                    tabIndex={0}
                                    title="Cliquer pour sélectionner, puis cliquer sur une autre classe pour déplacer"
                                    onClick={(e) => { e.stopPropagation(); handleStudentClick(sid) }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleStudentClick(sid) } }}
                                    className={cn(
                                      'group flex cursor-pointer items-center gap-2 border-b px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/60 sm:[&:nth-child(2n)]:border-l',
                                      cameFromPool && 'bg-primary/5',
                                      selectedStudentId === sid && 'bg-primary/15 ring-1 ring-inset ring-primary',
                                    )}
                                  >
                                    <span className="w-5 text-right text-[11px] tabular-nums text-muted-foreground">{idx + 1}</span>
                                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', student.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700')}>{student.gender === 'M' ? 'G' : 'F'}</span>
                                    <span className="min-w-0 flex-1 truncate" title={`${student.lastName} ${student.firstName}`}>{student.lastName} {student.firstName}</span>
                                    {cameFromPool && (
                                      <Badge variant="outline" className="h-5 border-transparent bg-primary/10 py-0 text-[10px] text-primary">nouveau</Badge>
                                    )}
                                    <button
                                      type="button"
                                      title="Ouvrir la fiche élève"
                                      aria-label="Ouvrir la fiche élève"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/students/${sid}`) }}
                                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                            {(hidden > 0 || isOpen) && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setExpanded((prev) => { const n = new Set(prev); if (n.has(bucket.class.id)) n.delete(bucket.class.id); else n.add(bucket.class.id); return n }) }}
                                className="w-full border-t px-2.5 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted/60"
                              >
                                {isOpen ? 'Réduire' : `Afficher les ${hidden} autres`}
                              </button>
                            )}
                          </div>
                        )
                      })()}
                      {bucket.studentIds.length === 0 && (
                        <EmptyState title="Classe vide" description="Cliquez sur un élève en attente puis sur cette classe pour l'y placer." className="py-5" />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {classes.length === 0 && (
              <Card>
                <CardContent>
                  <EmptyState
                    title="Aucune classe"
                    description="Aucune classe définie pour ce niveau."
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!selectedLevelId && (
        <Card>
          <CardContent>
            <EmptyState
              title="Aucun niveau sélectionné"
              description="Sélectionnez un niveau pour commencer la répartition."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
