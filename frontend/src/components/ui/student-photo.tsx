'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getPhotoUrl } from '@/api/client'
import { useLocalPhotoSrc } from '@/lib/use-local-photo-src'

interface StudentPhotoProps {
  src?: string | null
  alt?: string
  initials: string
  className?: string
  entityId?: string
  fallbackClassName?: string
}

export function StudentPhoto({ src, alt, initials, className, fallbackClassName }: StudentPhotoProps) {
  const photoSrc = useLocalPhotoSrc(src)

  return (
    <Avatar className={className}>
      <AvatarImage src={getPhotoUrl(photoSrc)} alt={alt} />
      <AvatarFallback className={fallbackClassName}>{initials || '?'}</AvatarFallback>
    </Avatar>
  )
}
