export async function printPdf(html: string, defaultName: string): Promise<boolean> {
  const api = window.api?.documents
  if (!api) {
    console.warn('[printPdf] Electron API not available — falling back to browser print')
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.onload = () => { win.print() }
    }
    return false
  }
  const result = await api.print(html, defaultName)
  return !result.canceled
}
