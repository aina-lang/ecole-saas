import { View, TextInput, Pressable } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { useThemeColors } from '@/lib/theme-colors'

/** Barre de recherche : fond clair (light) ou translucide sur bandeau (onHero). */
export function SearchBar({ value, onChange, placeholder, onHero = false }: { value: string; onChange: (v: string) => void; placeholder: string; onHero?: boolean }) {
  const colors = useThemeColors()
  const fg = onHero ? '#fff' : colors.foreground
  const ph = onHero ? 'rgba(255,255,255,0.7)' : colors.muted
  return (
    <View className={`h-11 flex-row items-center gap-2 rounded-2xl px-4 ${onHero ? 'bg-white/15' : 'border border-border bg-card'}`}>
      <Search size={18} color={onHero ? 'rgba(255,255,255,0.85)' : colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={ph}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 text-base"
        style={{ color: fg, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Effacer">
          <X size={16} color={onHero ? 'rgba(255,255,255,0.85)' : colors.muted} />
        </Pressable>
      )}
    </View>
  )
}
