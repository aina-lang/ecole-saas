import { useState } from 'react'
import { Loader2, AlertCircle, KeyRound, Copy, Check, MailCheck, MailX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import client, { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth-store'
import { saveLocalPasswordVerifier } from '@/lib/db/pouchdb-auth'

/**
 * Mot de passe d'un utilisateur.
 * - Compte d'un tiers (admin) : RÉINITIALISATION AUTOMATIQUE — le serveur
 *   génère un mot de passe temporaire, l'envoie par e-mail et le renvoie ici
 *   pour affichage/copie ; changement obligatoire à la première connexion.
 * - Son propre compte : changement avec mot de passe actuel.
 * Passe toujours par l'API (jamais par un document synchronisé) — en ligne.
 */
export function SetPasswordDialog({
  open, onOpenChange, userId, userName, isSelf = false,
}: { open: boolean; onOpenChange: (o: boolean) => void; userId: string | null; userName: string; isSelf?: boolean }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string | null; password: string; emailed: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const user = useAuthStore((s) => s.user)

  function close(o: boolean) {
    if (pending) return
    if (!o) { setError(null); setResult(null); setCurrent(''); setPassword(''); setConfirm('') }
    onOpenChange(o)
  }

  async function changeOwn() {
    setError(null)
    if (!current) return setError('Saisissez votre mot de passe actuel')
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    setPending(true)
    try {
      await client.post('/auth/change-password', { currentPassword: current, newPassword: password })
      if (user) await saveLocalPasswordVerifier(user.email, password, user.tenantId).catch(() => {})
      toast.success('Votre mot de passe a été modifié')
      close(false)
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossible de modifier le mot de passe'))
    } finally {
      setPending(false)
    }
  }

  async function regenerate() {
    if (!userId) return
    setError(null); setPending(true)
    try {
      const { data } = await client.post(`/users/${userId}/reset-password`)
      setResult({ email: data.email ?? null, password: data.temporaryPassword, emailed: !!data.credentialsEmailed })
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossible de réinitialiser le mot de passe'))
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result.password); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* presse-papiers indisponible */ }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />{isSelf ? 'Changer mon mot de passe' : 'Réinitialiser le mot de passe'}</DialogTitle>
          <DialogDescription>
            {isSelf
              ? 'Pour votre sécurité, votre mot de passe actuel est demandé.'
              : result
                ? <>Nouveau mot de passe temporaire de <strong>{userName}</strong>. Il devra le changer à sa première connexion.</>
                : <>Un mot de passe temporaire sera <strong>généré automatiquement</strong> pour <strong>{userName}</strong>, envoyé par e-mail et affiché ici. L'ancien mot de passe cessera de fonctionner.</>}
          </DialogDescription>
        </DialogHeader>

        {isSelf ? (
          <div className="space-y-3">
            {!navigator.onLine && <p className="text-sm text-amber-700 dark:text-amber-300">Vous êtes hors ligne : cette action nécessite Internet.</p>}
            <div className="space-y-1.5">
              <Label htmlFor="set-pw-current">Mot de passe actuel</Label>
              <PasswordInput id="set-pw-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-pw">Nouveau mot de passe</Label>
              <PasswordInput id="set-pw" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-pw-confirm">Confirmer</Label>
              <PasswordInput id="set-pw-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && changeOwn()} />
            </div>
          </div>
        ) : result ? (
          <div className="space-y-3">
            {result.email && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Identifiant</p>
                <p className="font-medium">{result.email}</p>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Mot de passe temporaire</p>
                <p className="font-mono text-xl font-semibold tracking-widest">{result.password}</p>
              </div>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="mr-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
                Copier
              </Button>
            </div>
            <p className={`flex items-center gap-2 text-sm ${result.emailed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {result.emailed ? <MailCheck className="h-4 w-4 shrink-0" /> : <MailX className="h-4 w-4 shrink-0" />}
              {result.emailed ? `Envoyé par e-mail à ${result.email}.` : result.email ? "E-mail non envoyé (messagerie non configurée) — communiquez-le directement." : 'Aucun e-mail sur ce compte — communiquez-le directement.'}
            </p>
            <p className="text-xs text-muted-foreground">Ce mot de passe ne sera plus affiché après la fermeture de cette fenêtre.</p>
          </div>
        ) : (
          !navigator.onLine && <p className="text-sm text-amber-700 dark:text-amber-300">Vous êtes hors ligne : cette action nécessite Internet.</p>
        )}

        {error && (
          <p className="flex items-start gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
        )}

        <DialogFooter>
          {isSelf ? (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={pending}>Annuler</Button>
              <Button onClick={changeOwn} disabled={pending || !navigator.onLine}>
                {pending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>) : 'Enregistrer'}
              </Button>
            </>
          ) : result ? (
            <Button onClick={() => close(false)}>Terminer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={pending}>Annuler</Button>
              <Button onClick={regenerate} disabled={pending || !navigator.onLine || !userId}>
                {pending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération…</>) : 'Générer un nouveau mot de passe'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
