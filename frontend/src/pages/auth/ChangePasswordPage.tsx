import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, KeyRound, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/layout/page'
import client, { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth-store'
import { saveLocalPasswordVerifier } from '@/lib/db/pouchdb-auth'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
    confirm: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((d) => d.newPassword === d.confirm, { message: 'Les mots de passe ne correspondent pas', path: ['confirm'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Choisissez un mot de passe différent', path: ['newPassword'] })
type Values = z.infer<typeof schema>

/**
 * Changement de mot de passe. Affichée de force (route imposée) quand le
 * compte a reçu un mot de passe temporaire du support.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const forced = !!user?.mustChangePassword
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })

  async function onSubmit(values: Values) {
    setError(null)
    try {
      await client.post('/auth/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword })
      // L'empreinte locale sert au déverrouillage hors ligne : on la met à jour.
      if (user) await saveLocalPasswordVerifier(user.email, values.newPassword, user.tenantId).catch(() => {})
      if (user) setUser({ ...user, mustChangePassword: false })
      toast.success('Mot de passe modifié')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossible de modifier le mot de passe'))
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={forced ? 'Choisissez votre mot de passe' : 'Changer le mot de passe'}
        description={forced ? 'Vous vous êtes connecté avec un mot de passe temporaire : définissez le vôtre pour continuer.' : 'Modifiez le mot de passe de votre compte.'}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Nouveau mot de passe
          </CardTitle>
          <CardDescription>Le changement nécessite une connexion Internet ; il s'applique ensuite aussi hors ligne.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!navigator.onLine && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-200">
                  <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Vous êtes hors ligne : reconnectez-vous pour changer le mot de passe.</span>
                </div>
              )}
              <FormField control={form.control} name="currentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>{forced ? 'Mot de passe temporaire' : 'Mot de passe actuel'}</FormLabel>
                  <FormControl><PasswordInput autoComplete="current-password" autoFocus {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau mot de passe</FormLabel>
                  <FormControl><PasswordInput placeholder="8 caractères minimum" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer</FormLabel>
                  <FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {!forced && <Button type="button" variant="outline" onClick={() => navigate(-1)}>Annuler</Button>}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>) : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
