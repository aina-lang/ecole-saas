import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AuthShell } from '@/components/auth/AuthShell'
import client, { extractErrorMessage } from '@/api/client'

const schema = z
  .object({
    token: z.string().trim().min(20, 'Code incomplet — copiez-le intégralement depuis l’e-mail'),
    password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
    confirm: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((d) => d.password === d.confirm, { message: 'Les mots de passe ne correspondent pas', path: ['confirm'] })
type Values = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { token: params.get('token') ?? '', password: '', confirm: '' },
  })

  async function onSubmit(values: Values) {
    setError(null)
    try {
      await client.post('/auth/reset-password', { token: values.token.trim(), password: values.password })
      toast.success('Mot de passe modifié — connectez-vous')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err, 'Code invalide ou expiré'))
    }
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Collez le code reçu par e-mail et choisissez votre nouveau mot de passe."
      footer={
        <>
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">Demander un nouveau code</Link>
          {' · '}
          <Link to="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code de réinitialisation</FormLabel>
                <FormControl>
                  <Input placeholder="Code reçu par e-mail" autoComplete="off" spellCheck={false} autoFocus={!field.value} className="h-11 font-mono text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nouveau mot de passe</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="8 caractères minimum" autoComplete="new-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmer le mot de passe</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Retapez le mot de passe" autoComplete="new-password" className="h-11" {...field} />
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
          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>) : 'Changer le mot de passe'}
          </Button>
        </form>
      </Form>
    </AuthShell>
  )
}
