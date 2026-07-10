'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UploadIcon, TrashIcon } from '@radix-ui/react-icons'
import { toast } from 'sonner'

interface PhotoUploadProps {
  src?: string | null
  firstName?: string
  lastName?: string
  onUpload: (file: File) => Promise<{ url: string }>
  onDelete?: () => Promise<void>
  disabled?: boolean
}

export function PhotoUpload({ src, firstName, lastName, onUpload, onDelete, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(src || null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase()

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('L\'image ne doit pas dépasser 2 Mo')
      return
    }

    setUploading(true)
    try {
      const result = await onUpload(file)
      setPreview(result.url)
      toast.success('Photo enregistrée')
    } catch {
      toast.error('Erreur lors de l\'enregistrement de la photo')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete() {
    try {
      await onDelete?.()
      setPreview(null)
      toast.success('Photo supprimée')
    } catch {
      toast.error('Erreur lors de la suppression de la photo')
    } finally {
      setDeleteOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={preview || undefined} alt={firstName} />
        <AvatarFallback className="text-lg">{initials || '?'}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          {uploading ? 'Envoi...' : preview ? 'Changer' : 'Ajouter'}
        </Button>

        {preview && onDelete && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={disabled}
              className="text-destructive"
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
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
    </div>
  )
}
