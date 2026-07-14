import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import client from '@/api/client'
import { useLocalQuery } from '@/lib/db/hooks'
import { queryEntities, saveEntity } from '@/lib/db/offline'
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
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { TrashIcon, ReloadIcon } from '@radix-ui/react-icons'

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' }
]

interface TimetableSlot {
  id: string
  classId: string
  subjectId: string
  subject: { id: string; name: string; code: string | null; level: string | null; class?: { id: string; name: string } | null }
  teacher?: { id: string; user: { firstName: string; lastName: string } } | null
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string | null
}

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().min(1).max(7),
  subjectId: z.string().min(1, 'Matière requise'),
  teacherId: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1, 'Heure de début requise'),
  endTime: z.string().min(1, 'Heure de fin requise'),
  room: z.string().optional().or(z.literal(''))
})

type SlotFormValues = z.infer<typeof slotSchema>

export function TimetablePage() {
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: classes, loading: loadingClasses, refetch: refetchClasses } = useLocalQuery<{ id: string; name: string }>('Class')

  const { data: slots, isLoading: isLoadingSlots } = useQuery<TimetableSlot[]>({
    queryKey: ['timetable', classId],
    enabled: !!classId,
    queryFn: async () => {
      const items = await queryEntities<any>('Timetable', { classId })
      return items ?? []
    }
  })

  const { data: subjects, loading: loadingSubjects, refetch: refetchSubjects } = useLocalQuery<Subject>('Subject')

  const { data: teachers, loading: loadingTeachers, refetch: refetchTeachers } = useLocalQuery<{ id: string; user: { firstName: string; lastName: string } }>('Teacher')

  const isLoading = loadingClasses || isLoadingSlots || loadingSubjects || loadingTeachers

  const handleRefresh = () => {
    refetchClasses()
    refetchSubjects()
    refetchTeachers()
    if (classId) queryClient.invalidateQueries({ queryKey: ['timetable', classId] })
  }

  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      dayOfWeek: 1,
      subjectId: '',
      teacherId: '',
      startTime: '08:00',
      endTime: '09:00',
      room: ''
    }
  })

  function openCreate(day: number) {
    setSelectedDay(day)
    form.reset({
      dayOfWeek: day,
      subjectId: '',
      teacherId: '',
      startTime: '08:00',
      endTime: '09:00',
      room: ''
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SlotFormValues) => {
      await saveEntity('Timetable', {
        id: crypto.randomUUID(),
        classId,
        dayOfWeek: values.dayOfWeek,
        subjectId: values.subjectId,
        teacherId: values.teacherId && values.teacherId !== '__none__' ? values.teacherId : null,
        startTime: values.startTime,
        endTime: values.endTime,
        room: values.room || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable', classId] })
      toast.success('Créneau ajouté (mode hors-ligne)')
      setOpen(false)
    },
    onError: () => toast.error('Erreur lors de l\'ajout du créneau')
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await saveEntity('Timetable', { id, deletedAt: new Date().toISOString() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable', classId] })
      toast.success('Créneau supprimé (mode hors-ligne)')
      setDeleteId(null)
    },
    onError: () => toast.error('Erreur lors de la suppression')
  })

  const timeSlots = Array.from(
    new Set((slots ?? []).map((s) => s.startTime))
  ).sort()

  function slotAt(day: number, time: string) {
    return (slots ?? []).filter((s) => s.dayOfWeek === day && s.startTime === time)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Emploi du temps</h2>
          <p className="text-muted-foreground">Planifiez les cours par classe et par jour.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <ReloadIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
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
        <p className="text-center text-muted-foreground py-12">
          Sélectionnez une classe pour afficher son emploi du temps.
        </p>
      ) : isLoading ? (
        <p className="text-center text-muted-foreground py-12">Chargement...</p>
      ) : (
        <div
          className="grid gap-2 border rounded-lg p-3 bg-card"
          style={{ gridTemplateColumns: `90px repeat(${DAYS.length}, minmax(0, 1fr))` }}
        >
          <div />
          {DAYS.map((d) => (
            <div key={d.value} className="text-center text-sm font-semibold py-2">
              {d.label}
            </div>
          ))}

          {timeSlots.length === 0 && (
            <div
              className="col-span-full text-center text-muted-foreground py-12"
              style={{ gridColumn: `1 / span ${DAYS.length + 1}` }}
            >
              Aucun cours planifié. Cliquez sur un jour pour ajouter un créneau.
            </div>
          )}

          {timeSlots.map((time) => (
            <FragmentRow
              key={time}
              time={time}
              days={DAYS}
              slotAt={slotAt}
              onAdd={openCreate}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
          <ConfirmDialog
            open={!!deleteId}
            onOpenChange={(open) => !open && setDeleteId(null)}
            onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId) }}
            title="Supprimer le créneau"
            description="Êtes-vous sûr de vouloir supprimer ce créneau ? Cette action est irréversible."
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter un créneau</DialogTitle>
            <DialogDescription>
              {DAYS.find((d) => d.value === selectedDay)?.label} — {classId ? 'classe sélectionnée' : ''}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jour</FormLabel>
                      <FormControl>
                        <Combobox
                          value={String(field.value)}
                          onValueChange={(v) => field.onChange(Number(v))}
                          placeholder="Sélectionner"
                          options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
                        />
                      </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matière</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Sélectionner"
                        searchPlaceholder="Rechercher une matière..."
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
                        searchPlaceholder="Rechercher un enseignant..."
                        options={[
                          { value: '__none__', label: 'Aucun' },
                          ...(teachers ?? []).map((t) => ({
                            value: t.id,
                            label: `${t.user.firstName} ${t.user.lastName}`,
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
                      <FormLabel>Début</FormLabel>
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
                      <FormLabel>Fin</FormLabel>
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
              <DialogFooter>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
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

function FragmentRow({
  time,
  days,
  slotAt,
  onAdd,
  onDelete
}: {
  time: string
  days: typeof DAYS
  slotAt: (day: number, time: string) => TimetableSlot[]
  onAdd: (day: number) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-center justify-center text-sm font-medium text-muted-foreground border-t pt-2">
        {time}
      </div>
      {days.map((d) => {
        const cellSlots = slotAt(d.value, time)
        return (
          <div key={d.value} className="border-t pt-2 min-h-[60px] p-1">
            {cellSlots.length === 0 ? (
              <button
                type="button"
                onClick={() => onAdd(d.value)}
                className="w-full h-full min-h-[48px] rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary hover:text-primary text-xs"
              >
                +
              </button>
            ) : (
              cellSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="group relative rounded-md border bg-primary/5 p-2 text-xs"
                >
                  <div className="font-medium">{formatSubjectLabel(slot.subject)}</div>
                  {slot.teacher && (
                    <div className="text-muted-foreground">
                      {slot.teacher.user.firstName} {slot.teacher.user.lastName}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    {slot.startTime} - {slot.endTime}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(slot.id)}
                    className="absolute right-1 top-1 opacity-0 group-hover:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        )
      })}
    </>
  )
}
