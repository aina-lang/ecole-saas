/// <reference types="vite/client" />

/** Version de package.json, injectée à la compilation (electron.vite.config.ts). */
declare const __APP_VERSION__: string

// Suffixe `?asset` d'electron-vite (import d'un fichier comme chemin sur disque).
// Ces types viennent de `electron-vite/node`, chargé par tsconfig.node.json ;
// or tsconfig.web.json compile aussi src/main via son include `./src/**/*`,
// sans ces types. On les déclare donc ici plutôt que d'exclure src/main.
declare module '*?asset' {
  const src: string
  export default src
}
