'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getPhotoUrl } from '@/api/client'
import { useLocalPhotoSrc } from '@/lib/use-local-photo-src'
import { fileToResizedDataUrl } from '@/lib/image-utils'
import { cn } from '@/lib/utils'

interface PhotoUploadProps {
  src?: string | null
  firstName?: string
  lastName?: string
  onUpload: (file: File) => Promise<{ url: string }>
  // `unknown` et non `void` : les appelants branchent directement
  // `mutation.mutateAsync()`, dont la valeur de retour ne nous intéresse pas
  // mais qui n'est pas `void` pour autant.
  onDelete?: () => Promise<unknown>
  disabled?: boolean
  /** Libellé sous l'avatar (défaut : « Photo d'identité »). */
  label?: string
}

/**
 * Photo d'identité : l'avatar EST le contrôle — clic (ou glisser-déposer)
 * pour ajouter/changer, survol pour l'indication, corbeille discrète pour
 * retirer. Pas de bouton séparé.
 */
export function PhotoUpload({ src, firstName, lastName, onUpload, onDelete, disabled, label = "Photo d'identité" }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const resolvedSrc = useLocalPhotoSrc(src)
  const [preview, setPreview] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasLocalOverride = useRef(false)

  useEffect(() => {
    if (!hasLocalOverride.current) setPreview(resolvedSrc ?? null)
  }, [resolvedSrc])

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase()

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 10 Mo")
      return
    }
    setUploading(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      setPreview(dataUrl)
      hasLocalOverride.current = true
      await onUpload(file)
    } catch {
      toast.error("Erreur lors de l'enregistrement de la photo")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete() {
    try {
      await onDelete?.()
      hasLocalOverride.current = false
      setPreview(null)
      toast.success('Photo supprimée')
    } catch {
      toast.error('Erreur lors de la suppression de la photo')
    } finally {
      setDeleteOpen(false)
    }
  }

  const open = () => !disabled && !uploading && inputRef.current?.click()
  const photo = getPhotoUrl(preview)

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center gap-2">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={photo ? 'Changer la photo' : 'Ajouter une photo'}
          onClick={open}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) handleFile(e.dataTransfer.files?.[0]) }}
          className={cn(
            'group relative h-32 w-32 overflow-hidden rounded-2xl border-2 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            photo ? 'border-transparent bg-muted' : 'border-dashed border-border bg-muted/60 hover:border-primary/60 hover:bg-accent',
            dragOver && 'border-primary bg-accent',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          )}
        >
          {photo ? (
            <>
              <img src={photo} alt={firstName || ''} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
                <Camera className="h-6 w-6" />
                <span className="text-xs font-medium">Changer</span>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              {initials ? (
                <span className="text-3xl font-semibold text-foreground/70">{initials}</span>
              ) : (
                <Camera className="h-7 w-7" />
              )}
              <span className="px-2 text-center text-[11px] leading-tight">
                {initials ? 'Ajouter une photo' : 'Cliquer ou déposer une photo'}
              </span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        <span className="text-xs text-muted-foreground">{label}</span>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={disabled || uploading}
        />
      </div>

      {photo && onDelete && (
        <>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={disabled || uploading}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Retirer la photo
          </button>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={handleDelete}
            title="Supprimer la photo"
            description="Êtes-vous sûr de vouloir supprimer cette photo ?"
            confirmLabel="Supprimer"
          />
        </>
      )}
    </div>
  )
}
