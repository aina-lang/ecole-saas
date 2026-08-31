import { useEffect, useState } from 'react'
import type { UpdateState } from '../preload/index.d'

// État de la mise à jour automatique, tenu par le process principal
// (src/main/updater.ts). Le composant lit l'état courant au montage — il peut
// se monter longtemps après l'annonce d'une mise à jour — puis suit les
// changements.
//
// Hors Electron (build web, tests), `window.api` n'existe pas : on reste sur
// « indisponible » au lieu de planter.
export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    const api = window.api?.updates
    if (!api) {
      setState({ status: 'unsupported', reason: "Mise à jour indisponible dans ce contexte." })
      return
    }
    let active = true
    void api.getState().then((initial) => {
      if (active) setState(initial)
    })
    const unsubscribe = api.onState(setState)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 Mo'
  const mo = bytes / (1024 * 1024)
  return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`
}
