import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, Printer, Send } from 'lucide-react'
import { saveEntity, getEntityById } from '@/lib/db/pouchdb-compat'
import type { Message } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, DetailHeader, InfoGrid, EmptyState } from '@/components/layout/page'

const priorityConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Basse', variant: 'outline' },
  normal: { label: 'Normal', variant: 'secondary' },
  high: { label: 'Haut', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'destructive' }
}

function fetchMessage(id: string): Promise<Message | null> {
  return getEntityById<Message>('Message', id)
}

function markAsRead(id: string) {
  return saveEntity('Message', { id, isRead: true })
}

export function MessageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: message, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: () => fetchMessage(id!),
    enabled: !!id
  })

  useQuery({
    queryKey: ['message-read', id],
    queryFn: () => markAsRead(id!),
    enabled: !!id && message !== null
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Chargement...
      </div>
    )
  }

  if (!message) {
    return (
      <div className="space-y-6">
        <PageHeader backTo={-1} title="Message introuvable" />
        <EmptyState title="Message introuvable" description="Ce message n'existe pas ou a été supprimé." />
      </div>
    )
  }

  const statusLabel =
    message.status === 'sent'
      ? 'Envoyé'
      : message.status === 'read'
        ? 'Lu'
        : message.status === 'draft'
          ? 'Brouillon'
          : 'Archivé'
  const dateLabel = format(new Date(message.createdAt), 'PPP à HH:mm', { locale: fr })

  return (
    <div className="space-y-6">
      <PageHeader
        backTo={-1}
        title={message.subject}
        description={`Reçu le ${dateLabel}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
            <Button size="sm" className="gap-2" onClick={() => navigate('/communications/compose')}>
              <Send className="h-4 w-4" />
              Répondre
            </Button>
          </>
        }
      />

      <DetailHeader
        title={message.subject}
        badges={
          <>
            <Badge variant={priorityConfig[message.priority]?.variant ?? 'secondary'}>
              {priorityConfig[message.priority]?.label ?? message.priority}
            </Badge>
            <Badge variant="outline">{statusLabel}</Badge>
          </>
        }
        meta={
          <>
            <span>De : <span className="font-medium text-foreground">{message.senderId}</span></span>
            <span>{dateLabel}</span>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-6 p-6">
          <InfoGrid
            columns={3}
            items={[
              { label: 'Expéditeur', value: message.senderId },
              { label: 'Date', value: dateLabel },
              { label: 'Statut', value: statusLabel },
            ]}
          />
          <div className="whitespace-pre-wrap border-t pt-6 text-sm leading-relaxed">
            {message.body}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
