import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Cache persistant : les classes, élèves, emploi du temps… restent lisibles
// hors ligne (dernière version connue), les mutations passent par la file
// d'attente (lib/outbox.ts).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Quasi temps réel avec le desktop : chaque écran ouvert se rafraîchit
      // toutes les 8 s tant que l'app est au premier plan (le cache reste
      // servi immédiatement, la mise à jour arrive derrière).
      staleTime: 8 * 1000,
      refetchInterval: 8 * 1000,
      refetchIntervalInBackground: false,
      refetchOnReconnect: true,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'ecoleprof.query-cache' })
