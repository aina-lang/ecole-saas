import { useEffect } from 'react'
import { useColorScheme } from 'nativewind'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, persister } from '@/lib/query'
import { useAuth } from '@/lib/auth'
import { useOutbox } from '@/lib/outbox'
import { DialogProvider } from '@/components/ui/dialog'
import '../global.css'

export default function RootLayout() {
  const init = useAuth((s) => s.init)
  const loadOutbox = useOutbox((s) => s.load)
  const { setColorScheme } = useColorScheme()
  // Thème clair forcé : cohérent avec les couleurs (voir lib/theme-colors.ts).
  useEffect(() => { setColorScheme('light') }, [setColorScheme])
  useEffect(() => { init(); loadOutbox() }, [init, loadOutbox])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000 }}>
          <DialogProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
          </DialogProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
