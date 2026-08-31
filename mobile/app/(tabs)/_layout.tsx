import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { AppState, View } from 'react-native'
import * as Network from 'expo-network'
import { useAuth } from '@/lib/auth'
import { useOutbox } from '@/lib/outbox'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabBar } from '@/components/tab-bar'
import { OfflineBanner } from '@/components/offline-banner'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const preload = useAuth((s) => s.preload)
  const flush = useOutbox((s) => s.flush)

  // À l'ouverture, au retour au premier plan et au retour du réseau : envoyer
  // la file d'attente puis rafraîchir le cache complet de l'enseignant.
  useEffect(() => {
    const run = async () => {
      try {
        const st = await Network.getNetworkStateAsync()
        if (st.isConnected && st.isInternetReachable !== false) { await flush(); await preload() }
      } catch { /* hors ligne : rien à faire */ }
    }
    run()
    // Envoi de la file d'attente toutes les 8 s (appel/notes saisis hors ligne
    // partent dès que le réseau revient, sans attendre une action).
    const timer = setInterval(() => { flush().catch(() => {}) }, 8000)
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') run() })
    const net = Network.addNetworkStateListener((st) => { if (st.isConnected && st.isInternetReachable !== false) run() })
    return () => { clearInterval(timer); app.remove(); net.remove() }
  }, [preload, flush])

  return (
    <View className="flex-1 bg-background">
      <Tabs
        tabBar={(props: any) => <TabBar state={props.state} navigation={props.navigation} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
        <Tabs.Screen name="classes" options={{ title: 'Classes' }} />
        <Tabs.Screen name="timetable" options={{ title: 'Horaires' }} />
        {/* Messagerie masquée pour l'instant (href null = hors barre d'onglets). */}
        <Tabs.Screen name="messages" options={{ title: 'Messages', href: null }} />
        <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      </Tabs>
      <View className="absolute left-0 right-0" style={{ top: insets.top }}><OfflineBanner /></View>
    </View>
  )
}
