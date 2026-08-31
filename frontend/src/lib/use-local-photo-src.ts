import { useEffect, useState } from 'react'
import { fetchAsDataUrl } from './image-utils'

/**
 * Résout une URL `local-asset://<chemin>` en data URL via l'implémentation
 * partagée fetchAsDataUrl (image-utils) — même logique et même cache que la
 * génération de PDF, pour qu'une photo affichée à l'écran et imprimée sur un
 * reçu soit résolue d'une seule façon.
 *
 * Les URL http(s)/data: (logo, avatars distants) passent inchangées ; en cas
 * d'échec de résolution on renvoie la source telle quelle plutôt que rien
 * (l'<img> retombera sur son fallback).
 */
export function useLocalPhotoSrc(src?: string | null): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    src && !src.startsWith('local-asset://') ? src : undefined,
  )

  useEffect(() => {
    if (!src) {
      setResolved(undefined)
      return
    }
    if (!src.startsWith('local-asset://')) {
      setResolved(src)
      return
    }

    let cancelled = false
    fetchAsDataUrl(src)
      .then((dataUrl) => {
        if (!cancelled) setResolved(dataUrl || src)
      })
      .catch(() => {
        if (!cancelled) setResolved(src)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  return resolved
}
