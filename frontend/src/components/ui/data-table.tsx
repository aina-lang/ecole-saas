import * as React from 'react'
import { useState, useMemo } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TrashIcon } from '@radix-ui/react-icons'

export type SortDirection = 'asc' | 'desc'

export interface ColumnDef<T> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  filterType?: 'text' | 'select'
  filterOptions?: { value: string; label: string }[]
  render?: (row: T) => React.ReactNode
  className?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onSortChange?: (key: string, direction: SortDirection) => void
  sortKey?: string
  sortDirection?: SortDirection
  filters?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  onRowClick?: (row: T) => void
  onBulkDelete?: (ids: string[]) => void
  getRowId: (row: T) => string
  isLoading?: boolean
  emptyMessage?: string
  bulkDeleteLabel?: string
  renderRowActions?: (row: T) => React.ReactNode
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('ellipsis')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i)
    }
    if (current < total - 2) pages.push('ellipsis')
    pages.push(total)
  }
  return pages
}

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  limit,
  onPageChange,
  onSortChange,
  sortKey,
  sortDirection,
  filters = {},
  onFilterChange,
  onRowClick,
  onBulkDelete,
  getRowId,
  isLoading,
  emptyMessage = 'Aucune donnée trouvée',
  bulkDeleteLabel = 'élément(s)',
  renderRowActions,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allSelected = data.length > 0 && data.every((row) => selectedIds.has(getRowId(row)))
  const someSelected = data.some((row) => selectedIds.has(getRowId(row))) && !allSelected

  const toggleSort = (key: string) => {
    if (!onSortChange) return
    if (sortKey === key) {
      onSortChange(key, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      onSortChange(key, 'asc')
    }
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        data.forEach((row) => next.delete(getRowId(row)))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        data.forEach((row) => next.add(getRowId(row)))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedIds.size === 0) return
    onBulkDelete(Array.from(selectedIds))
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
  }

  const filterableColumns = useMemo(
    () => columns.filter((col) => col.filterable),
    [columns]
  )

  return (
    <div className="space-y-4">
      {filterableColumns.length > 0 && onFilterChange && (
        <div className="flex flex-wrap gap-3">
          {filterableColumns.map((column) => (
            <div key={column.key} className="min-w-[180px] flex-1">
              {column.filterType === 'select' && column.filterOptions ? (
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters[column.key] ?? ''}
                  onChange={(e) => {
                    onFilterChange(column.key, e.target.value)
                  }}
                >
                  <option value="">Tous</option>
                  {column.filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={`Rechercher par ${column.label.toLowerCase()}...`}
                  value={filters[column.key] ?? ''}
                  onChange={(e) => onFilterChange(column.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && onBulkDelete && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2 text-sm">
          <span>{selectedIds.size} {bulkDeleteLabel} sélectionné(s)</span>
          <ConfirmDialog
            open={bulkDeleteOpen}
            onOpenChange={setBulkDeleteOpen}
            onConfirm={handleBulkDelete}
            title={`Supprimer ${selectedIds.size} ${bulkDeleteLabel}`}
            description={`Êtes-vous sûr de vouloir supprimer les ${selectedIds.size} éléments sélectionnés ? Cette action est irréversible.`}
            confirmLabel="Supprimer"
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Supprimer la sélection
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onBulkDelete && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.sortable && 'cursor-pointer select-none',
                    column.className
                  )}
                  onClick={() => column.sortable && toggleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && (
                      <span className="text-muted-foreground">
                        {sortKey === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUpIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <span className="flex flex-col -space-y-1.5 opacity-50">
                            <ChevronUpIcon className="h-2.5 w-2.5" />
                            <ChevronDownIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
              {renderRowActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onBulkDelete ? 1 : 0) + (renderRowActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  Chargement...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onBulkDelete ? 1 : 0) + (renderRowActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const id = getRowId(row)
                const isSelected = selectedIds.has(id)
                return (
                  <TableRow
                    key={id}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {onBulkDelete && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Sélectionner ${id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render
                          ? column.render(row)
                          : (row as any)?.[column.key] ?? '-'}
                      </TableCell>
                    ))}
                    {renderRowActions && (
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderRowActions(row)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={cn(page <= 1 && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={page === p}
                    onClick={() => onPageChange(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={cn(page >= totalPages && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
