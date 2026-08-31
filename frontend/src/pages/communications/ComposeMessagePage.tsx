import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Send } from 'lucide-react'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { PageHeader, FormShell, FormSection } from '@/components/layout/page'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const composeSchema = z.object({
  recipients: z.array(z.string()).min(1, 'Au moins un destinataire requis'),
  subject: z.string().min(1, 'Le sujet est requis'),
  body: z.string().min(1, 'Le corps du message est requis'),
  priority: z.enum(['normal', 'high', 'urgent'])
})

type ComposeValues = z.infer<typeof composeSchema>

function searchUsers(query: string): Promise<User[]> {
  return queryEntities('User').then((users) => {
    const q = query.toLowerCase()
    return (users ?? []).filter(
      (u) => (u.firstName || '').toLowerCase().includes(q) || (u.lastName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    )
  })
}

function sendMessage(data: ComposeValues & { attachments: File[] }) {
  // senderId : sans lui, le message se réplique bien entre postes mais le
  // serveur ne peut jamais le persister (colonne obligatoire côté Prisma).
  let senderId: string | undefined
  try {
    senderId = JSON.parse(localStorage.getItem('auth-user') || 'null')?.id
  } catch { /* pas de session locale */ }
  return saveEntity('Message', {
    id: crypto.randomUUID(),
    senderId,
    subject: data.subject,
    body: data.body,
    recipients: data.recipients,
    isRead: false,
    isArchived: false,
  })
}

export function ComposeMessagePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  const form = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      recipients: [],
      subject: '',
      body: '',
      priority: 'normal'
    }
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: searchQuery.length > 0
  })

  const sendMutation = useMutation({
    mutationFn: (values: ComposeValues) => sendMessage({ ...values, attachments }),
    onSuccess: () => {
      toast.success('Message envoyé avec succès')
      navigate('/communications/inbox')
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi du message")
    }
  })

  const recipients = form.watch('recipients')
  const users = usersData ?? []

  const addRecipient = useCallback(
    (userId: string) => {
      const current = form.getValues('recipients')
      if (!current.includes(userId)) {
        form.setValue('recipients', [...current, userId])
      }
      setOpen(false)
    },
    [form]
  )

  const removeRecipient = useCallback(
    (userId: string) => {
      form.setValue(
        'recipients',
        recipients.filter((r) => r !== userId)
      )
    },
    [form, recipients]
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  function onSubmit(values: ComposeValues) {
    sendMutation.mutate(values)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/communications/inbox"
        title="Nouveau message"
        description="Composez un message à destination d'un ou plusieurs destinataires."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormShell
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={sendMutation.isPending} className="gap-2">
                  <Send className="h-4 w-4" />
                  {sendMutation.isPending ? 'Envoi en cours...' : 'Envoyer'}
                </Button>
              </>
            }
          >
            <FormSection title="Destinataires et objet" description="À qui s'adresse ce message et sa priorité.">
              <FormField
                control={form.control}
                name="recipients"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Destinataires *</FormLabel>
                    <FormControl>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring">
                            {recipients.length === 0 && (
                              <span className="text-muted-foreground">
                                Sélectionner des destinataires...
                              </span>
                            )}
                            {recipients.map((id) => {
                              const u = users.find((x) => x.id === id)
                              return (
                                <Badge key={id} variant="secondary" className="gap-1">
                                   {u ? `${u.firstName ? `${u.firstName} ` : ''}${u.lastName}` : id}
                                  <button type="button" onClick={() => removeRecipient(id)}>
                                    <Cross2Icon className="h-3 w-3" />
                                  </button>
                                </Badge>
                              )
                            })}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Rechercher un utilisateur..."
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                            />
                            <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
                            <CommandGroup>
                              {users.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.id}
                                   keywords={[`${u.firstName ? `${u.firstName} ` : ''}${u.lastName}`, u.email].filter(Boolean)}
                                  onSelect={() => addRecipient(u.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {u.firstName} {u.lastName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{u.email}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sujet *</FormLabel>
                    <FormControl>
                      <Input placeholder="Objet du message" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorité</FormLabel>
                    <Combobox
                      options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'high', label: 'Haut' },
                        { value: 'urgent', label: 'Urgent' }
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Sélectionner une priorité"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection title="Contenu" description="Corps du message et pièces jointes.">
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Message *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Contenu du message..."
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2 space-y-2">
                <FormLabel>Pièces jointes</FormLabel>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Ajouter un fichier
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((f, i) => (
                      <Badge key={i} variant="outline" className="gap-1">
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Cross2Icon className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>
          </FormShell>
        </form>
      </Form>
    </div>
  )
}
