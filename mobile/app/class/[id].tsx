import { useMemo, useState } from 'react'
import { View, FlatList, Pressable, RefreshControl } from 'react-native'
import { SearchBar } from '@/components/search-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ClipboardCheck, BookOpen } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Avatar } from '@/components/ui/avatar'
import { ScreenHeader, Empty, classColor } from '@/components/screen'
import { useClasses, useClassStudents } from '@/lib/queries'
import { fullName, initials, photoUri } from '@/lib/utils'
import { useThemeColors } from '@/lib/theme-colors'
import { getApiUrl } from '@/lib/api'

export default function ClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colors = useThemeColors()
  const cls = useClasses().data?.find((c) => c.id === id)
  const { data: students, isLoading, refetch } = useClassStudents(id)
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? (students ?? []).filter((s) => `${s.lastName} ${s.firstName ?? ''} ${s.registrationNumber ?? ''}`.toLowerCase().includes(t)) : students ?? []
  }, [students, q])
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero back title={cls?.name ?? 'Classe'} subtitle={`${students?.length ?? cls?._count?.students ?? 0} élèves${cls?.level ? ` · ${cls.level}` : ''}${cls?.room ? ` · ${cls.room}` : ''}`} className="pb-16" style={{ backgroundColor: classColor(id ?? '') }} />
      <View className="-mt-9 flex-row gap-3 px-4">
        <Pressable onPress={() => router.push(`/attendance/${id}`)} style={{ backgroundColor: classColor(id ?? '') }} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5 active:opacity-90">
          <ClipboardCheck size={18} color="#fff" /><Text className="font-semibold text-white">Faire l'appel</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/grades/${id}`)} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 active:bg-muted">
          <BookOpen size={18} color={colors.primary} /><Text className="font-semibold">Notes</Text>
        </Pressable>
      </View>
      <FlatList showsVerticalScrollIndicator={false}
        data={students ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={<View className="mb-3 gap-2"><SearchBar value={q} onChange={setQ} placeholder="Rechercher un élève (nom, matricule)…" /><Text className="text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">{q ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : 'Élèves'}</Text></View>}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        ListEmptyComponent={!isLoading ? <Empty title={q ? 'Aucun élève ne correspond' : 'Aucun élève dans cette classe'} /> : null}
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        renderItem={({ item: s, index }) => (
          <View className={`flex-row items-center gap-3 border-x border-border bg-card px-4 py-3 ${index === 0 ? 'rounded-t-2xl border-t' : ''} ${index === filtered.length - 1 ? 'rounded-b-2xl border-b' : ''}`}>
            <Text className="w-6 text-xs text-muted-foreground">{index + 1}</Text>
            <Avatar uri={photoUri(s.photoUrl, getApiUrl())} initials={initials(s.firstName, s.lastName)} size={38} />
            <View className="flex-1">
              <Text className="font-medium">{s.lastName.toUpperCase()} {s.firstName ?? ''}</Text>
              <Text className="text-xs text-muted-foreground">{s.registrationNumber ?? ''}{s.gender ? ` · ${s.gender === 'F' ? 'Fille' : 'Garçon'}` : ''}</Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}
