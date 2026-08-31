import { useMemo, useState } from 'react'
import { View, FlatList, Pressable, RefreshControl, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Users, MapPin, Search, ClipboardCheck, BookOpen, Layers } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { ScreenHeader, Empty, ClassAvatar, classColor, CARD_SHADOW } from '@/components/screen'
import { useMyClasses } from '@/lib/queries'
import { useThemeColors } from '@/lib/theme-colors'

export default function ClassesScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { data, isLoading, refetch } = useMyClasses()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? data.filter((c) => `${c.name} ${c.level ?? ''} ${c.room ?? ''}`.toLowerCase().includes(s)) : data
  }, [data, q])
  const students = data.reduce((n, c) => n + (c._count?.students ?? 0), 0)

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero title="Mes classes" subtitle={`${data.length} classe${data.length > 1 ? 's' : ''} · ${students} élèves`} className="pb-14">
        <View className="mt-4 h-12 flex-row items-center gap-2 rounded-2xl bg-white/15 px-4">
          <Search size={18} color="rgba(255,255,255,0.8)" />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher une classe…" placeholderTextColor="rgba(255,255,255,0.7)" className="flex-1 text-base text-white" autoCapitalize="none" />
        </View>
      </ScreenHeader>
      <FlatList
        showsVerticalScrollIndicator={false}
        className="-mt-7"
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        ListEmptyComponent={!isLoading ? (
          <View style={CARD_SHADOW} className="rounded-2xl bg-card">
            <Empty icon={Users} title={q ? 'Aucune classe ne correspond' : 'Aucune classe affectée'} description={q ? undefined : "L'administration vous affecte à vos classes depuis l'application de gestion."} />
          </View>
        ) : null}
        renderItem={({ item: c }) => {
          const color = classColor(c.id)
          const count = c._count?.students ?? 0
          const cap = Number(c.capacity) || 0
          return (
            <Pressable onPress={() => router.push(`/class/${c.id}`)} style={CARD_SHADOW} className="overflow-hidden rounded-2xl bg-card active:opacity-90">
              <View style={{ backgroundColor: color }} className="h-1.5" />
              <View className="flex-row items-center gap-3 p-4 pb-3">
                <ClassAvatar id={c.id} name={c.name} size={48} />
                <View className="flex-1">
                  <Text className="text-lg font-semibold">{c.name}</Text>
                  <View className="mt-0.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <View className="flex-row items-center gap-1"><Users size={13} color={colors.muted} /><Text className="text-xs text-muted-foreground">{count} élève{count > 1 ? 's' : ''}{cap ? ` / ${cap}` : ''}</Text></View>
                    {c.level ? <View className="flex-row items-center gap-1"><Layers size={13} color={colors.muted} /><Text className="text-xs text-muted-foreground">{c.level}</Text></View> : null}
                    {c.room ? <View className="flex-row items-center gap-1"><MapPin size={13} color={colors.muted} /><Text className="text-xs text-muted-foreground">{c.room}</Text></View> : null}
                  </View>
                </View>
                <ChevronRight size={20} color={colors.muted} />
              </View>
              <View className="flex-row border-t border-border">
                <Pressable onPress={() => router.push(`/attendance/${c.id}`)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-muted">
                  <ClipboardCheck size={15} color={color} /><Text className="text-sm font-semibold" style={{ color }}>Appel</Text>
                </Pressable>
                <View className="w-px bg-border" />
                <Pressable onPress={() => router.push(`/grades/${c.id}`)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-muted">
                  <BookOpen size={15} color={colors.primary} /><Text className="text-sm font-semibold text-primary">Notes</Text>
                </Pressable>
              </View>
            </Pressable>
          )
        }}
      />
    </View>
  )
}
