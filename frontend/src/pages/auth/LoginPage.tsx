import { useEffect, useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock, WifiOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { AuthShell } from '@/components/auth/AuthShell'
import { useAuthStore } from '@/stores/auth-store'
import { extractErrorMessage } from '@/api/client'

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide').min(1, "L'email est requis"),
  password: z.string().min(1, 'Le mot de passe est requis')
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const lockedSession = useAuthStore((s) => s.lockedSession)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: lockedSession?.email ?? '', password: '' }
  })

  // hydrate() résout de façon asynchrone après le premier rendu : si une session
  // verrouillée apparaît ensuite, on préremplit l'email pour l'écran de déverrouillage.
  useEffect(() => {
    if (lockedSession?.email) {
      form.setValue('email', lockedSession.email)
    }
  }, [lockedSession, form])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(values: LoginValues) {
    setError(null)
    try {
      await login(values.email, values.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('[FRONTEND] login error', err)
      setError(extractErrorMessage(err))
    }
  }

  const lockedName = lockedSession
    ? `${lockedSession.firstName ?? ''} ${lockedSession.lastName ?? ''}`.trim() || lockedSession.email
    : ''

  return (
    <AuthShell
      eyebrow={lockedSession ? 'Bon retour' : undefined}
      title={lockedSession ? 'Session verrouillée' : 'Connexion'}
      subtitle={
        lockedSession
          ? 'Saisissez votre mot de passe pour reprendre là où vous en étiez.'
          : 'Connectez-vous à votre espace de gestion scolaire.'
      }
      footer={
        lockedSession ? (
          <>
            Ce n'est pas vous ?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Créer un autre établissement
            </Link>
          </>
        ) : (
          <>
            Nouvel établissement ?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Créer un compte
            </Link>
          </>
        )
      }
    >
      {!online && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-200">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Vous êtes hors ligne. {lockedSession ? 'Le déverrouillage reste possible avec votre mot de passe habituel.' : 'La première connexion d’un compte nécessite Internet.'}
          </span>
        </div>
      )}

      {lockedSession && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {(lockedSession.firstName?.[0] ?? '') + (lockedSession.lastName?.[0] ?? '') || <Lock className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{lockedName}</p>
            <p className="truncate text-xs text-muted-foreground">{lockedSession.email}</p>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {!lockedSession && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="vous@etablissement.mg"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      className="h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Mot de passe</FormLabel>
                  <Link to="/forgot-password" tabIndex={-1} className="text-xs font-medium text-primary hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    placeholder="Votre mot de passe"
                    autoComplete="current-password"
                    autoFocus={!!lockedSession}
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {lockedSession ? 'Déverrouillage…' : 'Connexion…'}
              </>
            ) : lockedSession ? (
              'Déverrouiller'
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  )
}
