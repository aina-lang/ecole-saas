import { useRef, useState } from 'react'
import { View, Pressable, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRIMARY } from '@/components/screen'
import { useRouter } from 'expo-router'
import { LogOut, CloudUpload, Trash2, RefreshCw, DownloadCloud, ShieldAlert, WifiOff, BookOpen, Users, CalendarDays, ChevronRight, CheckCircle2 } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Avatar } from '@/components/ui/avatar'
import { Card, SectionTitle, ClassAvatar, CARD_SHADOW } from '@/components/screen'
import { useAuth } from '@/lib/auth'
import { useMe, useMyClasses } from '@/lib/queries'
import { useOutbox } from '@/lib/outbox'
import { getApiUrl } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { fullName, initials, photoUri } from '@/lib/utils'
import { useThemeColors } from '@/lib/theme-colors'
import { useDialog } from '@/components/ui/dialog'

export default function ProfileScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { confirm, alert, toast } = useDialog()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const wipeDevice = useAuth((s) => s.wipeDevice)
  const preload = useAuth((s) => s.preload)
  const offlineSession = useAuth((s) => s.offlineSession)
  const me = useMe().data
  const { data: classes } = useMyClasses()
  const items = useOutbox((s) => s.items)
  const flush = useOutbox((s) => s.flush)
  const remove = useOutbox((s) => s.remove)
  const [preloading, setPreloading] = useState(false)
  const students = classes.reduce((n, c) => n + (c._count?.students ?? 0), 0)

  // Effet « sliver » : le bandeau (avatar, nom, e-mail) se replie au
  // défilement en une barre compacte avec le nom seul ; les chiffres clés
  // glissent dessous. Transformations uniquement (pilotées nativement).
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current
  const HEADER_MAX = insets.top + 232
  const HEADER_MIN = insets.top + 56
  const RANGE = HEADER_MAX - HEADER_MIN
  const headerTranslate = scrollY.interpolate({ inputRange: [0, RANGE], outputRange: [0, -RANGE], extrapolate: 'clamp' })
  const bigOpacity = scrollY.interpolate({ inputRange: [0, RANGE * 0.6], outputRange: [1, 0], extrapolate: 'clamp' })
  const bigScale = scrollY.interpolate({ inputRange: [0, RANGE], outputRange: [1, 0.6], extrapolate: 'clamp' })
  const compactOpacity = scrollY.interpolate({ inputRange: [RANGE * 0.55, RANGE], outputRange: [0, 1], extrapolate: 'clamp' })

  async function confirmLogout() {
    const ok = await confirm({ title: 'Verrouiller la session', message: 'L’app redemandera votre mot de passe. Vos données et saisies en attente restent sur cet appareil.', confirmLabel: 'Verrouiller' })
    if (!ok) return
    await logout()
    router.replace('/(auth)/login')
  }

  async function confirmWipe() {
    const pending = items.length
    const ok = await confirm({ title: 'Effacer les données de cet appareil', message: pending ? `${pending} saisie(s) non envoyées seront PERDUES. Toutes les données en cache seront effacées.` : 'Toutes les données en cache et la session seront effacées de ce téléphone.', confirmLabel: 'Tout effacer', destructive: true })
    if (!ok) return
    await wipeDevice()
    queryClient.clear()
    router.replace('/(auth)/login')
  }

  async function runPreload() {
    setPreloading(true)
    try { await preload(); toast({ type: 'success', title: 'Données à jour', message: 'Classes, élèves, matières et emplois du temps disponibles hors ligne.' }) }
    catch { await alert({ title: 'Impossible', message: 'Le serveur est injoignable pour le moment.', tone: 'error' }) }
    finally { setPreloading(false) }
  }

  const subjects = [...(me?.subjects ?? [])].sort((a, b) => a.name.localeCompare(b.name) || String(a.level ?? '').localeCompare(String(b.level ?? '')))

  return (
    <View className="flex-1 bg-background">
      {/* Bandeau repliable (au-dessus du contenu) */}
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_MAX, backgroundColor: PRIMARY, transform: [{ translateY: headerTranslate }], zIndex: 10, overflow: 'hidden' }}
      >
        <View className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10" />
        <View className="absolute -left-20 bottom-[-70px] h-44 w-44 rounded-full bg-black/10" />
        {/* Version grande */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 12, alignItems: 'center', opacity: bigOpacity, transform: [{ scale: bigScale }] }}>
          <Avatar uri={photoUri(me?.user?.photoUrl, getApiUrl())} initials={initials(user?.firstName, user?.lastName)} size={84} className="border-4 border-white/30" />
          <Text className="mt-3 text-2xl font-bold text-white">{fullName(user) || 'Profil'}</Text>
          <Text className="text-sm text-white/80">{me?.specialty ?? (user?.role === 'TEACHER' ? 'Enseignant' : 'Administration')}</Text>
          <Text className="mt-0.5 text-xs text-white/65">{user?.email}</Text>
        </Animated.View>
        {/* Version compacte (collée en bas du bandeau, donc visible une fois replié) */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, opacity: compactOpacity }}>
          <Avatar uri={photoUri(me?.user?.photoUrl, getApiUrl())} initials={initials(user?.firstName, user?.lastName)} size={30} className="border border-white/40" />
          <Text className="text-base font-semibold text-white" numberOfLines={1}>{fullName(user) || 'Profil'}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingTop: HEADER_MAX + 14, paddingHorizontal: 16, gap: 16, paddingBottom: 40 }}
      >
        {/* Chiffres clés à cheval sur le bandeau */}
        <View className="flex-row rounded-2xl border border-border bg-card p-2">
          {[
            { icon: Users, value: classes.length, label: 'Classes' },
            { icon: BookOpen, value: subjects.length, label: 'Matières' },
            { icon: CalendarDays, value: students, label: 'Élèves' },
          ].map((k, i) => (
            <View key={k.label} className={`flex-1 items-center py-2 ${i > 0 ? 'border-l border-border' : ''}`}>
              <k.icon size={16} color={colors.primary} />
              <Text className="mt-1 text-xl font-bold">{k.value}</Text>
              <Text className="text-[11px] text-muted-foreground">{k.label}</Text>
            </View>
          ))}
        </View>

        {offlineSession && (
          <View className="flex-row items-center gap-2 rounded-2xl bg-slate-700 px-3 py-2">
            <WifiOff size={14} color="#fff" />
            <Text className="flex-1 text-xs text-white">Session ouverte hors ligne : données du dernier passage en ligne.</Text>
          </View>
        )}

        <View>
          <SectionTitle>Mes matières</SectionTitle>
          <Card>
            <View className="flex-row flex-wrap gap-2">
              {subjects.length === 0 ? <Text className="text-sm text-muted-foreground">Aucune matière affectée</Text> : subjects.map((s) => (
                <View key={s.id} className="flex-row items-center gap-1.5 rounded-full bg-accent px-3 py-1.5">
                  <Text className="text-sm font-medium text-accent-foreground">{s.name}</Text>
                  {s.level ? <Text className="text-xs text-accent-foreground/70">· {s.level}</Text> : null}
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View>
          <SectionTitle action={<Pressable onPress={() => router.push('/(tabs)/classes')}><Text className="text-xs font-semibold text-primary">Tout voir</Text></Pressable>}>Mes classes</SectionTitle>
          <Card className="p-0">
            {classes.length === 0 ? <Text className="p-4 text-sm text-muted-foreground">Aucune classe affectée</Text> : classes.slice(0, 5).map((c, i) => (
              <Pressable key={c.id} onPress={() => router.push(`/class/${c.id}`)} className={`flex-row items-center gap-3 px-4 py-2.5 active:bg-muted ${i > 0 ? 'border-t border-border' : ''}`}>
                <ClassAvatar id={c.id} name={c.name} size={34} />
                <View className="flex-1">
                  <Text className="font-medium">{c.name}</Text>
                  <Text className="text-xs text-muted-foreground">{c._count?.students ?? 0} élèves{c.level ? ` · ${c.level}` : ''}</Text>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </View>

        <View>
          <SectionTitle>Hors ligne</SectionTitle>
          <Card className="p-0">
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><DownloadCloud size={18} color={colors.primary} /></View>
              <View className="flex-1">
                <Text className="text-sm font-medium">Données hors ligne</Text>
                <Text className="text-xs text-muted-foreground">Mises à jour automatiquement à chaque passage en ligne.</Text>
              </View>
              <Pressable onPress={runPreload} disabled={preloading} className="flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5">
                <RefreshCw size={13} color={colors.primary} /><Text className="text-xs font-semibold text-primary">{preloading ? '…' : 'Mettre à jour'}</Text>
              </Pressable>
            </View>
            <View className="border-t border-border px-4 py-3">
              <View className="flex-row items-center gap-3">
                <View className={`h-9 w-9 items-center justify-center rounded-xl ${items.length ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  {items.length ? <CloudUpload size={18} color="#B45309" /> : <CheckCircle2 size={18} color="#047857" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium">{items.length ? `${items.length} saisie${items.length > 1 ? 's' : ''} en attente d'envoi` : 'Tout est synchronisé'}</Text>
                  <Text className="text-xs text-muted-foreground">{items.length ? 'Envoi automatique dès que le réseau revient.' : 'Appels et notes envoyés au serveur.'}</Text>
                </View>
                {items.length > 0 && (
                  <Pressable onPress={() => flush()} className="flex-row items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5"><RefreshCw size={13} color="#B45309" /><Text className="text-xs font-semibold text-amber-800">Envoyer</Text></Pressable>
                )}
              </View>
              {items.map((it) => (
                <View key={it.id} className="mt-2 flex-row items-center gap-2 rounded-xl bg-muted px-3 py-2">
                  <View className="flex-1">
                    <Text className="text-sm font-medium" numberOfLines={1}>{it.label}</Text>
                    <Text className="text-xs text-muted-foreground">{it.lastError ? `Refusé : ${it.lastError}` : 'En attente de réseau'}</Text>
                  </View>
                  {it.lastError ? <Pressable onPress={() => remove(it.id)} hitSlop={8}><Trash2 size={16} color={colors.destructive} /></Pressable> : null}
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View className="gap-3 pt-2">
          <Pressable onPress={confirmLogout} style={CARD_SHADOW} className="flex-row items-center justify-center gap-2 rounded-2xl bg-card py-3.5 active:opacity-90">
            <LogOut size={18} color={colors.primary} /><Text className="font-semibold text-primary">Verrouiller la session</Text>
          </Pressable>
          <Pressable onPress={confirmWipe} className="flex-row items-center justify-center gap-1.5 py-1">
            <ShieldAlert size={14} color={colors.destructive} />
            <Text className="text-xs text-destructive">Effacer les données de cet appareil</Text>
          </Pressable>
          <Text className="text-center text-xs text-muted-foreground">Sekoliko Prof · v1.0.0</Text>
        </View>
      </Animated.ScrollView>
    </View>
  )
}
