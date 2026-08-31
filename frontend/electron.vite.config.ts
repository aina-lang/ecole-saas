import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // Version installée, affichée dans Paramètres › Général › Mises à jour.
    // Elle vient de package.json, la même source qu'electron-builder utilise
    // pour nommer l'installateur et générer latest.yml.
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['pouchdb', 'pouchdb-adapter-idb'],
      include: ['spark-md5', 'uuid', 'vuvuzela', 'events']
    }
  }
})
