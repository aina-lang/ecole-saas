'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getPhotoUrl } from '@/api/client'

interface StudentPhotoProps {
  src?: string | null
  alt?: string
  initials: string
  className?: string
  entityId?: string
  fallbackClassName?: string
}

export function StudentPhoto({ src, alt, initials, className, entityId, fallbackClassName }: StudentPhotoProps) {
  const [photoSrc, setPhotoSrc] = useState<string | undefined>(src || undefined)

  useEffect(() => {
    const api = (window as any).api
    if (api?.file && entityId) {
      api.file.getEntityPhoto('Student', entityId).then((localUrl: string) => {
        if (localUrl) setPhotoSrc(localUrl)
        else setPhotoSrc(src || undefined)
      })
    } else {
      setPhotoSrc(src || undefined)
    }
  }, [src, entityId])

  return (
    <Avatar className={className}>
      <AvatarImage src={getPhotoUrl(photoSrc)} alt={alt} />
      <AvatarFallback className={fallbackClassName}>{initials || '?'}</AvatarFallback>
    </Avatar>
  )
}