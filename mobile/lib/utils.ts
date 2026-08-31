import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'
}

export function fullName(p?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!p) return ''
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
}

/**
 * URL affichable d'une photo : data URL (photos synchronisées), URL absolue,
 * ou chemin relatif servi par l'API (/storage/…). Sinon null → initiales.
 */
export function photoUri(url?: string | null, apiBase?: string): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('http')) return url
  if (url.startsWith('/') && apiBase) return apiBase.replace(/\/api\/v1\/?$/, '') + url
  return null
}
