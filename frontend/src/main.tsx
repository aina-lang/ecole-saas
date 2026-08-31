import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/global.css'
import App from '@/App'
import { initTrustedClock } from '@/lib/trusted-clock'
import { ThemeProvider } from '@/components/theme-provider'

// L'horloge de confiance (licence hors ligne, tampons de synchro) doit être
// chargée avant la première écriture — on attend son état durable.
initTrustedClock().finally(() => {
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
})
