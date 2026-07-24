import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { Level, Class, StudentEnrollment, Student } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

type EnrichedEnrollment = StudentEnrollment & { student?: Student }

export function DispatchPage() {
  const queryClient = useQueryClient()
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: () => queryEntities<Level>('Level'),
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedLevelId],
    queryFn: () => queryEntities<Class>('Class', { levelId: selectedLevelId }),
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
    const assignedClassIds = new Set(Object.values(assignments))
    const initiallyAssigned = new Set(
      enrollments.filter((e) => e.classId).map((e) => e.studentId)
    )
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

  const getEffectiveClassId = useCallback(
    (studentId: string) => {
      if (studentId in assignments) return assignments[studentId]
      return enrollments.find((e) => e.studentId === studentId)?.classId
    },
    [assignments, enrollments]
  )

  const hasChanges = useMemo(() => {
    return Object.keys(assignments).length > 0
  }, [assignments])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Répartition des élèves</h2>
          <p className="text-muted-foreground">
            Affecter les élèves aux classes après validation financière
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
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
      </div>

      {selectedLevelId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Élèves non affectés</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px] px-4 pb-4">
                  <div className="space-y-2 pt-2">
                    {unassigned.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Aucun élève en attente
                      </p>
                    )}
                    {unassigned.map((enrollment) => {
                      const s = enrollment.student!
                      const isSelected = selectedStudentId === enrollment.studentId
                      return (
                        <Card
                          key={enrollment.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'ring-2 ring-primary' : 'hover:bg-accent'
                          }`}
                          onClick={() => handleStudentClick(enrollment.studentId)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <span className="text-lg">
                              {s.gender === 'M' ? '♂' : '♀'}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {s.lastName} {s.firstName}
                            </span>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Classes</h3>
              <Button
                variant="secondary"
                onClick={autoRepartir}
                disabled={unassigned.length === 0 || classes.length === 0}
              >
                Auto-répartir
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                        <Badge variant={isFull ? 'destructive' : remaining <= 3 ? 'secondary' : 'outline'}>
                          {count}/{capacity}
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>♂ {bucket.maleCount}</span>
                        <span>♀ {bucket.femaleCount}</span>
                      </div>
                      {bucket.studentIds.length > 0 && (
                        <ScrollArea className="h-[200px] mt-2">
                          <div className="space-y-1">
                            {bucket.studentIds.map((sid) => {
                              const student = studentMap.get(sid)
                              if (!student) return null
                              const cameFromPool =
                                assignments[sid] === bucket.class.id &&
                                !enrollments.find((e) => e.studentId === sid)?.classId
                              return (
                                <div
                                  key={sid}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                                    cameFromPool ? 'bg-green-50 dark:bg-green-950' : ''
                                  }`}
                                >
                                  <span>{student.gender === 'M' ? '♂' : '♀'}</span>
                                  <span className="truncate">{student.lastName} {student.firstName}</span>
                                  {cameFromPool && (
                                    <Badge variant="outline" className="ml-auto text-[10px] py-0 h-5">
                                      nouveau
                                    </Badge>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                      {bucket.studentIds.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          Classe vide
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {classes.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Aucune classe définie pour ce niveau
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!selectedLevelId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez un niveau pour commencer la répartition
          </CardContent>
        </Card>
      )}
    </div>
  )
}
