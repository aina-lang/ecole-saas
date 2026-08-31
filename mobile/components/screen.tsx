import { type ReactNode } from 'react'
import { View, Pressable, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Inbox } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { useThemeColors } from '@/lib/theme-colors'
import { cn } from '@/lib/utils'

export const PRIMARY = '#1D4ED8'

export const CARD_SHADOW: ViewStyle = {
  shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
}

/**
 * En-tête d'écran. `hero` : bandeau indigo (accueil, profil) avec titre en
 * blanc et contenu libre ; sinon barre claire avec titre, sous-titre, retour.
 */
export function ScreenHeader({ title, subtitle, back, right, children, hero = false, className, style }: {
  title: string; subtitle?: string; back?: boolean; right?: ReactNode; children?: ReactNode; hero?: boolean; className?: string; style?: ViewStyle
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  if (hero) {
    return (
      <View style={[{ paddingTop: insets.top + 12, backgroundColor: PRIMARY }, style]} className={cn('relative overflow-hidden px-5 pb-14', className)}>
        <View className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10" />
        <View className="absolute -left-20 bottom-[-70px] h-44 w-44 rounded-full bg-black/10" />
        <View className="flex-row items-center gap-3">
          {back && (
            <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white/15" hitSlop={8}>
              <ArrowLeft size={22} color="#fff" />
            </Pressable>
          )}
          <View className="flex-1">
            {subtitle ? <Text className="text-sm capitalize text-white/75" numberOfLines={1}>{subtitle}</Text> : null}
            <Text className="text-2xl font-semibold text-white" numberOfLines={1}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </View>
    )
  }
  return (
    <View style={{ paddingTop: insets.top + 8 }} className={cn('border-b border-border bg-card px-4 pb-3', className)}>
      <View className="flex-row items-center gap-3">
        {back && (
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full active:bg-muted" hitSlop={8}>
            <ArrowLeft size={22} color={colors.foreground} />
          </Pressable>
        )}
        <View className="flex-1">
          <Text className="text-xl font-semibold" numberOfLines={1}>{title}</Text>
          {subtitle ? <Text className="text-sm text-muted-foreground" numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}

export function Empty({ title, description, icon: Icon = Inbox }: { title: string; description?: string; icon?: typeof Inbox }) {
  const colors = useThemeColors()
  return (
    <View className="items-center px-8 py-14">
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon size={26} color={colors.muted} />
      </View>
      <Text className="text-center text-base font-semibold">{title}</Text>
      {description ? <Text className="mt-1 text-center text-sm leading-5 text-muted-foreground">{description}</Text> : null}
    </View>
  )
}

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: ViewStyle }) {
  return <View style={[CARD_SHADOW, style]} className={cn('rounded-2xl border border-border bg-card p-4', className)}>{children}</View>
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">{children}</Text>
      {action}
    </View>
  )
}

/** Couleur stable par classe (avatar de classe). */
const CLASS_COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#DB2777', '#EA580C', '#0891B2', '#4F46E5', '#65A30D']
export function classColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CLASS_COLORS[h % CLASS_COLORS.length]
}

export function ClassAvatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: classColor(id) }} className="items-center justify-center">
      <Text className="font-bold text-white" style={{ fontSize: size * 0.34 }}>{name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?'}</Text>
    </View>
  )
}
