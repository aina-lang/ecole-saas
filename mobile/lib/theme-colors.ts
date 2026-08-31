import { useColorScheme } from 'nativewind'

export const LIGHT = {
  background: '#F4F6FA', foreground: '#0F172A', card: '#FFFFFF', border: '#E2E8F0',
  primary: '#1D4ED8', muted: '#64748B', destructive: '#DC2626', success: '#059669', warning: '#D97706', white: '#FFFFFF',
}
export const DARK = {
  background: '#0F172A', foreground: '#F1F5F9', card: '#1E293B', border: '#334155',
  primary: '#6082FF', muted: '#94A3B8', destructive: '#EF4444', success: '#34D399', warning: '#FBBF24', white: '#1E293B',
}
export type ThemeColors = typeof LIGHT

// L'app est rendue en thème CLAIR (les classes NativeWind ne basculent en
// sombre que si la classe « dark » est posée, ce qu'on ne fait pas). Suivre le
// réglage système ici donnait un texte blanc (#F1F5F9) sur des champs blancs
// dès que le téléphone était en mode sombre.
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme()
  return colorScheme === 'dark' && APP_DARK_MODE ? DARK : LIGHT
}
export const APP_DARK_MODE = false
