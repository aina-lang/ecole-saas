// Cache des résolutions local-asset:// → data URL : chaque avatar d'une
// liste re-déclenchait une lecture disque + encodage base64 par monture de
// composant (pagination, re-render...). Une entrée par chemin, partagée par
// tous les consommateurs (hook d'affichage et génération de PDF).
const dataUrlCache = new Map<string, Promise<string>>()

/**
 * Résout n'importe quelle source d'image en data URL :
 * - `data:` : renvoyée telle quelle ;
 * - `http(s)` : téléchargée puis encodée ;
 * - `local-asset://<chemin>` : lue par le process main (IPC
 *   file:get-data-url) — le protocole custom chargé directement dans une
 *   balise <img> s'est montré peu fiable après réouverture de l'app ;
 * - autre / échec : chaîne vide.
 *
 * Implémentation UNIQUE partagée par l'affichage (useLocalPhotoSrc) et les
 * PDF (school-settings, receipt, bulletin) — les deux copies précédentes
 * avaient déjà divergé.
 */
export async function fetchAsDataUrl(url: string): Promise<string> {
  if (!url) return ''

  if (url.startsWith('data:')) return url

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      return ''
    }
  }

  if (url.startsWith('local-asset://')) {
    let pending = dataUrlCache.get(url)
    if (!pending) {
      pending = (async () => {
        try {
          const api = (window as any).api?.file
          if (api?.getDataUrl) {
            return (await api.getDataUrl(url.slice('local-asset://'.length))) || ''
          }
        } catch { /* IPC indisponible */ }
        return ''
      })()
      dataUrlCache.set(url, pending)
      // Ne pas mémoriser un échec (fichier pas encore écrit, IPC absent) :
      // la prochaine demande retentera.
      pending.then((v) => { if (!v) dataUrlCache.delete(url) })
    }
    return pending
  }

  return ''
}

/**
 * Convertit une image en data URL JPEG redimensionnée.
 *
 * Utilisé pour les photos (élèves, utilisateurs, parents, logo) stockées
 * DANS le document PouchDB : contrairement aux fichiers écrits sur le disque
 * du poste (`local-asset://…`, jamais répliqués), une data URL voyage avec le
 * document vers CouchDB et les autres postes, et reste disponible pour les
 * PDF (bulletins, reçus) sur n'importe quelle machine.
 *
 * Le redimensionnement borne le poids du document (~30-80 Ko pour un avatar
 * en 512 px) — indispensable puisque la photo est re-répliquée à chaque
 * modification du document.
 */
export async function fileToResizedDataUrl(
  file: File | Blob,
  maxDim = 512,
  quality = 0.85,
): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Image illisible'))
    el.src = dataUrl
  })

  // Déjà assez petite (et pas un format exotique à normaliser) : renvoyer telle quelle.
  if (img.width <= maxDim && img.height <= maxDim && dataUrl.length < 150_000) {
    return dataUrl
  }

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  // Fond blanc : les PNG transparents convertis en JPEG deviendraient noirs.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Normalise un logo en CARRÉ (PNG, fond transparent) : l'image est réduite
 * pour tenir entièrement dans le carré et centrée. Un logo rectangulaire
 * n'est donc ni étiré ni rogné, où qu'il soit affiché dans un carré (menu,
 * en-tête, bulletins, reçus).
 */
export async function fileToSquareLogoDataUrl(file: File | Blob, size = 256): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Image illisible'))
    el.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  const scale = Math.min(size / img.width, size / img.height)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h)
  return canvas.toDataURL('image/png')
}
