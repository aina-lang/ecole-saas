import { useState } from 'react'
import { View, FlatList, Pressable, RefreshControl } from 'react-native'
import { format, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { MailOpen, ChevronDown, ChevronUp } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Avatar } from '@/components/ui/avatar'
import { ScreenHeader, Empty, CARD_SHADOW } from '@/components/screen'
import { useInbox } from '@/lib/queries'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { fullName, initials } from '@/lib/utils'
import { useThemeColors } from '@/lib/theme-colors'

function when(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Hier'
  return format(d, 'd MMM', { locale: fr })
}

export default function MessagesScreen() {
  const colors = useThemeColors()
  const { data, isLoading, refetch } = useInbox()
  const [openId, setOpenId] = useState<string | null>(null)
  const items = data?.data ?? []
  const unread = items.filter((i) => !i.readAt).length

  async function open(item: (typeof items)[number]) {
    setOpenId((v) => (v === item.id ? null : item.id))
    if (!item.readAt) {
      api.patch(`/communications/${item.message.id}/read`).then(() => queryClient.invalidateQueries({ queryKey: ['inbox'] })).catch(() => {})
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader hero title="Messages" subtitle={unread ? `${unread} non lu${unread > 1 ? 's' : ''}` : 'Boîte de réception'} className="pb-12" />
      <FlatList
        showsVerticalScrollIndicator={false}
        className="-mt-6"
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        ListEmptyComponent={!isLoading ? <View style={CARD_SHADOW} className="rounded-2xl bg-card"><Empty icon={MailOpen} title="Aucun message" description="Les messages de l'administration apparaîtront ici." /></View> : null}
        renderItem={({ item }) => {
          const opened = openId === item.id
          const unreadItem = !item.readAt
          return (
            <Pressable onPress={() => open(item)} style={CARD_SHADOW} className={`rounded-2xl bg-card p-3.5 active:opacity-90 ${unreadItem ? 'border-l-4 border-primary' : ''}`}>
              <View className="flex-row items-center gap-3">
                <Avatar initials={initials(item.message.sender.firstName, item.message.sender.lastName)} size={40} />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-sm ${unreadItem ? 'font-semibold' : 'text-muted-foreground'}`} numberOfLines={1}>{fullName(item.message.sender)}</Text>
                    <Text className={`text-xs ${unreadItem ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{when(item.message.createdAt)}</Text>
                  </View>
                  <Text className={`${unreadItem ? 'font-semibold' : ''}`} numberOfLines={opened ? undefined : 1}>{item.message.subject || item.message.body}</Text>
                </View>
                {opened ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
              </View>
              {opened && item.message.subject ? <Text className="mt-3 border-t border-border pt-3 text-sm leading-6">{item.message.body}</Text> : null}
            </Pressable>
          )
        }}
      />
    </View>
  )
}
