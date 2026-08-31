import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { saveBinaryExport } from './save'

// Palette alignée sur pdf-design.ts.
const ACCENT = '1D4ED8'
const INK = '0F172A'
const MUTED = '64748B'
const BORDER = 'E2E8F0'
const ZEBRA = 'F8FAFC'

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }
const THIN = { style: BorderStyle.SINGLE, size: 4, color: BORDER } as const
const THIN_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN }

function dataUrlToImage(dataUrl: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
  const m = /^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  const type = m[1] === 'jpeg' ? 'jpg' : (m[1] as 'png' | 'jpg' | 'gif' | 'bmp')
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { data: bytes, type }
}

function text(content: string, opts: { bold?: boolean; size?: number; color?: string; caps?: boolean } = {}): TextRun {
  return new TextRun({
    text: content,
    bold: opts.bold,
    size: opts.size ?? 21, // demi-points (21 = 10,5 pt)
    color: opts.color ?? INK,
    allCaps: opts.caps,
    font: 'Calibri',
  })
}

/** Image d'identité ou de logo depuis une data URL ; null si absente/invalide. */
export function imageRunFromDataUrl(dataUrl: string | undefined, width: number, height: number): ImageRun | null {
  if (!dataUrl) return null
  const img = dataUrlToImage(dataUrl)
  if (!img) return null
  return new ImageRun({ data: img.data, type: img.type, transformation: { width, height } })
}

/** Bandeau d'en-tête : logo + école + titre + sous-titre + date. */
export function wordHeader(p: {
  schoolName: string
  logoDataUrl?: string
  title: string
  subtitle?: string
}): (Paragraph | Table)[] {
  const logo = imageRunFromDataUrl(p.logoDataUrl, 56, 56)
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const textCell = new TableCell({
    borders: NO_BORDERS,
    children: [
      new Paragraph({ children: [text(p.schoolName, { bold: true, size: 30 })] }),
      new Paragraph({ children: [text(p.title, { bold: true, size: 22, color: ACCENT, caps: true })] }),
      ...(p.subtitle ? [new Paragraph({ children: [text(p.subtitle, { size: 20, color: MUTED })] })] : []),
    ],
  })
  const dateCell = new TableCell({
    borders: NO_BORDERS,
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(date, { size: 18, color: MUTED })] })],
  })
  const cells = logo
    ? [new TableCell({ borders: NO_BORDERS, width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [logo] })] }), textCell, dateCell]
    : [textCell, dateCell]

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER } as any,
      rows: [new TableRow({ children: cells })],
    }),
    // Filet accentué sous l'en-tête.
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: ACCENT } },
      children: [],
      spacing: { after: 220 },
    }),
  ]
}

/** Photo d'identité en paragraphe ; null si pas d'image exploitable. */
export function wordPhoto(dataUrl: string | undefined, width = 96, height = 118): Paragraph | null {
  const img = imageRunFromDataUrl(dataUrl, width, height)
  return img ? new Paragraph({ spacing: { after: 140 }, children: [img] }) : null
}

export function wordSectionTitle(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER } },
    children: [text(label.toUpperCase(), { bold: true, size: 18, color: ACCENT })],
  })
}

/** Grille clé/valeur (2 paires par ligne) pour les fiches. */
export function wordInfoTable(pairs: Array<[string, unknown]>): Table {
  const rows: TableRow[] = []
  for (let i = 0; i < pairs.length; i += 2) {
    const slice = [pairs[i], pairs[i + 1]]
    const cells: TableCell[] = []
    for (const pair of slice) {
      const [k, v] = pair ?? ['', '']
      cells.push(
        new TableCell({
          borders: { ...NO_BORDERS, bottom: THIN },
          width: { size: 16, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [text(k ? String(k) : '', { size: 19, color: MUTED })] })],
        }),
        new TableCell({
          borders: { ...NO_BORDERS, bottom: THIN },
          width: { size: 34, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [text(pair ? String(v === '' || v == null ? '—' : v) : '', { bold: true, size: 20 })] })],
        }),
      )
    }
    rows.push(new TableRow({ children: cells }))
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
}

export interface WordColumn {
  label: string
  num?: boolean
  /** Largeur relative (pourcentage). */
  width?: number
}

/** Tableau de données : en-tête bleu, zébrage, bordures fines. */
export function wordDataTable(columns: WordColumn[], rows: string[][]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: columns.map(
      (c) =>
        new TableCell({
          borders: THIN_BORDERS,
          shading: { type: ShadingType.CLEAR, fill: ACCENT },
          width: c.width ? { size: c.width, type: WidthType.PERCENTAGE } : undefined,
          children: [
            new Paragraph({
              alignment: c.num ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [text(c.label.toUpperCase(), { bold: true, size: 17, color: 'FFFFFF' })],
            }),
          ],
        }),
    ),
  })
  const body = rows.map(
    (r, ri) =>
      new TableRow({
        children: r.map(
          (cell, ci) =>
            new TableCell({
              borders: THIN_BORDERS,
              shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: ZEBRA } : undefined,
              children: [
                new Paragraph({
                  alignment: columns[ci]?.num ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [text(cell === '' || cell == null ? '—' : cell, { size: 19 })],
                }),
              ],
            }),
        ),
      }),
  )
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] })
}

export function wordFooter(schoolName: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320 },
    border: { top: THIN },
    children: [
      text(`${schoolName} — document généré le ${new Date().toLocaleDateString('fr-FR')}`, {
        size: 16,
        color: MUTED,
      }),
    ],
  })
}

/** Assemble le document et l'enregistre (dialogue + ouverture). */
export async function buildAndSaveWordDoc(fileName: string, children: (Paragraph | Table)[]): Promise<void> {
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 680, right: 680 } }, // twips (~12 mm)
        },
        children,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  await saveBinaryExport(await blob.arrayBuffer(), fileName, 'docx')
}
