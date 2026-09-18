/**
 * Retire l'adresse du serveur de tout texte destiné à l'utilisateur.
 *
 * L'infrastructure n'a pas à apparaître dans un logiciel vendu : ni IP, ni
 * port, ni URL d'API ou de CouchDB. Elle se glisse surtout dans les messages
 * d'erreur techniques (PouchDB, axios, Electron), qu'on affiche tels quels —
 * d'où ce filtre, appliqué au moment de l'affichage.
 */
const PATTERNS = [
  /\b(?:https?|wss?):\/\/[^\s"'<>)]+/gi, // URL complète
  /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/g, // IPv4, port éventuel
  /\blocalhost(?::\d{2,5})?\b/gi,
]

export function hideServerAddress(text: string): string {
  return PATTERNS.reduce((t, re) => t.replace(re, 'le serveur'), text)
}
