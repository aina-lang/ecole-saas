import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ExportFormat } from '@/lib/export/save'

const FORMAT_META: Record<ExportFormat, { label: string; icon: typeof File }> = {
  pdf: { label: 'PDF', icon: File },
  docx: { label: 'Word (.docx)', icon: FileText },
  xlsx: { label: 'Excel (.xlsx)', icon: FileSpreadsheet },
}

// Générique sur les formats proposés : quand l'appelant restreint `formats`
// (ex. bulletins = ['pdf', 'docx']), son `onExport` ne reçoit que ces
// valeurs-là. Sans ça, il devait accepter 'xlsx' qu'il ne sait pas traiter.
interface ExportMenuProps<F extends ExportFormat> {
  /** Formats proposés (ex : bulletins = ['pdf', 'docx'] uniquement). */
  formats?: F[]
  onExport: (format: F) => Promise<void>
  label?: string
  size?: 'default' | 'sm'
  variant?: 'default' | 'outline' | 'ghost'
  disabled?: boolean
}

/** Bouton « Exporter » avec choix du format (PDF / Word / Excel). */
export function ExportMenu<F extends ExportFormat = ExportFormat>({
  formats = ['pdf', 'docx', 'xlsx'] as F[],
  onExport,
  label = 'Exporter',
  size = 'sm',
  variant = 'outline',
  disabled,
}: ExportMenuProps<F>) {
  const [busy, setBusy] = useState(false)

  async function handle(format: F) {
    setBusy(true)
    try {
      await onExport(format)
    } catch (err: any) {
      console.error('[ExportMenu]', err)
      toast.error(err?.message || "Erreur lors de l'export")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled || busy}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? 'Export…' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((f) => {
          const meta = FORMAT_META[f]
          const Icon = meta.icon
          return (
            <DropdownMenuItem key={f} onClick={() => handle(f)}>
              <Icon className="mr-2 h-4 w-4" />
              {meta.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
