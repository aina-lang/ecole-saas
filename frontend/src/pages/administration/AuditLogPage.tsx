import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import {
  MagnifyingGlassIcon,
  EyeOpenIcon,
  ReloadIcon
} from '@radix-ui/react-icons'

interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown> | null
  ipAddress: string
}

const actionLabels: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  SYNC_START: 'Début synchro',
  SYNC_COMPLETE: 'Fin synchro',
  EXPORT: 'Export',
  IMPORT: 'Import',
  TOGGLE_ACTIVE: 'Activation/Désactivation'
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  LOGIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  LOGOUT: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

export function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const limit = 20

  const { data: logsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audit-logs', search, actionFilter, entityFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      const filters: Record<string, unknown> = { limit, offset: (page - 1) * limit }
      if (search) filters.search = search
      if (actionFilter !== 'all') filters.action = actionFilter
      if (entityFilter !== 'all') filters.entityType = entityFilter
      if (dateFrom) filters.dateFrom = dateFrom
      if (dateTo) filters.dateTo = dateTo
      const data = await window.api.audit.query(filters) as AuditLog[]
      return { data, total: data.length, page, limit }
    }
  })

  const totalPages = logsData ? Math.ceil(logsData.total / limit) : 0

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('ellipsis')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i)
      }
      if (page < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Journal d'audit</h2>
          <p className="text-muted-foreground">
            Consultez l'historique des actions effectuées dans l'application
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
          <ReloadIcon className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtres</CardTitle>
          <CardDescription>Affinez la recherche dans le journal d'audit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par utilisateur ou action..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Combobox
              options={[
                { value: 'all', label: 'Toutes les actions' },
                { value: 'CREATE', label: 'Création' },
                { value: 'UPDATE', label: 'Modification' },
                { value: 'DELETE', label: 'Suppression' },
                { value: 'LOGIN', label: 'Connexion' },
                { value: 'LOGOUT', label: 'Déconnexion' },
                { value: 'SYNC_START', label: 'Début synchro' },
                { value: 'SYNC_COMPLETE', label: 'Fin synchro' },
                { value: 'EXPORT', label: 'Export' },
                { value: 'IMPORT', label: 'Import' }
              ]}
              value={actionFilter}
              onValueChange={(v) => { setActionFilter(v); setPage(1) }}
              placeholder="Action"
              className="w-[160px]"
            />
            <Combobox
              options={[
                { value: 'all', label: 'Toutes les entités' },
                { value: 'USER', label: 'Utilisateur' },
                { value: 'STUDENT', label: 'Élève' },
                { value: 'CLASS', label: 'Classe' },
                { value: 'GRADE', label: 'Note' },
                { value: 'PAYMENT', label: 'Paiement' },
                { value: 'ATTENDANCE', label: 'Présence' },
                { value: 'SETTINGS', label: 'Paramètres' },
                { value: 'SYNC', label: 'Synchronisation' }
              ]}
              value={entityFilter}
              onValueChange={(v) => { setEntityFilter(v); setPage(1) }}
              placeholder="Entité"
              className="w-[160px]"
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-[160px]"
              placeholder="Date début"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-[160px]"
              placeholder="Date fin"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Date/Heure</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Détails</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !logsData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Aucune entrée trouvée dans le journal d'audit
                  </TableCell>
                </TableRow>
              ) : (
                logsData.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.userName}</p>
                        <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || ''} variant="secondary">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.entityType}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]" title={log.entityId}>
                          {log.entityId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.details ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(log.details).slice(0, 2).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {String(value).length > 30 ? String(value).slice(0, 30) + '...' : String(value)}
                            </Badge>
                          ))}
                          {Object.keys(log.details).length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{Object.keys(log.details).length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                            <EyeOpenIcon className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                          <DialogHeader>
                            <DialogTitle>Détails de l'audit</DialogTitle>
                            <DialogDescription>Informations complètes de l'entrée sélectionnée</DialogDescription>
                          </DialogHeader>
                          {selectedLog && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Date/Heure</p>
                                  <p className="text-sm font-medium">
                                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Adresse IP</p>
                                  <p className="text-sm font-medium font-mono">{selectedLog.ipAddress}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Utilisateur</p>
                                  <p className="text-sm font-medium">{selectedLog.userName}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Email</p>
                                  <p className="text-sm font-medium">{selectedLog.userEmail}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Action</p>
                                  <Badge className={actionColors[selectedLog.action] || ''} variant="secondary">
                                    {actionLabels[selectedLog.action] || selectedLog.action}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Entité</p>
                                  <p className="text-sm font-medium">{selectedLog.entityType}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-muted-foreground">ID Entité</p>
                                  <p className="text-sm font-medium font-mono">{selectedLog.entityId}</p>
                                </div>
                              </div>

                              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                                <>
                                  <Separator />
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2">Détails complets</p>
                                    <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-[200px] font-mono">
                                      {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {getPageNumbers().map((p, i) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={page === p}
                    onClick={() => setPage(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
