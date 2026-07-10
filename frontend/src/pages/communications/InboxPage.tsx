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
  PlusIcon,
  ReaderIcon,
  TrashIcon
} from '@radix-ui/react-icons'
import { Send } from 'lucide-react'
import client from '@/api/client'
import type { Message, ApiResponse, PaginatedResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

function fetchMessages(
  folder: Folder,
  search: string
): Promise<ApiResponse<PaginatedResponse<Message>>> {
  return client.get('/messages', { params: { folder, search } }).then((r) => r.data)
}

function archiveMessage(id: string) {
  return client.patch(`/messages/${id}/archive`).then((r) => r.data)
}

function deleteMessage(id: string) {
  return client.delete(`/messages/${id}`).then((r) => r.data)
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

  const messages = data?.data?.data ?? []

  function handleFolderChange(folder: Folder) {
    setSearchParams({ folder })
    setSearch('')
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-lg border">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r bg-muted/30">
        <div className="p-4">
          <Button className="w-full gap-2" onClick={() => navigate('/communications/compose')}>
            <PlusIcon className="h-4 w-4" />
            Nouveau message
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="space-y-1 px-2 pb-4">
            {folders.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFolderChange(f.key)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  activeFolder === f.key
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <f.icon className="h-4 w-4" />
                {f.label}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Message list */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b p-4">
          <Input
            placeholder="Rechercher un message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Chargement...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Aucun message
            </div>
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
