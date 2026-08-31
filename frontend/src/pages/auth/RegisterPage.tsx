import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, CheckCircle2, School, UserRound } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const registerSchema = z
  .object({
    schoolName: z.string().min(1, "Le nom de l'école est requis"),
    adminFirstName: z.string().min(1, 'Le prénom est requis'),
    adminLastName: z.string().min(1, 'Le nom est requis'),
    adminEmail: z.string().email('Adresse email invalide'),
    adminPassword: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe')
  })
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  })

type RegisterValues = z.infer<typeof registerSchema>

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: '' }
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  if (pw.length >= 12) s++
  const score = Math.min(3, Math.max(1, Math.ceil(s * 0.75))) as 1 | 2 | 3
  return { score, label: ['', 'Faible', 'Moyen', 'Solide'][score] }
}

function SectionTitle({ icon: Icon, children }: { icon: typeof School; children: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      schoolName: '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminPassword: '',
      confirmPassword: ''
    }
  })

  async function onSubmit(values: RegisterValues) {
    setError(null)
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values
      await register(payload)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      console.error('[FRONTEND] register error', err)
      setError(extractErrorMessage(err, "Erreur lors de la création du compte"))
    }
  }

  const strength = passwordStrength(form.watch('adminPassword'))

  if (success) {
    return (
      <AuthShell title="Compte créé" subtitle="Votre établissement est prêt. Redirection vers la connexion…">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>Connectez-vous avec l'adresse email et le mot de passe que vous venez de définir.</span>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      wide
      title="Créer un compte"
      subtitle="Inscrivez votre établissement et son compte administrateur (connexion Internet requise)."
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <section className="space-y-3">
            <SectionTitle icon={School}>Établissement</SectionTitle>
            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'école</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. Lycée Les Jardins" autoFocus className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-3">
            <SectionTitle icon={UserRound}>Administrateur</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="adminFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" autoComplete="given-name" className="h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" autoComplete="family-name" className="h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vous@etablissement.mg" autoComplete="email" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="adminPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="8 caractères minimum" autoComplete="new-password" className="h-10" {...field} />
                  </FormControl>
                  {strength.score > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex flex-1 gap-1">
                        {[1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1 flex-1 rounded-full bg-muted transition-colors',
                              i <= strength.score && (strength.score === 1 ? 'bg-red-500' : strength.score === 2 ? 'bg-amber-500' : 'bg-emerald-500'),
                            )}
                          />
                        ))}
                      </div>
                      <span className="w-12 text-right text-xs text-muted-foreground">{strength.label}</span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer le mot de passe</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Retapez le mot de passe" autoComplete="new-password" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" className="h-10 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création du compte…
              </>
            ) : (
              "Créer l'établissement"
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  )
}
