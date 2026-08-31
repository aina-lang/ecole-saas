import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal, Pressable, View, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { useThemeColors } from '@/lib/theme-colors'

// Boîte de confirmation et « popup » (toast) maison, à la charte de l'app,
// à la place des Alert.alert natives. Utilisation :
//   const { confirm, toast } = useDialog()
//   if (await confirm({ title: 'Supprimer ?', destructive: true })) …
//   toast({ type: 'success', title: 'Appel enregistré' })

type Tone = 'info' | 'success' | 'warning' | 'error'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  tone?: Tone
  /** Sans bouton Annuler (simple information). */
  alertOnly?: boolean
}

export interface ToastOptions {
  type?: Tone
  title: string
  message?: string
  durationMs?: number
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  alert: (o: Omit<ConfirmOptions, 'alertOnly' | 'cancelLabel'>) => Promise<void>
  toast: (o: ToastOptions) => void
}

const DialogContext = createContext<DialogApi | null>(null)

const TONES: Record<Tone, { icon: LucideIcon; color: string; bg: string }> = {
  info: { icon: Info, color: '#1D4ED8', bg: '#DBEAFE' },
  success: { icon: CheckCircle2, color: '#047857', bg: '#D1FAE5' },
  warning: { icon: AlertTriangle, color: '#B45309', bg: '#FEF3C7' },
  error: { icon: XCircle, color: '#B91C1C', bg: '#FEE2E2' },
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const colors = useThemeColors()
  const insets = useSafeAreaInsets()
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [toastState, setToastState] = useState<ToastOptions | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastAnim = useRef(new Animated.Value(0)).current
  const sheetAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(sheetAnim, { toValue: confirmState ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [confirmState, sheetAnim])

  const hideToast = useCallback(() => {
    Animated.timing(toastAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setToastState(null))
  }, [toastAnim])

  const api = useMemo<DialogApi>(() => ({
    confirm: (o) => new Promise((resolve) => setConfirmState({ ...o, resolve })),
    alert: (o) => new Promise((resolve) => setConfirmState({ ...o, alertOnly: true, resolve: () => resolve() })),
    toast: (o) => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setToastState(o)
      toastAnim.setValue(0)
      Animated.timing(toastAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
      toastTimer.current = setTimeout(hideToast, o.durationMs ?? 2800)
    },
  }), [hideToast, toastAnim])

  const close = (value: boolean) => { confirmState?.resolve(value); setConfirmState(null) }
  const tone = TONES[confirmState?.tone ?? (confirmState?.destructive ? 'warning' : 'info')]
  const ToneIcon = tone.icon
  const toastTone = TONES[toastState?.type ?? 'info']
  const ToastIcon = toastTone.icon

  return (
    <DialogContext.Provider value={api}>
      {children}

      {/* Confirmation : feuille centrée sur voile sombre */}
      <Modal visible={!!confirmState} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
        <Pressable onPress={() => !confirmState?.alertOnly && close(false)} className="flex-1 items-center justify-center bg-black/50 px-6">
          <Animated.View style={{ transform: [{ scale: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }], opacity: sheetAnim }} className="w-full max-w-sm">
            <Pressable onPress={() => {}} className="rounded-3xl bg-card p-6" style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}>
              <View style={{ backgroundColor: tone.bg }} className="mb-4 h-14 w-14 items-center justify-center self-center rounded-2xl">
                <ToneIcon size={28} color={tone.color} />
              </View>
              <Text className="text-center text-xl font-semibold">{confirmState?.title}</Text>
              {confirmState?.message ? <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">{confirmState.message}</Text> : null}
              <View className="mt-6 gap-2">
                <Button
                  variant={confirmState?.destructive ? 'destructive' : 'default'}
                  label={confirmState?.confirmLabel ?? (confirmState?.alertOnly ? 'OK' : 'Confirmer')}
                  onPress={() => close(true)}
                  size="lg"
                  className="rounded-xl"
                />
                {!confirmState?.alertOnly && (
                  <Button variant="ghost" label={confirmState?.cancelLabel ?? 'Annuler'} onPress={() => close(false)} className="rounded-xl" />
                )}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Popup (toast) : glisse depuis le haut, se ferme au toucher */}
      {toastState && (
        <Animated.View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}
        >
          <Pressable onPress={hideToast} className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3" style={{ shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
            <View style={{ backgroundColor: toastTone.bg }} className="h-9 w-9 items-center justify-center rounded-xl">
              <ToastIcon size={18} color={toastTone.color} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold" numberOfLines={1}>{toastState.title}</Text>
              {toastState.message ? <Text className="text-xs text-muted-foreground" numberOfLines={2}>{toastState.message}</Text> : null}
            </View>
          </Pressable>
        </Animated.View>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog doit être utilisé sous <DialogProvider>')
  return ctx
}
