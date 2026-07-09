import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const registerSchema = z
  .object({
    schoolName: z.string().min(1, "Le nom de l'école est requis"),
    subdomain: z
      .string()
      .min(1, 'Le sous-domaine est requis')
      .regex(/^[a-z0-9-]+$/, 'Lettres minuscules, chiffres et tirets uniquement'),
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

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      schoolName: '',
      subdomain: '',
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setError(message)
    }
  }

  return (
    <AuthShell title="Créer un compte" subtitle="Inscrivez votre établissement en quelques secondes">
      {success ? (
            <div className="rounded-md bg-emerald-500/10 p-3 text-center text-sm text-emerald-600 dark:text-emerald-400">
              Établissement créé avec succès. Redirection...
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'école</FormLabel>
                        <FormControl>
                          <Input placeholder="Lycée Victor Hugo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subdomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-domaine</FormLabel>
                        <FormControl>
                          <Input placeholder="lycee-victor-hugo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adminFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} />
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
                          <Input placeholder="Dupont" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@ecole.com" type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adminPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                )}

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Création...' : "S'inscrire"}
                </Button>
              </form>
            </Form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </p>
    </AuthShell>
  )
}
