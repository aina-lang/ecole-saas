export type ExportFormat = 'pdf' | 'docx' | 'xlsx'

const FILTERS: Record<Exclude<ExportFormat, 'pdf'>, { name: string; ext: string }> = {
  docx: { name: 'Document Word', ext: 'docx' },
  xlsx: { name: 'Classeur Excel', ext: 'xlsx' },
}

/**
 * Enregistre un export binaire (docx/xlsx) via le dialogue Electron, puis
 * l'ouvre. Hors Electron (exécution navigateur) : téléchargement direct.
 */
export async function saveBinaryExport(
  data: ArrayBuffer | Uint8Array,
  defaultName: string,
  format: Exclude<ExportFormat, 'pdf'>,
): Promise<void> {
  const buffer: ArrayBuffer = data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    : data
  const { name, ext } = FILTERS[format]
  const api = window.api?.documents
  if (api?.saveFile) {
    await api.saveFile(buffer, defaultName, name, ext)
    return
  }
  // Repli navigateur (dev web) : lien de téléchargement éphémère.
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
