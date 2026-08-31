import { useMemo, useState } from 'react'
import { View, ScrollView, Pressable, RefreshControl } from 'react-native'
import { CalendarX2, MapPin } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { ScreenHeader, Empty, Card, classColor } from '@/components/screen'
import { useMyClasses, useTimetable, useMe } from '@/lib/queries'
import { DAYS, toMinutes } from '@/lib/days'
import { useThemeColors } from '@/lib/theme-colors'

export default function TimetableScreen() {
  const colors = useThemeColors()
  const { data: classes, refetch: refetchClasses } = useMyClasses()
  const me = useMe().data
  const [classId, setClassId] = useState<string>('')
  const effClass = classId || classes[0]?.id
  const { data: slots, isLoading, isFetching, refetch } = useTimetable(effClass)
  const today = new Date().getDay()
  const color = classColor(effClass ?? '')

  const byDay = useMemo(() => {
    const m = new Map<number, NonNullable<typeof slots>>()
    for (const s of slots ?? []) {
      // Récréation : indicateur explicite OU créneau sans matière nommé « Récréation ».
      if (s.isRecreation || (!s.subject && /r[ée]cr[ée]/i.test(s.room ?? ''))) continue
      if (!m.has(s.dayOfWeek)) m.set(s.dayOfWeek, [])
      m.get(s.dayOfWeek)!.push(s)
    }
    for (const list of m.values()) list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    return m
  }, [slots])
  const isBreak = (s: { isRecreation?: boolean; subject?: unknown; room?: string | null }) => !!s.isRecreation || (!s.subject && /r[ée]cr[ée]/i.test(s.room ?? ''))
  const total = (slots ?? []).filter((s) => !isBreak(s)).length
  const hours = (slots ?? []).filter((s) => !isBreak(s)).reduce((n, s) => n + (toMinutes(s.endTime) - toMinutes(s.startTime)), 0) / 60

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero title="Emploi du temps" subtitle={total ? `${total} cours · ${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h par semaine` : 'Semaine'} className="pb-10">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 14 }}>
          {classes.map((c) => (
            <Pressable key={c.id} onPress={() => setClassId(c.id)} className={`rounded-full px-3.5 py-1.5 ${c.id === effClass ? 'bg-white' : 'bg-white/15'}`}>
              <Text className={`text-sm font-semibold ${c.id === effClass ? 'text-slate-900' : 'text-white'}`}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScreenHeader>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="-mt-4"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => { refetch(); refetchClasses() }} />}
      >
        {!effClass ? <Card className="p-0"><Empty title="Aucune classe" /></Card> : (slots ?? []).length === 0 && !isLoading ? <Card className="p-0"><Empty icon={CalendarX2} title="Aucun cours planifié" description="L'emploi du temps se compose depuis l'application de gestion." /></Card> : null}
        {DAYS.map((d) => {
          const list = byDay.get(d.value) ?? []
          if (list.length === 0) return null
          const isToday = d.value === today
          return (
            <View key={d.value}>
              <View className="mb-2 flex-row items-center gap-2">
                <Text className={`text-xs font-semibold uppercase tracking-[1.5px] ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{d.label}</Text>
                {isToday && <View className="rounded-full bg-primary px-2 py-0.5"><Text className="text-[10px] font-semibold text-white">Aujourd'hui</Text></View>}
                <Text className="ml-auto text-xs text-muted-foreground">{list.length} cours</Text>
              </View>
              <Card className="p-0">
                {list.map((s, i) => {
                  const mine = !me || s.teacherId === me.id
                  const unassigned = !s.teacherId
                  return (
                    <View key={s.id} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''} ${mine ? '' : 'opacity-45'}`}>
                      <View className="w-14"><Text className="text-sm font-semibold">{s.startTime}</Text><Text className="text-xs text-muted-foreground">{s.endTime}</Text></View>
                      <View style={{ backgroundColor: color }} className="w-1 self-stretch rounded-full" />
                      <View className="flex-1">
                        <Text className="font-semibold" numberOfLines={1}>{s.subject?.name ?? 'Cours'}</Text>
                        {s.room ? <View className="flex-row items-center gap-1"><MapPin size={11} color={colors.muted} /><Text className="text-xs text-muted-foreground">{s.room}</Text></View> : null}
                      </View>
                      {!mine && <Text className="text-[11px] text-muted-foreground">{unassigned ? 'Non attribué' : 'Autre prof.'}</Text>}
                    </View>
                  )
                })}
              </Card>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
