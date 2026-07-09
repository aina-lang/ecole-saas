import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, dateFormat: string = 'dd/MM/yyyy'): string {
  return format(new Date(date), dateFormat, { locale: fr })
}

export function formatCurrency(amount: number, currency: string = 'XAF'): string {
  return (
    new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ` ${currency}`
  )
}

let counter = 0

export function generateRegistrationNumber(prefix: string = 'STU', year?: number): string {
  const currentYear = year ?? new Date().getFullYear()
  const shortYear = currentYear.toString().slice(-2)
  counter++
  const seq = String(counter).padStart(5, '0')
  return `${prefix}-${shortYear}-${seq}`
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

export function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() ?? ''
  const last = lastName?.charAt(0)?.toUpperCase() ?? ''
  return `${first}${last}`
}
