import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { queryEntities, saveEntity, deleteEntity } from '@/lib/db/pouchdb-compat'
import { useLocalQuery } from '@/lib/db/hooks'
import type { Subject } from '@/types'
import { formatSubjectLabel } from '@/lib/subject'
import { cn } from '@/lib/utils'

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
import { TrashIcon, RefreshCw, PlusIcon, PencilIcon, FileDown } from 'lucide-react'

const DAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
]

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00',
]

const slotSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1, 'Classe requise'),
  dayOfWeek: z.coerce.number().min(0).max(6),
  subjectId: z.string().min(1, 'Matière requise'),
  teacherId: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1, 'Heure de début requise'),
  endTime: z.string().min(1, 'Heure de fin requise'),
  room: z.string().optional().or(z.literal('')),
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
}

export function TimetablePage() {
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [open, setOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  const handleExportPdf = () => {
    if (!classId || !slots.length) {
      toast.error('Sélectionnez une classe avec des cours')
      return
    }
    const className = (classes ?? []).find((c) => c.id === classId)?.name || 'classe'
    const rows = DAYS.map((d) => {
      const daySlots = slots.filter((s) => s.dayOfWeek === d.value).sort((a, b) => a.startTime.localeCompare(b.startTime))
      const cells = daySlots.map((s) => `${s.startTime}-${s.endTime}: ${s.subjectLabel}${s.teacherDisplay ? ` (${s.teacherDisplay})` : ''}${s.room ? ` [${s.room}]` : ''}`).join('\n')
      return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">${d.label}</td><td style="padding:8px;border:1px solid #ddd;white-space:pre-line">${cells || '-'}</td></tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Emploi du temps - ${className}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head><body>
<h1>Emploi du temps - ${className}</h1>
<table><thead><tr><th>Jour</th><th>Cours</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => {
        win.print()
        URL.revokeObjectURL(url)
      }
    } else {
      URL.revokeObjectURL(url)
      toast.error('Popup bloquée. Autorisez les popups pour exporter le PDF.')
    }
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
    form.reset({
      id: '',
      classId,
      dayOfWeek: day,
      subjectId: '',
      teacherId: '',
      startTime: time,
      endTime: '09:00',
      room: '',
    })
    setOpen(true)
  }

  function openEdit(slot: TimetableSlot) {
    setEditingSlot(slot)
    form.reset({
      id: slot.id,
      classId: slot.classId,
      dayOfWeek: slot.dayOfWeek,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId || '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || '',
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SlotFormValues) => {
      const payload: any = {
        id: values.id || crypto.randomUUID(),
        classId: values.classId,
        dayOfWeek: values.dayOfWeek,
        subjectId: values.subjectId,
        teacherId: values.teacherId || null,
        startTime: values.startTime,
        endTime: values.endTime,
        room: values.room || null,
      }
      await saveEntity('TimetableSlot', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] })
      toast.success(editingSlot ? 'Créneau modifié' : 'Créneau ajouté')
      setOpen(false)
      setEditingSlot(null)
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
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

  function getSlotsForDay(day: number): TimetableSlot[] {
    const daySlots = slots.filter((s) => s.dayOfWeek === day)
    return daySlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  }

  function hasSlotAtHour(day: number, hour: string): boolean {
    return slots.some((s) => s.dayOfWeek === day && s.startTime === hour)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Emploi du temps</h2>
          <p className="text-muted-foreground">Aperçu des cours par classe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExportPdf}
            disabled={!classId || !slots.length}
            title="Générer PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <div className="w-56">
            <Combobox
              value={classId}
              onValueChange={setClassId}
              placeholder="Sélectionner une classe"
              searchPlaceholder="Rechercher une classe..."
              options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </div>
      </div>

      {!classId ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Sélectionnez une classe pour afficher l'emploi du temps
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <div className="flex min-w-[800px]">
            {/* Time column */}
            <div className="shrink-0" style={{ width: 56 }}>
              <div className="border-b" style={{ height: 40 }} />
              {TIME_SLOTS.map((time) => (
                <div
                  key={time}
                  className="border-t flex items-start justify-center text-xs text-muted-foreground pt-0.5"
                  style={{ height: ROW_HEIGHT }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((d) => {
              const daySlots = getSlotsForDay(d.value)
              return (
                <div key={d.value} className="flex-1 min-w-0">
                  <div className="border-b border-l p-2 text-center text-sm font-semibold truncate" style={{ height: 40 }}>
                    {d.short}
                  </div>
                  <div className="relative" style={{ height: ROW_HEIGHT * TIME_SLOTS.length }}>
                    {/* Hour grid lines */}
                    {TIME_SLOTS.map((time) => (
                      <div
                        key={time}
                        className="border-l border-t"
                        style={{ height: ROW_HEIGHT }}
                      />
                    ))}

                    {/* "+" buttons at hour marks */}
                    {TIME_SLOTS.map((time, i) => {
                      if (i === TIME_SLOTS.length - 1) return null
                      const hasSlot = hasSlotAtHour(d.value, time)
                      return (
                        <button
                          key={`add-${time}`}
                          type="button"
                          onClick={() => openCreate(d.value, time)}
                          className="absolute left-1 right-1 rounded-md border border-dashed border-muted-foreground/20 text-muted-foreground/30 hover:border-primary hover:text-primary text-xs transition-colors"
                          style={{
                            top: i * ROW_HEIGHT + 4,
                            height: ROW_HEIGHT - 8,
                            display: hasSlot ? 'none' : 'block',
                          }}
                        >
                          +
                        </button>
                      )
                    })}

                    {/* Cards */}
                    {daySlots.map((slot) => {
                      const startMin = timeToMinutes(slot.startTime)
                      const endMin = timeToMinutes(slot.endTime)
                      const top = ((startMin - FIRST_MIN) / 60) * ROW_HEIGHT
                      const height = Math.max(((endMin - startMin) / 60) * ROW_HEIGHT, 24)

                      return (
                        <div
                          key={slot.id}
                          className="group absolute left-1 right-1 rounded-md border bg-primary/10 p-1.5 text-xs select-none overflow-hidden transition-shadow hover:shadow-md"
                          style={{ top, height }}
                        >
                          <div className="flex items-start gap-1 h-full">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate leading-tight">{slot.subjectLabel}</div>
                              {slot.teacherDisplay && (
                                <div className="text-muted-foreground truncate leading-tight">
                                  {slot.teacherDisplay}
                                </div>
                              )}
                              <div className="text-muted-foreground leading-tight">
                                {slot.startTime} - {slot.endTime}
                                {slot.room ? ` · ${slot.room}` : ''}
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={(e) => { e.stopPropagation(); openEdit(slot) }}
                              >
                                <PencilIcon className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={(e) => { e.stopPropagation(); setDeleteId(slot.id) }}
                              >
                                <TrashIcon className="h-2.5 w-2.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Modifier le créneau' : 'Ajouter un créneau'}</DialogTitle>
            <DialogDescription>
              {DAYS.find((d) => d.value === form.getValues('dayOfWeek'))?.label}
              {classId ? ' · classe sélectionnée' : ''}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
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
                        <Input type="time" {...field} />
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
                        <Input type="time" {...field} />
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
              <input type="hidden" {...form.register('classId')} value={classId} />
              <input type="hidden" {...form.register('dayOfWeek')} />
              <DialogFooter>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId) }}
        title="Supprimer le créneau"
        description="Êtes-vous sûr de vouloir supprimer ce créneau ?"
      />
    </div>
  )
}