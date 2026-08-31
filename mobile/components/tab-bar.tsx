import { View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Users, CalendarDays, Mail, UserRound, type LucideIcon } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { useThemeColors } from '@/lib/theme-colors'
import { useInbox } from '@/lib/queries'

const ICONS: Record<string, LucideIcon> = { index: Home, classes: Users, timetable: CalendarDays, messages: Mail, profile: UserRound }
const LABELS: Record<string, string> = { index: 'Accueil', classes: 'Classes', timetable: 'Horaires', messages: 'Messages', profile: 'Profil' }

// Typage volontairement souple : expo-router redéclare ses propres types de barre d'onglets.
interface TabBarProps { state: { index: number; routes: { key: string; name: string }[] }; navigation: { emit: (e: any) => { defaultPrevented: boolean }; navigate: (name: string) => void } }

/**
 * Barre d'onglets classique et sobre : pleine largeur, coins supérieurs
 * arrondis, icône + libellé toujours visibles ; l'onglet actif a son icône
 * dans un carré arrondi teinté et son libellé en couleur primaire.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const unread = (useInbox().data?.data ?? []).filter((i) => !i.readAt).length

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8), shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 10 }}
      className="flex-row rounded-t-3xl border-t border-border bg-card px-2 pt-2"
    >
      {state.routes.filter((r) => r.name !== 'messages').map((route) => {
        const index = state.routes.findIndex((r) => r.key === route.key)
        const focused = state.index === index
        const Icon = ICONS[route.name] ?? Home
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={LABELS[route.name]}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
            }}
            className="flex-1 items-center gap-1 py-1"
          >
            <View className={`relative h-9 w-14 items-center justify-center rounded-full ${focused ? 'bg-primary/10' : ''}`}>
              <Icon size={22} color={focused ? colors.primary : colors.muted} strokeWidth={focused ? 2.4 : 1.9} />
              {route.name === 'messages' && unread > 0 && (
                <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full border-2 border-card bg-red-500 px-1">
                  <Text className="text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
            <Text className={`text-[11px] ${focused ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{LABELS[route.name]}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
