import { useEffect, useState } from 'react'

function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 3.5V2.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

const controlButton =
  'flex h-14 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const update = async () => {
      try {
        if ((window as any).api?.window?.isMaximized) {
          const max = await (window as any).api.window.isMaximized()
          setIsMaximized(max)
        }
      } catch {}
    }
    update()
  }, [])

  // Les contrôles de fenêtre (minimize/maximize/close) sont exposés sous
  // window.api.window (voir preload/index.ts) — PAS window.electron, qui est
  // l'objet générique @electron-toolkit/preload (ipcRenderer/webFrame/process
  // uniquement, sans contrôles de fenêtre custom). Avec window.electron, ce
  // composant renvoyait toujours null : la barre ne s'affichait jamais.
  const isElectron = typeof window !== 'undefined' && !!(window as any).api?.window

  if (!isElectron) return null

  const handleMinimize = () => (window as any).api.window.minimize()
  const handleMaximize = () => {
    (window as any).api.window.toggleMaximize()
    ;(window as any).api.window.isMaximized().then(setIsMaximized)
  }
  const handleClose = () => (window as any).api.window.close()

  return (
    <div
      className="flex h-14 w-full select-none items-center justify-between border-b bg-background px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
          S
        </span>
        Sekoliko
      </div>

      <div
        className="flex"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={controlButton}
          onClick={handleMinimize}
          aria-label="Minimiser"
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className={controlButton}
          onClick={handleMaximize}
          aria-label="Agrandir"
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          type="button"
          className="flex h-14 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleClose}
          aria-label="Fermer"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
