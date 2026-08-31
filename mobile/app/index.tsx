import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function Index() {
  const ready = useAuth((s) => s.ready)
  const user = useAuth((s) => s.user)
  if (!ready) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator /></View>
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />
}
