import XLSX from 'xlsx-js-style'
import { saveBinaryExport } from './save'

// Palette alignée sur pdf-design.ts (ARGB sans #).
const ACCENT = '1D4ED8'
const BORDER = 'E2E8F0'
const MUTED = '64748B'

const thin = { style: 'thin', color: { rgb: BORDER } }
const CELL_BORDER = { top: thin, bottom: thin, left: thin, right: thin }

export interface ExcelColumn {
  label: string
  /** Largeur en caractères (approximative). */
  width?: number
  num?: boolean
}

export interface ExcelSheetParams {
  schoolName: string
  title: string
  subtitle?: string
  columns: ExcelColumn[]
  rows: (string | number | null | undefined)[][]
  sheetName?: string
  fileName: string
}

/**
 * Classeur Excel stylé : bandeau titre (école + document + date), ligne
 * d'en-tête colorée, zébrage, bordures, largeurs de colonnes, volet figé
 * sous l'en-tête.
 */
export async function exportExcel(p: ExcelSheetParams): Promise<void> {
  const headerRowIndex = p.subtitle ? 4 : 3
  const aoa: any[][] = []
  aoa.push([p.schoolName])
  aoa.push([p.title])
  if (p.subtitle) aoa.push([p.subtitle])
  aoa.push([`Généré le ${new Date().toLocaleDateString('fr-FR')}`])
  aoa.push(p.columns.map((c) => c.label))
  for (const row of p.rows) aoa.push(row.map((v) => (v == null || v === '' ? '—' : v)))

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Styles ligne par ligne.
  const colCount = p.columns.length
  const cellAt = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]
  for (let c = 0; c < colCount; c++) {
    // Bandeau titre.
    const school = cellAt(0, c)
    if (school) school.s = { font: { bold: true, sz: 14, color: { rgb: '0F172A' } } }
    const title = cellAt(1, c)
    if (title) title.s = { font: { bold: true, sz: 11, color: { rgb: ACCENT } } }
    const dateCell = cellAt(headerRowIndex - 1, c)
    if (dateCell) dateCell.s = { font: { sz: 9, color: { rgb: MUTED } } }
    // En-tête de colonnes.
    const head = cellAt(headerRowIndex, c)
    if (head) {
      head.s = {
        font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: ACCENT } },
        alignment: { horizontal: p.columns[c].num ? 'right' : 'left', vertical: 'center' },
        border: CELL_BORDER,
      }
    }
  }
  // Corps : zébrage + bordures.
  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const zebra = (r - headerRowIndex) % 2 === 0
    for (let c = 0; c < colCount; c++) {
      const cell = cellAt(r, c)
      if (!cell) continue
      cell.s = {
        font: { sz: 10 },
        alignment: { horizontal: p.columns[c].num ? 'right' : 'left', vertical: 'top', wrapText: true },
        border: CELL_BORDER,
        ...(zebra ? { fill: { fgColor: { rgb: 'F8FAFC' } } } : {}),
      }
    }
  }

  ws['!cols'] = p.columns.map((c) => ({ wch: c.width ?? Math.max(14, c.label.length + 4) }))
  ws['!rows'] = [{ hpt: 20 }, { hpt: 16 }]
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1 }
  // Fusion du bandeau titre sur toute la largeur.
  ws['!merges'] = Array.from({ length: headerRowIndex }, (_, r) => ({
    s: { r, c: 0 }, e: { r, c: Math.max(colCount - 1, 0) },
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, (p.sheetName ?? p.title).slice(0, 31))
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  await saveBinaryExport(out, p.fileName, 'xlsx')
}
