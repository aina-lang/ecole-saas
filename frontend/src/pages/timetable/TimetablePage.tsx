import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import { useLocalQuery } from '@/lib/db/hooks'
import type { Subject } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'
import { cn } from '@/lib/utils'
import { generateTimetable } from '@/lib/pdf/timetable'
import { DAYS } from '@/lib/days'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { TrashIcon, RefreshCw, PencilIcon, FileDown, Plus, Coffee, CalendarDays } from 'lucide-react'
import { TimePicker } from '@/components/ui/time-picker'
import { PageHeader, EmptyState } from '@/components/layout/page'

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00',
]

const slotSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1, 'Classe requise'),
  dayOfWeek: z.coerce.number().min(0).max(6),
  subjectId: z.string().optional().or(z.literal('')),
  teacherId: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1, 'Heure de début requise'),
  endTime: z.string().min(1, 'Heure de fin requise'),
  room: z.string().optional().or(z.literal('')),
  isRecreation: z.boolean().optional(),
})

type SlotFormValues = z.infer<typeof slotSchema>

interface TimetableSlot {
  id: string
  classId: string
  dayOfWeek: number
  subjectId: string
  subject?: { id: string; name: string; code?: string | null }
  teacherId?: string | null
  teacher?: { id: string; user: { firstName: string; lastName: string } } | null
  startTime: string
  endTime: string
  room?: string | null
  deletedAt?: string | null
  subjectLabel?: string
  teacherDisplay?: string
  isRecreation?: boolean
}

export function TimetablePage() {
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [open, setOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isRecreationMode, setIsRecreationMode] = useState(false)

  const { data: classes, loading: loadingClasses, refetch: refetchClasses } = useLocalQuery<{ id: string; name: string }>('Class')
  const { data: subjects, loading: loadingSubjects, refetch: refetchSubjects } = useLocalQuery<Subject>('Subject')
  const { data: teachersRaw, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<any>('Teacher')

  const { data: slotsRaw, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['timetable-slots', classId],
    enabled: !!classId,
    queryFn: async () => {
      const items = await queryEntities<any>('TimetableSlot', { classId })
      return (items ?? []).filter((s: any) => !s.deletedAt) as TimetableSlot[]
    },
  })

  const teacherName = (id?: string | null) => {
    if (!id) return ''
    const t = (teachersRaw ?? []).find((t) => t.id === id)
    if (!t) return ''
    const first = (t as any).user_firstName || (t as any).user?.firstName || ''
    const last = (t as any).user_lastName || (t as any).user?.lastName || ''
    return `${first} ${last}`.trim()
  }

  const subjectLabel = (id: string) => {
    const s = (subjects ?? []).find((s) => s.id === id)
    return s ? formatSubjectLabel(s) : id
  }

  const slots = useMemo(() => {
    if (!slotsRaw) return []
    return slotsRaw.map((slot) => ({
      ...slot,
      subjectLabel: subjectLabel(slot.subjectId),
      teacherDisplay: teacherName(slot.teacherId),
    }))
  }, [slotsRaw, subjects, teachersRaw])

  const isLoading = loadingClasses || isLoadingSlots || loadingSubjects || loadingTeachers

  const handleRefresh = () => {
    refetchClasses()
    refetchSubjects()
    refetchTeachers()
    if (classId) queryClient.invalidateQueries({ queryKey: ['timetable-slots', classId] })
  }

  const handleExportPdf = async () => {
    if (!classId || !slots.length) {
      toast.error('Sélectionnez une classe avec des cours')
      return
    }
    const className = (classes ?? []).find((c) => c.id === classId)?.name || 'classe'
    await generateTimetable({ className, slots })
    toast.success('Emploi du temps exporté en PDF')
  }

  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      id: '',
      classId: '',
      dayOfWeek: 1,
      subjectId: '',
      teacherId: '',
      startTime: '08:00',
      endTime: '09:00',
      room: '',
    },
  })

  function openCreate(day: number, time = '08:00') {
    setEditingSlot(null)
    setIsRecreationMode(false)
    form.reset({
      id: '',
      classId,
      dayOfWeek: day,
      subjectId: '',
      teacherId: '',
      startTime: time,
      endTime: `${String(Math.min(23, Number(time.split(':')[0]) + 1)).padStart(2, '0')}:${time.split(':')[1] ?? '00'}`,
      room: '',
    })
    setOpen(true)
  }

  function openEdit(slot: TimetableSlot) {
    setEditingSlot(slot)
    // Le document répliqué peut porter la chaîne 'true' (anciennes écritures) :
    // on compare après conversion, le type déclaré étant booléen.
    setIsRecreationMode(slot.isRecreation === true || String(slot.isRecreation) === 'true')
    form.reset({
      id: slot.id,
      classId: slot.classId,
      dayOfWeek: slot.dayOfWeek,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId || '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || '',
      isRecreation: slot.isRecreation || false,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SlotFormValues) => {
      // Vérifier les chevauchements
      const existing = await queryEntities<TimetableSlot>('TimetableSlot', {
        classId: values.classId,
        dayOfWeek: values.dayOfWeek,
      })
      const startMin = timeToMinutes(values.startTime)
      const endMin = timeToMinutes(values.endTime)
      if (endMin <= startMin) {
        throw new Error("L'heure de fin doit être après l'heure de début")
      }
      const overlap = existing.find((s) => {
        if (s.deletedAt) return false
        if (values.id && s.id === values.id) return false
        const sStart = timeToMinutes(s.startTime)
        const sEnd = timeToMinutes(s.endTime)
        return startMin < sEnd && endMin > sStart
      })
      if (overlap) {
        throw new Error('Ce créneau chevauche un créneau existant')
      }
      const payload: any = {
        id: values.id || crypto.randomUUID(),
        classId: values.classId,
        dayOfWeek: values.dayOfWeek,
        subjectId: values.subjectId,
        teacherId: values.teacherId || null,
        startTime: values.startTime,
        endTime: values.endTime,
        room: values.room || null,
        isRecreation: values.isRecreation || false,
      }
      await saveEntity('TimetableSlot', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] })
      queryClient.invalidateQueries({ queryKey: ['timetable-slots', classId] })
      toast.success(editingSlot ? 'Créneau modifié' : 'Créneau ajouté')
      setOpen(false)
      setEditingSlot(null)
      setIsRecreationMode(false)
    },
    onError: (e) => toast.error(e?.message || 'Erreur lors de l\'enregistrement'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await saveEntity('TimetableSlot', { id, deletedAt: new Date().toISOString() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] })
      toast.success('Créneau supprimé')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const ROW_HEIGHT = 64
  const FIRST_MIN = timeToMinutes(TIME_SLOTS[0])
  const HEADER_H = 44
  const TIME_COL_W = 64
  const LUNCH_TOP = TIME_SLOTS.indexOf('12:00') * ROW_HEIGHT
  const todayDow = new Date().getDay()

  // Une couleur stable par matière (même matière = même teinte partout).
  const SUBJECT_PALETTE = [
    'border-l-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100',
    'border-l-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100',
    'border-l-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100',
    'border-l-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100',
    'border-l-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100',
    'border-l-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100',
    'border-l-fuchsia-500 bg-fuchsia-50 text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100',
    'border-l-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100',
    'border-l-lime-600 bg-lime-50 text-lime-950 dark:bg-lime-950/40 dark:text-lime-100',
    'border-l-cyan-500 bg-cyan-50 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100',
  ]
  const SUBJECT_DOT = ['bg-sky-500','bg-violet-500','bg-emerald-500','bg-rose-500','bg-orange-500','bg-teal-500','bg-fuchsia-500','bg-indigo-500','bg-lime-600','bg-cyan-500']
  const subjectIndex = (id?: string | null) => {
    if (!id) return 0
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return h % SUBJECT_PALETTE.length
  }

  const weekStats = useMemo(() => {
    const courses = slots.filter((s) => !s.isRecreation)
    const minutes = courses.reduce((acc, s) => acc + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0)
    const subjectIds = Array.from(new Set(courses.map((s) => s.subjectId).filter(Boolean)))
    return { courses: courses.length, hours: minutes / 60, subjectIds }
  }, [slots])
  const selectedClassName = (classes ?? []).find((c) => c.id === classId)?.name

  function getSlotsForDay(day: number): TimetableSlot[] {
    const daySlots = slots.filter((s) => s.dayOfWeek === day)
    return daySlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emploi du temps"
        description={selectedClassName ? `${selectedClassName} · ${weekStats.courses} cours · ${weekStats.hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h par semaine` : 'Aperçu des cours par classe'}
        actions={
          <>
            <Combobox
              className="w-[220px]"
              value={classId}
              onValueChange={setClassId}
              placeholder="Sélectionner une classe"
              searchPlaceholder="Rechercher une classe..."
              options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Rafraîchir"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={!classId || !slots.length}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exporter en PDF
            </Button>
          </>
        }
      />

      {!classId ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="Aucune classe sélectionnée"
            description="Choisissez une classe ci-dessus pour afficher et composer son emploi du temps."
          />
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-auto rounded-lg border bg-card">
            <div className="flex min-w-[860px]">
              {/* Colonne des heures */}
              <div className="relative shrink-0 border-r bg-muted/30" style={{ width: TIME_COL_W }}>
                <div className="border-b" style={{ height: HEADER_H }} />
                {TIME_SLOTS.map((time) => (
                  <div
                    key={time}
                    className="relative"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-muted-foreground">{time}</span>
                  </div>
                ))}
                <div className="relative" style={{ height: ROW_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-muted-foreground">19:00</span>
                </div>
              </div>

              {/* Colonnes des jours */}
              <div className="relative flex min-w-0 flex-1">
                {DAYS.map((d, dayIdx) => {
                  const daySlots = getSlotsForDay(d.value)
                  const courseSlots = daySlots.filter((s) => !s.isRecreation)
                  const recreationSlots = daySlots.filter((s) => s.isRecreation)
                  const isToday = d.value === todayDow
                  const dayMinutes = courseSlots.reduce((acc, s) => acc + (timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0)
                  return (
                    <div key={d.value} className={cn('min-w-0 flex-1', dayIdx > 0 && 'border-l', isToday && 'bg-primary/[0.03]')}>
                      <div
                        className={cn('flex items-center justify-between gap-1 border-b px-2', isToday && 'border-b-primary')}
                        style={{ height: HEADER_H }}
                      >
                        <div className="min-w-0">
                          <div className={cn('truncate text-sm font-semibold', isToday && 'text-primary')}>{d.label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {courseSlots.length ? `${courseSlots.length} cours · ${(dayMinutes / 60).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h` : 'Libre'}
                          </div>
                        </div>
                        <button
                          type="button"
                          title="Ajouter une récréation"
                          onClick={() => {
                            setEditingSlot(null)
                            setIsRecreationMode(true)
                            form.reset({ id: '', classId, dayOfWeek: d.value, subjectId: '', teacherId: '', startTime: '09:00', endTime: '10:00', room: '', isRecreation: true })
                            setOpen(true)
                          }}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40 dark:hover:text-amber-300"
                        >
                          <Coffee className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="relative" style={{ height: ROW_HEIGHT * (TIME_SLOTS.length + 1) }}>
                        {/* Lignes d'heures */}
                        {TIME_SLOTS.map((time, i) => (
                          <div key={time} className={cn('border-t', i % 2 === 1 && 'bg-muted/20')} style={{ height: ROW_HEIGHT }} />
                        ))}
                        <div className="border-t" style={{ height: ROW_HEIGHT }} />

                        {/* Pause de midi */}
                        <div
                          className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,hsl(var(--muted))_6px,hsl(var(--muted))_7px)]"
                          style={{ top: LUNCH_TOP, height: ROW_HEIGHT }}
                        >
                          <span className="rounded bg-card/80 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pause</span>
                        </div>

                        {/* Boutons + sur les créneaux libres (visibles au survol) */}
                        {TIME_SLOTS.map((time, i) => {
                          const hourMin = timeToMinutes(time)
                          const occupied = daySlots.some((s) => timeToMinutes(s.startTime) < hourMin + 60 && timeToMinutes(s.endTime) > hourMin)
                          if (occupied) return null
                          return (
                            <button
                              key={`add-${time}`}
                              type="button"
                              onClick={() => openCreate(d.value, time)}
                              aria-label={`Ajouter un cours ${d.label} à ${time}`}
                              className="group/add absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed border-transparent text-xs text-transparent transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
                              style={{ top: i * ROW_HEIGHT + 3, height: ROW_HEIGHT - 6 }}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )
                        })}

                        {/* Cours */}
                        {courseSlots.map((slot) => {
                          const startMin = timeToMinutes(slot.startTime)
                          const endMin = timeToMinutes(slot.endTime)
                          const top = ((startMin - FIRST_MIN) / 60) * ROW_HEIGHT + 2
                          const height = Math.max(((endMin - startMin) / 60) * ROW_HEIGHT - 4, 26)
                          const compact = height < 48
                          return (
                            <div
                              key={slot.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => openEdit(slot)}
                              onKeyDown={(e) => { if (e.key === 'Enter') openEdit(slot) }}
                              className={cn(
                                'group absolute inset-x-1 cursor-pointer select-none overflow-hidden rounded-md border border-black/5 border-l-[3px] px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow-md dark:border-white/5',
                                SUBJECT_PALETTE[subjectIndex(slot.subjectId)],
                              )}
                              style={{ top, height }}
                            >
                              <div className="truncate font-semibold leading-tight">{slot.subjectLabel}</div>
                              {!compact && slot.teacherDisplay && (
                                <div className="truncate leading-tight opacity-80">{slot.teacherDisplay}</div>
                              )}
                              <div className="truncate text-[11px] leading-tight opacity-70">
                                {slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ''}
                              </div>
                              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  aria-label="Modifier"
                                  className="rounded bg-card/90 p-1 shadow-sm hover:bg-card"
                                  onClick={(e) => { e.stopPropagation(); openEdit(slot) }}
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Supprimer"
                                  className="rounded bg-card/90 p-1 text-destructive shadow-sm hover:bg-card"
                                  onClick={(e) => { e.stopPropagation(); setDeleteId(slot.id) }}
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Récréations */}
                        {recreationSlots.map((slot) => {
                          const startMin = timeToMinutes(slot.startTime)
                          const endMin = timeToMinutes(slot.endTime)
                          const top = ((startMin - FIRST_MIN) / 60) * ROW_HEIGHT + 2
                          const height = Math.max(((endMin - startMin) / 60) * ROW_HEIGHT - 4, 22)
                          return (
                            <div
                              key={slot.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => openEdit(slot)}
                              onKeyDown={(e) => { if (e.key === 'Enter') openEdit(slot) }}
                              className="group absolute inset-x-1 flex cursor-pointer select-none items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-amber-400 bg-amber-50/80 px-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                              style={{ top, height }}
                            >
                              <Coffee className="h-3 w-3 shrink-0" />
                              <span className="truncate font-medium">{slot.room || 'Récréation'}</span>
                              <span className="ml-auto shrink-0 text-[11px] opacity-70">{slot.startTime}–{slot.endTime}</span>
                              <button
                                type="button"
                                aria-label="Supprimer"
                                className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-card/90 p-1 text-destructive opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); setDeleteId(slot.id) }}
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {weekStats.subjectIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', SUBJECT_DOT[subjectIndex(id)])} />
                {subjectLabel(id)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-amber-400 bg-amber-50" />
              Récréation
            </span>
            <span className="ml-auto">Survolez un créneau libre pour ajouter un cours · cliquez sur un cours pour le modifier</span>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId) }}
        title="Supprimer le créneau"
        description="Êtes-vous sûr de vouloir supprimer ce créneau ?"
      />

      <Dialog key={String(open)} open={open} onOpenChange={(o) => { if (!o) setIsRecreationMode(false); setOpen(o) }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSlot ? (isRecreationMode ? 'Modifier la récréation' : 'Modifier le cours') : (isRecreationMode ? 'Ajouter une récréation' : 'Ajouter un cours')}</DialogTitle>
            <DialogDescription>
              {DAYS.find((d) => d.value === form.getValues('dayOfWeek'))?.label}
              {classId ? ' · classe sélectionnée' : ''}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              {/* Formulaire « récréation » seulement si on en crée une explicitement
                  ou si le créneau modifié en est une (ou n'a ni matière, ni prof,
                  ni salle). Avant, la dernière condition était vraie aussi à la
                  création d'un cours — le formulaire de cours n'apparaissait jamais. */}
              {(isRecreationMode || editingSlot?.isRecreation === true || (editingSlot as any)?.isRecreation === 'true' || (!!editingSlot && !editingSlot.subjectId && !editingSlot.teacherId && !editingSlot.room)) ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Début *</FormLabel>
                          <FormControl>
                            <TimePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fin *</FormLabel>
                          <FormControl>
                            <TimePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="room"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom (optionnel)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Récréation matin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="subjectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matière *</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner"
                            searchPlaceholder="Rechercher..."
                            options={(subjects ?? []).map((s) => ({
                              value: s.id,
                              label: formatSubjectLabel(s),
                            }))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teacherId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enseignant (optionnel)</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value || '__none__'}
                            onValueChange={(v) => field.onChange(v || '__none__')}
                            placeholder="Aucun"
                            searchPlaceholder="Rechercher..."
                            options={[
                              { value: '__none__', label: 'Aucun' },
                              ...(teachersRaw ?? []).map((t) => ({
                                value: t.id,
                                label: teacherName(t.id) || t.id,
                              })),
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Début *</FormLabel>
                          <FormControl>
                            <TimePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fin *</FormLabel>
                          <FormControl>
                            <TimePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="room"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salle (optionnel)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Salle 12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <input type="hidden" {...form.register('classId')} value={classId} />
              <input type="hidden" {...form.register('dayOfWeek')} />
              <DialogFooter className="gap-2 sm:justify-between">
                {editingSlot ? (
                  <Button type="button" variant="destructive" size="sm" onClick={() => { setDeleteId(editingSlot.id); setOpen(false) }}>
                    <TrashIcon className="mr-1 h-3 w-3" />
                    Supprimer
                  </Button>
                ) : <div />}
                <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : editingSlot ? (
                    'Modifier'
                  ) : (
                    'Ajouter'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  )
}