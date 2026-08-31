import { useEffect, useMemo, useState } from 'react'
import { View, FlatList, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { addDays, format, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Check, X, Clock, FileText, Users, CheckCheck, Minus } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { ScreenHeader, Empty, classColor, CARD_SHADOW } from '@/components/screen'
import { useClasses, useClassStudents, useAttendance, useTimetable, useMe } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { currentSlot, nextSlot, todaySlots } from '@/lib/slots'
import { Lock, CalendarClock } from 'lucide-react-native'
import { SearchBar } from '@/components/search-bar'
import { sendOrQueue } from '@/lib/outbox'
import { errorMessage, getApiUrl, trustedNowIso, trustedNow } from '@/lib/api'
import { initials, photoUri } from '@/lib/utils'
import { useThemeColors } from '@/lib/theme-colors'
import { useDialog } from '@/components/ui/dialog'
import type { AttendanceStatus } from '@/lib/types'

const STATUSES: { value: AttendanceStatus; label: string; icon: typeof Check; bg: string; fg: string }[] = [
  { value: 'PRESENT', label: 'Présent', icon: Check, bg: '#D1FAE5', fg: '#047857' },
  { value: 'ABSENT', label: 'Absent', icon: X, bg: '#FEE2E2', fg: '#B91C1C' },
  { value: 'LATE', label: 'Retard', icon: Clock, bg: '#FEF3C7', fg: '#B45309' },
  { value: 'EXCUSED', label: 'Excusé', icon: FileText, bg: '#E2E8F0', fg: '#334155' },
]

export default function AttendanceScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>()
  const router = useRouter()
  const colors = useThemeColors()
  const { toast, alert } = useDialog()
  const cls = useClasses().data?.find((c) => c.id === classId)
  const color = classColor(classId ?? '')
  const [date, setDate] = useState(() => new Date())
  const dateKey = format(date, 'yyyy-MM-dd')
  const { data: students, isLoading } = useClassStudents(classId)
  const { data: existingAll } = useAttendance(classId, dateKey)
  const role = useAuth((s) => s.user?.role)
  const isTeacher = role === 'TEACHER'
  const me = useMe().data
  const { data: slots } = useTimetable(classId)
  // Enseignant : l'appel n'est possible que pendant SON cours de cette classe
  // (règle aussi appliquée par le serveur). Admin : libre, avec la date.
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((v) => v + 1), 30000); return () => clearInterval(t) }, [])
  const nowDate = new Date(trustedNow())
  const slot = isTeacher ? currentSlot(slots ?? [], me?.id, nowDate) : null
  const upcoming = isTeacher ? nextSlot(slots ?? [], me?.id, nowDate) : null
  const mySlotsToday = isTeacher ? todaySlots(slots ?? [], me?.id, nowDate) : []
  const locked = isTeacher && !slot
  // Avec un créneau : on ne considère que l'appel de CE cours.
  const existing = slot ? (existingAll ?? []).filter((a: any) => !a.timetableSlotId || a.timetableSlotId === slot.id) : existingAll
  // null = non marqué (par défaut) ; seuls les élèves marqués sont envoyés.
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>({})
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const visible = useMemo(() => { const t = q.trim().toLowerCase(); return t ? (students ?? []).filter((s) => `${s.lastName} ${s.firstName ?? ''} ${s.registrationNumber ?? ''}`.toLowerCase().includes(t)) : students ?? [] }, [students, q])

  useEffect(() => {
    const next: Record<string, AttendanceStatus | null> = {}
    for (const s of students ?? []) next[s.id] = null
    for (const a of existing ?? []) if ((a.status as string) !== 'HOLIDAY') next[a.studentId] = a.status
    setMarks(next)
  }, [students, existing, dateKey])

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNMARKED: 0 } as Record<AttendanceStatus | 'UNMARKED', number>
    for (const v of Object.values(marks)) c[v ?? 'UNMARKED']++
    return c
  }, [marks])
  const marked = (students ?? []).filter((s) => marks[s.id]).length

  // Non marqué → Présent → Absent → Retard → Excusé → Non marqué
  function cycle(id: string) {
    setMarks((m) => {
      const cur = m[id] ?? null
      if (!cur) return { ...m, [id]: STATUSES[0].value }
      const i = STATUSES.findIndex((s) => s.value === cur)
      return { ...m, [id]: i >= STATUSES.length - 1 ? null : STATUSES[i + 1].value }
    })
  }
  function setAll(status: AttendanceStatus | null) {
    setMarks(Object.fromEntries((students ?? []).map((s) => [s.id, status])))
  }

  async function save() {
    if (!students?.length || !marked || locked) return
    setSaving(true)
    try {
      const sent = await sendOrQueue({
        kind: 'attendance',
        label: `Appel ${cls?.name ?? ''} du ${format(date, 'dd/MM/yyyy')}`,
        method: 'post',
        url: '/attendance/bulk',
        // recordedAt : moment de la SAISIE (horloge alignée serveur). Un appel
        // fait hors ligne pendant le cours reste valide même envoyé plus tard.
        body: { date: dateKey, recordedAt: trustedNowIso(), records: students.filter((s) => marks[s.id]).map((s) => ({ studentId: s.id, classId, status: marks[s.id]!, ...(slot ? { timetableSlotId: slot.id, subjectId: slot.subject?.id ?? undefined } : {}) })) },
        invalidate: [['attendance', classId, dateKey]],
      })
      toast({ type: sent ? 'success' : 'warning', title: sent ? 'Appel enregistré' : 'Appel mis en attente', message: sent ? `${counts.ABSENT} absent(s), ${counts.LATE} retard(s).` : 'Envoi automatique dès que le réseau revient.' })
      router.back()
    } catch (err) {
      await alert({ title: 'Erreur', message: errorMessage(err), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero back title="Appel" subtitle={cls?.name} className="pb-20" style={{ backgroundColor: color }}>
        {isTeacher ? (
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-white/15 px-4 py-2.5">
            <CalendarClock size={18} color="#fff" />
            <View className="flex-1">
              <Text className="font-semibold capitalize text-white">{format(date, 'EEEE d MMMM', { locale: fr })}</Text>
              <Text className="text-[12px] text-white/80" numberOfLines={1}>
                {slot ? `${slot.subject?.name ?? 'Cours'} · ${slot.startTime}–${slot.endTime}` : upcoming ? `Prochain cours ${upcoming.startTime}–${upcoming.endTime} (${upcoming.subject?.name ?? ''})` : 'Aucun cours avec cette classe aujourd’hui'}
              </Text>
            </View>
          </View>
        ) : (
          <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-white/15 px-1.5 py-1.5">
            <Pressable onPress={() => setDate((d) => addDays(d, -1))} className="h-9 w-9 items-center justify-center rounded-full active:bg-white/20" hitSlop={6}><ChevronLeft size={20} color="#fff" /></Pressable>
            <View className="items-center">
              <Text className="font-semibold capitalize text-white">{format(date, 'EEEE d MMMM', { locale: fr })}</Text>
              {isToday(date) ? <Text className="text-[11px] text-white/75">Aujourd'hui</Text> : null}
            </View>
            <Pressable onPress={() => setDate((d) => addDays(d, 1))} className="h-9 w-9 items-center justify-center rounded-full active:bg-white/20" hitSlop={6}><ChevronRight size={20} color="#fff" /></Pressable>
          </View>
        )}
      </ScreenHeader>

      {/* Compteurs à cheval sur le bandeau */}
      <View className="-mt-12 mx-4 flex-row rounded-2xl border border-border bg-card p-2">
        {STATUSES.map((s, i) => (
          <View key={s.value} className={`flex-1 items-center py-1.5 ${i > 0 ? 'border-l border-border' : ''}`}>
            <Text className="text-xl font-bold" style={{ color: s.fg }}>{counts[s.value]}</Text>
            <Text className="text-[11px] text-muted-foreground">{s.label}</Text>
          </View>
        ))}
      </View>

      {locked ? (
        <View className="flex-1 px-6 pt-8">
          <View style={CARD_SHADOW} className="items-center rounded-2xl bg-card p-6">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Lock size={26} color="#475569" /></View>
            <Text className="text-center text-base font-semibold">Appel verrouillé</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-muted-foreground">
              L'appel n'est possible que pendant votre cours avec cette classe (± 15 min).
            </Text>
            {mySlotsToday.length > 0 ? (
              <View className="mt-4 w-full gap-1.5">
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">Vos cours aujourd'hui</Text>
                {mySlotsToday.map((sl) => (
                  <View key={sl.id} className="flex-row items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <Text className="text-sm font-medium">{sl.subject?.name ?? 'Cours'}</Text>
                    <Text className="text-sm text-muted-foreground">{sl.startTime}–{sl.endTime}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="mt-3 text-center text-xs text-muted-foreground">Aucun cours avec cette classe aujourd'hui.</Text>
            )}
          </View>
        </View>
      ) : null}
      {!locked && (
      <FlatList
        showsVerticalScrollIndicator={false}
        data={visible}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
        ListHeaderComponent={
          <View className="mb-3 gap-2">
          <SearchBar value={q} onChange={setQ} placeholder="Rechercher un élève…" />
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">{counts.UNMARKED} non marqué{counts.UNMARKED > 1 ? 's' : ''} · touchez pour changer</Text>
            <View className="flex-row gap-1.5">
              <Pressable onPress={() => setAll('PRESENT')} className="flex-row items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1">
                <CheckCheck size={13} color="#047857" /><Text className="text-[11px] font-semibold text-emerald-700">Tous présents</Text>
              </Pressable>
              {marked > 0 && (
                <Pressable onPress={() => setAll(null)} className="flex-row items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1">
                  <Minus size={13} color="#334155" /><Text className="text-[11px] font-semibold text-slate-700">Effacer</Text>
                </Pressable>
              )}
            </View>
          </View>
          </View>
        }
        ListEmptyComponent={!isLoading ? <Empty icon={Users} title={q ? 'Aucun élève ne correspond' : 'Aucun élève'} /> : null}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: s, index }) => {
          const st = STATUSES.find((x) => x.value === marks[s.id]) ?? null
          const Icon = st?.icon ?? Minus
          const absent = !!st && st.value !== 'PRESENT'
          return (
            <Pressable onPress={() => cycle(s.id)} style={absent ? [CARD_SHADOW, { borderColor: st!.fg + '55' }] : CARD_SHADOW} className={`flex-row items-center gap-3 rounded-2xl bg-card px-3 py-2.5 active:opacity-90 ${absent ? 'border' : ''} ${st ? '' : 'opacity-80'}`}>
              <Text className="w-5 text-xs text-muted-foreground">{index + 1}</Text>
              <Avatar uri={photoUri(s.photoUrl, getApiUrl())} initials={initials(s.firstName, s.lastName)} size={38} />
              <Text className="flex-1 font-medium" numberOfLines={1}>{s.lastName.toUpperCase()} {s.firstName ?? ''}</Text>
              <View style={{ backgroundColor: st?.bg ?? '#F1F5F9' }} className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${st ? '' : 'border border-dashed border-slate-300'}`}>
                <Icon size={14} color={st?.fg ?? '#64748B'} />
                <Text className="text-xs font-semibold" style={{ color: st?.fg ?? '#64748B' }}>{st?.label ?? 'Non marqué'}</Text>
              </View>
            </Pressable>
          )
        }}
      />
      )}
      {!locked && (
      <View style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 10 }} className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-border bg-card px-4 pb-8 pt-4">
        <Button label={marked ? (existing?.length ? `Mettre à jour (${marked} élève${marked > 1 ? 's' : ''})` : `Enregistrer l'appel (${marked}/${students?.length ?? 0})`) : 'Marquez au moins un élève'} loading={saving} disabled={!marked} onPress={save} size="lg" className="rounded-xl" style={marked ? { backgroundColor: color } : undefined} />
      </View>
      )}
    </View>
  )
}
