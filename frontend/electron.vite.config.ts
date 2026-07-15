import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
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
