import { useEffect, useState } from 'react'
import { View, Pressable } from 'react-native'
import * as Network from 'expo-network'
import { WifiOff, CloudUpload } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { useOutbox } from '@/lib/outbox'

/** Bandeau : hors ligne, et/ou envois en attente (avec relance manuelle). */
export function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const items = useOutbox((s) => s.items)
  const flushing = useOutbox((s) => s.flushing)
  const flush = useOutbox((s) => s.flush)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try { const st = await Network.getNetworkStateAsync(); if (mounted) setOnline(!!st.isConnected && st.isInternetReachable !== false) } catch { /* ignore */ }
    }
    check()
    const sub = Network.addNetworkStateListener((st) => {
      const up = !!st.isConnected && st.isInternetReachable !== false
      setOnline(up)
      if (up) flush().catch(() => {})
    })
    return () => { mounted = false; sub.remove() }
  }, [flush])

  if (online && items.length === 0) return null
  return (
    <View className={online ? 'bg-amber-100' : 'bg-slate-700'}>
      <Pressable onPress={() => online && flush()} className="flex-row items-center justify-center gap-2 px-4 py-1.5">
        {online ? <CloudUpload size={14} color="#92400E" /> : <WifiOff size={14} color="#fff" />}
        <Text className={online ? 'text-xs text-amber-900' : 'text-xs text-white'}>
          {online
            ? flushing ? 'Envoi en cours…' : `${items.length} saisie${items.length > 1 ? 's' : ''} en attente — toucher pour envoyer`
            : `Hors ligne${items.length ? ` · ${items.length} saisie${items.length > 1 ? 's' : ''} en attente` : ''}`}
        </Text>
      </Pressable>
    </View>
  )
}
