import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { ArrowLeftIcon, DownloadIcon, PaperPlaneIcon, PrinterIcon } from '@radix-ui/react-icons'
import client from '@/api/client'
import type { Message, ApiResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const priorityConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Basse', variant: 'outline' },
  normal: { label: 'Normal', variant: 'secondary' },
  high: { label: 'Haut', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'destructive' }
}

function fetchMessage(id: string): Promise<ApiResponse<Message>> {
  return client.get(`/messages/${id}`).then((r) => r.data)
}

function markAsRead(id: string) {
  return client.patch(`/messages/${id}/read`).then((r) => r.data)
}

export function MessageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: () => fetchMessage(id!),
    enabled: !!id
  })

  useQuery({
    queryKey: ['message-read', id],
    queryFn: () => markAsRead(id!),
    enabled: !!id && (data?.data?.status === 'sent' || data?.data?.status === 'draft')
  })

  const message = data?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Message introuvable
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <PrinterIcon className="h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <DownloadIcon className="h-4 w-4" />
            Télécharger
          </Button>
          <Button size="sm" className="gap-2" onClick={() => navigate('/communications/compose')}>
            <PaperPlaneIcon className="h-4 w-4" />
            Répondre
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{message.subject}</h1>
              <p className="text-sm text-muted-foreground">
                De : <span className="font-medium text-foreground">{message.senderId}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Date : {format(new Date(message.createdAt), 'PPP à HH:mm', { locale: fr })}
              </p>
              <p className="text-sm text-muted-foreground">
                Statut :{' '}
                <span className="capitalize">
                  {message.status === 'sent'
                    ? 'Envoyé'
                    : message.status === 'read'
                      ? 'Lu'
                      : message.status === 'draft'
                        ? 'Brouillon'
                        : 'Archivé'}
                </span>
              </p>
            </div>
            <Badge variant={priorityConfig[message.priority]?.variant ?? 'secondary'}>
              {priorityConfig[message.priority]?.label ?? message.priority}
            </Badge>
          </div>

          <Separator className="mb-6" />

          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {message.body}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
