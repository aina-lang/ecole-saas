import { useState } from 'react'
import { Copy, Check, MailCheck, MailX, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface Credentials {
  name: string
  email: string
  password: string
  emailed: boolean
}

/**
 * Affiché une seule fois après la création d'un compte : identifiant et mot
 * de passe temporaire, avec copie en un clic et l'état de l'envoi par e-mail.
 */
export function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState<'password' | 'all' | null>(null)
  if (!credentials) return null
  const c = credentials

  async function copy(what: 'password' | 'all') {
    const text = what === 'password' ? c.password : `Identifiant : ${c.email}\nMot de passe temporaire : ${c.password}`
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1500) } catch { /* presse-papiers indisponible */ }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Compte créé</DialogTitle>
          <DialogDescription>
            Identifiants de <strong>{c.name}</strong>. Le mot de passe est temporaire : il devra être changé à la première connexion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Identifiant</p>
            <p className="font-medium">{c.email}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Mot de passe temporaire</p>
              <p className="font-mono text-xl font-semibold tracking-widest">{c.password}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy('password')}>
              {copied === 'password' ? <Check className="mr-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
              Copier
            </Button>
          </div>
          <p className={`flex items-center gap-2 text-sm ${c.emailed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {c.emailed ? <MailCheck className="h-4 w-4 shrink-0" /> : <MailX className="h-4 w-4 shrink-0" />}
            {c.emailed
              ? `Identifiants envoyés par e-mail à ${c.email}.`
              : "E-mail non envoyé (messagerie non configurée) — communiquez le mot de passe directement."}
          </p>
          <p className="text-xs text-muted-foreground">Ce mot de passe ne sera plus affiché après la fermeture de cette fenêtre.</p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => copy('all')}>
            {copied === 'all' ? <Check className="mr-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
            Copier identifiant + mot de passe
          </Button>
          <Button onClick={onClose}>Terminer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
