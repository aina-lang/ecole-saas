/**
 * Imprime un document HTML en PDF.
 *
 * Chemin normal : IPC `documents:print` — le main process rend le HTML dans
 * une fenêtre cachée, `printToPDF`, dialogue d'enregistrement, puis ouvre le
 * fichier. Une annulation du dialogue est un choix de l'utilisateur : elle
 * est respectée (pas de repli).
 *
 * Repli (API Electron absente, ex. exécution navigateur) : popup
 * d'impression du navigateur.
 *
 * @throws Error si la popup de secours est bloquée.
 */
export async function printPdf(html: string, defaultName: string): Promise<void> {
  const api = window.api?.documents
  if (api) {
    await api.print(html, defaultName)
    return
  }
  console.warn('[printPdf] API Electron indisponible — impression navigateur')
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error("Popup bloquée. Autorisez les popups pour imprimer le document.")
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.print() }
}
