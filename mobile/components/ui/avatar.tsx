import { View, Image } from 'react-native'
import { Text } from './text'
import { cn } from '@/lib/utils'

export function Avatar({ uri, initials, size = 40, className }: { uri?: string | null; initials: string; size?: number; className?: string }) {
  const style = { width: size, height: size, borderRadius: size / 2 }
  if (uri) return <Image source={{ uri }} style={style} className={className} />
  return (
    <View style={style} className={cn('items-center justify-center bg-accent', className)}>
      <Text className="font-semibold text-accent-foreground" style={{ fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  )
}
