import { View, ScrollView, Pressable, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueries } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ClipboardCheck, BookOpen, ChevronRight, CalendarX2, Users, CloudUpload } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { ScreenHeader, Card, Empty, SectionTitle, classColor, CARD_SHADOW } from '@/components/screen'
import { useAuth } from '@/lib/auth'
import { useMyClasses } from '@/lib/queries'
import { useOutbox } from '@/lib/outbox'
import { api } from '@/lib/api'
import { useThemeColors } from '@/lib/theme-colors'
import type { TimetableSlot } from '@/lib/types'
import { toMinutes } from '@/lib/days'
import { useMe } from '@/lib/queries'
import { currentSlot } from '@/lib/slots'

export default function HomeScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const user = useAuth((s) => s.user)
  const pending = useOutbox((s) => s.items.length)
  const { data: classes, isLoading, refetch } = useMyClasses()
  const today = new Date()
  const dow = today.getDay()

  const timetables = useQueries({
    queries: (classes ?? []).map((c) => ({
      queryKey: ['timetable', c.id],
      queryFn: async () => (await api.get<TimetableSlot[]>('/timetable', { params: { classId: c.id } })).data,
    })),
  })
  const todayCourses = timetables
    .flatMap((q, i) => (q.data ?? []).filter((s) => s.dayOfWeek === dow && !s.isRecreation && !(!s.subject && /r[ée]cr[ée]/i.test(s.room ?? ''))).map((s) => ({ ...s, className: classes?.[i]?.name ?? '', color: classColor(classes?.[i]?.id ?? '') })))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
  const nowMin = today.getHours() * 60 + today.getMinutes()
  const next = todayCourses.find((c) => nowMin < toMinutes(c.endTime))
  const me = useMe().data
  const isTeacher = user?.role === 'TEACHER'
  const allSlots = timetables.flatMap((q) => q.data ?? [])
  const live = isTeacher ? currentSlot(allSlots, me?.id) : null
  const students = (classes ?? []).reduce((n, c) => n + (c._count?.students ?? 0), 0)

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero title={`Bonjour${user?.firstName ? `, ${user.firstName}` : ''}`} subtitle={format(today, 'EEEE d MMMM', { locale: fr })} className="pb-16">
        <View className="mt-5 flex-row gap-2">
          {[
            { label: 'Classes', value: classes?.length ?? 0 },
            { label: 'Élèves', value: students },
            { label: "Cours aujourd'hui", value: todayCourses.length },
          ].map((s) => (
            <View key={s.label} className="flex-1 rounded-xl bg-white/12 px-3 py-2">
              <Text className="text-xl font-bold text-white">{s.value}</Text>
              <Text className="text-[11px] text-white/75" numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScreenHeader>

      <ScrollView showsVerticalScrollIndicator={false} className="-mt-10 flex-1" contentContainerStyle={{ paddingHorizontal: 16, gap: 18, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}>
        {/* Carte « maintenant » à cheval sur le bandeau : le cours en cours (ou
            le prochain) avec les deux actions dedans. */}
        {(() => {
          const focus = live ? todayCourses.find((c) => c.id === live.id) ?? null : next ?? null
          const isLive = !!live && focus?.id === live.id
          const focusClass = focus ? classes?.find((c) => c.id === focus.classId) : null
          const color = focus ? classColor(focus.classId) : '#1D4ED8'
          const minsToStart = focus ? toMinutes(focus.startTime) - nowMin : 0
          const canCall = !isTeacher || isLive
          // Pas d'ombre portée ici : sur Android, l'élévation dessine un halo
          // sombre sur le bandeau coloré derrière la carte. Un liseré fin suffit.
          return (
            <View style={focus ? { backgroundColor: color } : undefined} className={`overflow-hidden rounded-3xl ${focus ? '' : 'border border-border bg-card'}`}>
              {focus ? (
                <View className="relative px-5 pb-4 pt-5">
                  <View className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-300' : 'bg-white/60'}`} />
                    <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-white/80">
                      {isLive ? 'En cours' : minsToStart > 0 ? `Prochain cours · dans ${minsToStart >= 60 ? `${Math.floor(minsToStart / 60)} h ${String(minsToStart % 60).padStart(2, '0')}` : `${minsToStart} min`}` : 'Prochain cours'}
                    </Text>
                  </View>
                  <Text className="mt-1 text-2xl font-bold text-white" numberOfLines={1}>{focus.subject?.name ?? 'Cours'}</Text>
                  <Text className="text-sm text-white/85" numberOfLines={1}>{focusClass?.name ?? focus.className} · {focus.startTime}–{focus.endTime}{focus.room ? ` · ${focus.room}` : ''}</Text>
                </View>
              ) : (
                <View className="px-5 pb-4 pt-5">
                  <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-foreground">Aujourd'hui</Text>
                  <Text className="mt-1 text-xl font-bold">{todayCourses.length ? 'Journée terminée' : 'Aucun cours prévu'}</Text>
                  <Text className="text-sm text-muted-foreground">{todayCourses.length ? `${todayCourses.length} cours donné${todayCourses.length > 1 ? 's' : ''} · profitez-en pour saisir des notes.` : 'Profitez-en pour saisir des notes.'}</Text>
                </View>
              )}
              <View className={`flex-row gap-2 px-3 pb-3 ${focus ? '' : 'pt-0'}`}>
                <Pressable
                  onPress={() => router.push(focus && canCall ? `/attendance/${focus.classId}` : isTeacher ? '/(tabs)/timetable' : '/(tabs)/classes')}
                  disabled={!focus && isTeacher}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3 ${focus ? (canCall ? 'bg-white' : 'bg-white/25') : isTeacher ? 'bg-slate-300' : 'bg-primary'}`}
                >
                  <ClipboardCheck size={18} color={focus ? (canCall ? color : '#fff') : '#fff'} />
                  <Text className={`font-semibold ${focus ? (canCall ? '' : 'text-white') : 'text-white'}`} style={focus && canCall ? { color } : undefined}>
                    {canCall || !focus ? "Faire l'appel" : `Appel à ${focus.startTime}`}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(focus ? `/grades/${focus.classId}` : '/(tabs)/classes')}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3 ${focus ? 'bg-white/20' : 'bg-violet-100'}`}
                >
                  <BookOpen size={18} color={focus ? '#fff' : '#6D28D9'} />
                  <Text className={`font-semibold ${focus ? 'text-white' : 'text-violet-800'}`}>Saisir des notes</Text>
                </Pressable>
              </View>
            </View>
          )
        })()}

        {pending > 0 && (
          <Pressable onPress={() => router.push('/(tabs)/profile')} className="flex-row items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
            <CloudUpload size={18} color="#B45309" />
            <Text className="flex-1 text-sm text-amber-900">{pending} saisie{pending > 1 ? 's' : ''} en attente d'envoi</Text>
            <ChevronRight size={16} color="#B45309" />
          </Pressable>
        )}

        <View>
          <SectionTitle action={<Text className="text-xs text-muted-foreground">{todayCourses.length ? `${todayCourses.length} cours` : ''}</Text>}>Cours d'aujourd'hui</SectionTitle>
          {todayCourses.length === 0 ? (
            <Card className="p-0"><Empty icon={CalendarX2} title="Aucun cours aujourd'hui" description={classes?.length ? 'Profitez-en pour saisir des notes.' : "Aucune classe ne vous est affectée."} /></Card>
          ) : (
            <View>
              {todayCourses.map((c, i) => {
                const isLive = nowMin >= toMinutes(c.startTime) && nowMin < toMinutes(c.endTime)
                const past = nowMin >= toMinutes(c.endTime)
                const last = i === todayCourses.length - 1
                return (
                  <View key={c.id} className="flex-row">
                    {/* Colonne temps + fil */}
                    <View className="w-14 items-center">
                      <Text className={`text-xs font-semibold ${past ? 'text-muted-foreground' : isLive ? 'text-primary' : ''}`}>{c.startTime}</Text>
                      <View className="mt-1 flex-1 items-center">
                        <View style={{ backgroundColor: past ? '#CBD5E1' : c.color }} className={`h-3 w-3 rounded-full ${isLive ? 'border-2 border-white' : ''}`} />
                        {!last && <View className="w-px flex-1 bg-border" />}
                      </View>
                    </View>
                    {/* Carte du cours */}
                    <Pressable
                      onPress={() => router.push(`/class/${c.classId}`)}
                      style={isLive ? [CARD_SHADOW, { backgroundColor: c.color }] : CARD_SHADOW}
                      className={`mb-3 flex-1 flex-row items-center gap-3 rounded-2xl px-4 py-3 active:opacity-90 ${isLive ? '' : 'bg-card'} ${past ? 'opacity-60' : ''}`}
                    >
                      <View className="flex-1">
                        <Text className={`font-semibold ${isLive ? 'text-white' : ''}`} numberOfLines={1}>{c.subject?.name ?? 'Cours'}</Text>
                        <Text className={`text-xs ${isLive ? 'text-white/85' : 'text-muted-foreground'}`} numberOfLines={1}>{c.className} · {c.startTime}–{c.endTime}{c.room ? ` · ${c.room}` : ''}</Text>
                      </View>
                      {isLive ? (
                        <View className="rounded-full bg-white/25 px-2 py-0.5"><Text className="text-[11px] font-semibold text-white">En cours</Text></View>
                      ) : past ? (
                        <Text className="text-[11px] text-muted-foreground">Terminé</Text>
                      ) : (
                        <ChevronRight size={18} color={colors.muted} />
                      )}
                    </Pressable>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <View>
          <SectionTitle action={<Pressable onPress={() => router.push('/(tabs)/classes')}><Text className="text-xs font-semibold text-primary">Tout voir</Text></Pressable>}>Mes classes</SectionTitle>
          {(classes ?? []).length === 0 && !isLoading ? (
            <Card className="p-0"><Empty icon={Users} title="Aucune classe" description="Demandez à l'administration de vous affecter à vos classes." /></Card>
          ) : (
            // Grille 2 colonnes, 4 classes max (les autres via « Tout voir ») :
            // une couleur par classe, effectif et prochain cours du jour.
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {(classes ?? []).slice(0, 4).map((c) => {
                const nextCourse = todayCourses.find((t) => t.classId === c.id && nowMin < toMinutes(t.endTime))
                const count = c._count?.students ?? 0
                return (
                  <Pressable key={c.id} onPress={() => router.push(`/class/${c.id}`)} style={[CARD_SHADOW, { backgroundColor: classColor(c.id), width: '48%', flexGrow: 1 }]} className="relative overflow-hidden rounded-2xl p-4 active:opacity-90">
                    <View className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15" />
                    <Text className="text-2xl font-bold text-white" numberOfLines={1}>{c.name}</Text>
                    <Text className="text-xs text-white/80" numberOfLines={1}>{c.level ?? ' '}</Text>
                    <View className="mt-5 flex-row items-center gap-1.5">
                      <Users size={13} color="#fff" />
                      <Text className="text-sm font-semibold text-white">{count} élève{count > 1 ? 's' : ''}</Text>
                    </View>
                    <Text className="mt-1 text-[11px] text-white/85" numberOfLines={1}>{nextCourse ? `${nextCourse.startTime} · ${nextCourse.subject?.name ?? 'Cours'}` : 'Pas de cours restant'}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
