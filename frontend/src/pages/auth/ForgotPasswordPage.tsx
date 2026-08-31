import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, MailCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AuthShell } from '@/components/auth/AuthShell'
import { SupportContact } from '@/components/support-contact'
import client, { extractErrorMessage } from '@/api/client'

const schema = z.object({ email: z.string().email('Adresse email invalide') })
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  async function onSubmit(values: Values) {
    setError(null)
    try {
      await client.post('/auth/forgot-password', { email: values.email.trim().toLowerCase() })
      setSentTo(values.email.trim().toLowerCase())
    } catch (err) {
      setError(extractErrorMessage(err, "Impossible d'envoyer la demande"))
    }
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Saisissez l'adresse e-mail de votre compte : nous vous envoyons un code de réinitialisation valable 30 minutes."
      footer={
        <>
          <Link to="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link>
          {' · '}
          <Link to="/reset-password" className="font-medium text-primary hover:underline">J'ai déjà un code</Link>
        </>
      }
    >
      {sentTo ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-200">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Si un compte existe pour <strong>{sentTo}</strong>, un e-mail contenant un code vient d'être envoyé.
              Pensez à vérifier le dossier « spam ».
            </span>
          </div>
          <Button className="h-11 w-full" onClick={() => navigate('/reset-password')}>
            Saisir le code reçu
          </Button>
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>Pas d'e-mail reçu ? Le support peut vous remettre un mot de passe temporaire :</p>
            <SupportContact compact />
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {!navigator.onLine && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-200">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Vous êtes hors ligne : la réinitialisation nécessite Internet.</span>
              </div>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vous@etablissement.mg" autoComplete="email" autoFocus className="h-11" {...field} />
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
              {form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</>) : 'Envoyer le code'}
            </Button>
          </form>
        </Form>
      )}
    </AuthShell>
  )
}
