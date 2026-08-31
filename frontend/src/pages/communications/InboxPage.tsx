import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ArchiveIcon,
  Pencil1Icon,
  EnvelopeClosedIcon,
  EnvelopeOpenIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon
} from '@radix-ui/react-icons'
import { Send, RotateCw } from 'lucide-react'
import { queryEntities, saveEntity } from '@/lib/db/pouchdb-compat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageHeader, FilterBar, EmptyState } from '@/components/layout/page'

type Folder = 'inbox' | 'sent' | 'drafts' | 'archived'

const folders: { key: Folder; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'inbox', label: 'Boîte de réception', icon: EnvelopeClosedIcon },
  { key: 'sent', label: 'Envoyés', icon: Send },
  { key: 'drafts', label: 'Brouillons', icon: Pencil1Icon },
  { key: 'archived', label: 'Archivés', icon: ArchiveIcon }
]

const priorityConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  normal: { label: 'Normal', variant: 'secondary' },
  high: { label: 'Haut', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'destructive' }
}

function fetchMessages(folder: Folder, search: string): Promise<any[]> {
  return queryEntities('Message', { ...(search ? { search } : {}) }).then((items) => {
    let filtered = items ?? []
    if (folder === 'archived') filtered = filtered.filter((m) => m.isArchived)
    else if (folder === 'sent') filtered = filtered.filter((m) => m.senderId === 'me')
    else filtered = filtered.filter((m) => !m.isArchived)
    if (search) filtered = filtered.filter((m) => (m.subject || '').toLowerCase().includes(search.toLowerCase()))
    return filtered
  })
}

function archiveMessage(id: string) {
  return saveEntity('Message', { id, isArchived: true })
}

function deleteMessage(id: string) {
  return saveEntity('Message', { id, deletedAt: new Date().toISOString() })
}

export function InboxPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFolder: Folder = (searchParams.get('folder') as Folder) || 'inbox'
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['messages', activeFolder, search],
    queryFn: () => fetchMessages(activeFolder, search)
  })

  const archiveMutation = useMutation({
    mutationFn: archiveMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast.success('Message archivé')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast.success('Message supprimé')
      setDeleteId(null)
    }
  })

  const messages = data ?? []

  function handleFolderChange(folder: Folder) {
    setSearchParams({ folder })
    setSearch('')
  }

  const activeFolderLabel = folders.find((f) => f.key === activeFolder)?.label ?? 'Messages'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie"
        description="Consultez, archivez et gérez vos messages."
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['messages'] })}
              disabled={isLoading}
              aria-label="Rafraîchir"
            >
              <RotateCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button className="gap-2" onClick={() => navigate('/communications/compose')}>
              <PlusIcon className="h-4 w-4" />
              Nouveau message
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="flex flex-wrap items-center gap-1">
          {folders.map((f) => (
            <Button
              key={f.key}
              type="button"
              variant={activeFolder === f.key ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => handleFolderChange(f.key)}
            >
              <f.icon className="h-4 w-4" />
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un message..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      <div className="flex h-[calc(100vh-18rem)] min-h-[320px] flex-col overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-6 py-3 text-sm font-medium">
          {activeFolderLabel}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{messages.length} message(s)</span>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Chargement...
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<EnvelopeOpenIcon className="h-5 w-5" />}
              title="Aucun message"
              description="Ce dossier est vide pour le moment."
            />
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'group flex cursor-pointer items-start gap-4 px-6 py-4 transition-colors hover:bg-accent/50',
                    msg.status === 'read' ? '' : 'bg-accent/20'
                  )}
                  onClick={() => navigate(`/communications/${msg.id}`)}
                >
                  <div className="flex shrink-0 pt-1">
                    {msg.status === 'read' ? (
                      <EnvelopeOpenIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EnvelopeClosedIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('truncate text-sm', msg.status !== 'read' && 'font-semibold')}
                      >
                        {msg.subject}
                      </span>
                      {msg.priority !== 'normal' && (
                        <Badge
                          variant={priorityConfig[msg.priority]?.variant ?? 'secondary'}
                          className="shrink-0 text-[10px]"
                        >
                          {priorityConfig[msg.priority]?.label ?? msg.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{msg.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(msg.createdAt), 'dd MMM', { locale: fr })}
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {activeFolder !== 'archived' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            archiveMutation.mutate(msg.id)
                          }}
                        >
                          <ArchiveIcon className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteId(msg.id)
                        }}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                      <ConfirmDialog
                        open={deleteId === msg.id}
                        onOpenChange={(open) => !open && setDeleteId(null)}
                        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
                        title="Supprimer le message"
                        description="Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
