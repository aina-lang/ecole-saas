import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable, TextInput, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mail, Lock, Eye, EyeOff, ClipboardCheck, BookOpen, WifiOff, AlertCircle } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/api'
import { useThemeColors } from '@/lib/theme-colors'

const PRIMARY = '#1D4ED8'

function Field({ icon: Icon, right, ...props }: React.ComponentProps<typeof TextInput> & { icon: typeof Mail; right?: React.ReactNode }) {
  const colors = useThemeColors()
  const [focused, setFocused] = useState(false)
  return (
    <View className={`h-14 flex-row items-center gap-3 rounded-xl border bg-card px-4 ${focused ? 'border-primary' : 'border-border'}`}>
      <Icon size={20} color={focused ? colors.primary : colors.muted} />
      <TextInput
        className="flex-1 text-base text-foreground"
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {right}
    </View>
  )
}

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const login = useAuth((s) => s.login)
  const lockedEmail = useAuth((s) => s.lockedEmail)
  const [email, setEmail] = useState(lockedEmail ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    setError(null)
    if (!email.trim() || !password) return setError('Saisissez votre email et votre mot de passe.')
    setPending(true)
    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Bandeau de marque : indigo, formes douces, promesse en une ligne. */}
      <View style={{ paddingTop: insets.top + 28, backgroundColor: PRIMARY }} className="relative overflow-hidden px-7 pb-16">
        <View className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <View className="absolute -left-24 bottom-[-90px] h-56 w-56 rounded-full bg-black/10" />
        <View className="flex-row items-center gap-3">
          <Image source={require('@/assets/images/icon.png')} style={{ width: 52, height: 52, borderRadius: 14 }} />
          <View>
            <Text className="text-xl font-semibold text-white">Sekoliko Prof</Text>
            <Text className="text-xs text-white/70">L'espace des enseignants</Text>
          </View>
        </View>
        <Text className="mt-8 text-3xl font-semibold leading-tight text-white">Votre classe,{'\n'}dans votre poche.</Text>
        <View className="mt-5 flex-row gap-2">
          {[
            { icon: ClipboardCheck, label: 'Appel' },
            { icon: BookOpen, label: 'Notes' },
            { icon: WifiOff, label: 'Sans Internet' },
          ].map((f) => (
            <View key={f.label} className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <f.icon size={13} color="#fff" />
              <Text className="text-xs font-medium text-white">{f.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Carte de connexion qui chevauche le bandeau. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="-mt-8 flex-1">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
          <View className="rounded-3xl border border-border bg-card p-6" style={{ shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}>
            <Text className="text-2xl font-semibold">Connexion</Text>
            <Text className="mb-6 mt-1 text-sm text-muted-foreground">{lockedEmail ? 'Saisissez votre mot de passe pour reprendre — même sans Internet.' : "Identifiants fournis par l'administration de votre école."}</Text>

            <View className="gap-3">
              <Field
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                placeholder="Adresse email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
              <Field
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                secureTextEntry={!show}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                right={
                  <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                    {show ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                  </Pressable>
                }
              />
            </View>

            {error ? (
              <View className="mt-4 flex-row items-start gap-2 rounded-xl bg-red-50 p-3">
                <AlertCircle size={16} color="#B91C1C" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-sm text-red-700">{error}</Text>
              </View>
            ) : null}

            <Button label="Se connecter" loading={pending} onPress={submit} size="lg" className="mt-6 rounded-xl" />

            <Text className="mt-5 text-center text-xs leading-5 text-muted-foreground">
              Mot de passe oublié ? Demandez à l'administration de l'école de le réinitialiser.
            </Text>
          </View>

          <Text className="mt-auto pt-8 text-center text-xs text-muted-foreground">Sekoliko · Gestion scolaire</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
