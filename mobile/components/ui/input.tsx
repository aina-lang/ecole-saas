import { TextInput, View, type TextInputProps } from 'react-native'
import { Text } from './text'
import { cn } from '@/lib/utils'
import { useThemeColors } from '@/lib/theme-colors'

export function Input({ label, error, className, ...props }: TextInputProps & { label?: string; error?: string; className?: string }) {
  const colors = useThemeColors()
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        // Couleur explicite : sur Android, la classe text-foreground n'est pas
        // toujours appliquée au TextInput (texte saisi quasi invisible).
        style={{ color: colors.foreground, paddingVertical: 0 }}
        className={cn('h-12 rounded-md border border-input bg-card px-4 text-base', error && 'border-destructive', className)}
        {...props}
      />
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  )
}
