/**
 * Système de design partagé des exports PDF (imprimés via printToPDF).
 *
 * Tous les documents (listes, fiches, bulletins) partagent : bandeau
 * d'en-tête avec logo et nom de l'école, titre + sous-titre, méta (date,
 * année scolaire), tableaux zébrés, blocs d'informations, photo d'identité
 * encadrée, pied de page. Une seule palette, print-friendly.
 *
 * IMPORTANT : toute valeur venant des données (noms, adresses...) passe par
 * esc() — ces chaînes sont injectées dans du HTML rendu par une BrowserWindow.
 */

export const ACCENT = '#1d4ed8' // bleu profond, lisible en n&b
const ACCENT_SOFT = '#eff6ff'
const INK = '#0f172a'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const EXPORT_BASE_CSS = `
  @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px; color: ${INK}; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-header {
    display: flex; align-items: center; gap: 14px;
    padding-bottom: 12px; border-bottom: 3px solid ${ACCENT}; margin-bottom: 16px;
  }
  .doc-header .logo {
    width: 58px; height: 58px; border-radius: 12px; object-fit: contain;
    border: 1px solid ${BORDER}; background: #fff; flex: 0 0 auto;
  }
  .doc-header .logo-placeholder {
    width: 58px; height: 58px; border-radius: 12px; flex: 0 0 auto;
    background: ${ACCENT_SOFT}; color: ${ACCENT}; font-weight: 700; font-size: 22px;
    display: flex; align-items: center; justify-content: center;
  }
  .doc-header .head-text { flex: 1; min-width: 0; }
  .doc-header .school { font-size: 15px; font-weight: 700; letter-spacing: .2px; }
  .doc-header .title { font-size: 12.5px; font-weight: 600; color: ${ACCENT}; margin-top: 2px; text-transform: uppercase; letter-spacing: .6px; }
  .doc-header .subtitle { font-size: 10.5px; color: ${MUTED}; margin-top: 2px; }
  .doc-header .head-meta { text-align: right; font-size: 10px; color: ${MUTED}; white-space: nowrap; }

  .section { margin-top: 14px; }
  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: ${ACCENT}; border-bottom: 1px solid ${BORDER};
    padding-bottom: 3px; margin-bottom: 8px;
  }

  table.data { width: 100%; border-collapse: collapse; }
  table.data th {
    background: ${ACCENT}; color: #fff; text-align: left;
    font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
    padding: 6px 8px;
  }
  table.data td { padding: 5.5px 8px; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
  table.data tr:nth-child(even) td { background: #f8fafc; }
  table.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 22px; }
  .info-item { display: flex; gap: 6px; padding: 3px 0; border-bottom: 1px dotted ${BORDER}; }
  .info-item .k { color: ${MUTED}; min-width: 118px; flex: 0 0 auto; }
  .info-item .v { font-weight: 600; }

  .id-card { display: flex; gap: 16px; align-items: flex-start; }
  .id-photo {
    width: 86px; height: 106px; border-radius: 8px; object-fit: cover;
    border: 2px solid ${ACCENT}; background: #fff; flex: 0 0 auto;
  }
  .id-photo-placeholder {
    width: 86px; height: 106px; border-radius: 8px; flex: 0 0 auto;
    border: 2px solid ${BORDER}; background: ${ACCENT_SOFT}; color: ${ACCENT};
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 700;
  }
  .id-main { flex: 1; min-width: 0; }
  .id-name { font-size: 16px; font-weight: 700; }
  .id-sub { color: ${MUTED}; font-size: 11px; margin-top: 2px; }
  .badge {
    display: inline-block; padding: 1.5px 8px; border-radius: 999px;
    background: ${ACCENT_SOFT}; color: ${ACCENT}; font-size: 9.5px; font-weight: 600;
    margin-top: 6px;
  }

  .doc-footer {
    margin-top: 20px; padding-top: 8px; border-top: 1px solid ${BORDER};
    display: flex; justify-content: space-between;
    font-size: 9px; color: ${MUTED};
  }
  .page-break { page-break-after: always; }
  .stat-row { display: flex; gap: 10px; margin-top: 10px; }
  .stat {
    flex: 1; border: 1px solid ${BORDER}; border-radius: 8px; padding: 8px 10px;
    background: #f8fafc;
  }
  .stat .stat-label { font-size: 9px; color: ${MUTED}; text-transform: uppercase; letter-spacing: .5px; }
  .stat .stat-value { font-size: 14px; font-weight: 700; margin-top: 2px; }
`

export interface DocShellParams {
  schoolName: string
  logoDataUrl?: string
  title: string
  subtitle?: string
  bodyHtml: string
  /** Texte additionnel de l'en-tête droit (sous la date). */
  meta?: string
  extraCss?: string
}

export function renderHeader(p: Pick<DocShellParams, 'schoolName' | 'logoDataUrl' | 'title' | 'subtitle' | 'meta'>): string {
  const logo = p.logoDataUrl
    ? `<img class="logo" src="${p.logoDataUrl}" alt="" />`
    : `<div class="logo-placeholder">${esc(p.schoolName.trim().charAt(0).toUpperCase() || 'É')}</div>`
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `
  <div class="doc-header">
    ${logo}
    <div class="head-text">
      <div class="school">${esc(p.schoolName)}</div>
      <div class="title">${esc(p.title)}</div>
      ${p.subtitle ? `<div class="subtitle">${esc(p.subtitle)}</div>` : ''}
    </div>
    <div class="head-meta">${esc(date)}${p.meta ? `<br/>${esc(p.meta)}` : ''}</div>
  </div>`
}

export function renderFooter(schoolName: string): string {
  return `
  <div class="doc-footer">
    <span>${esc(schoolName)}</span>
    <span>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>`
}

export function renderDocumentShell(p: DocShellParams): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <title>${esc(p.title)}</title>
  <style>${EXPORT_BASE_CSS}${p.extraCss ?? ''}</style>
  </head><body>
  ${renderHeader(p)}
  ${p.bodyHtml}
  ${renderFooter(p.schoolName)}
  </body></html>`
}

/** Photo d'identité (ou placeholder à initiales). */
export function renderIdPhoto(photoDataUrl: string | undefined, initials: string): string {
  if (photoDataUrl) return `<img class="id-photo" src="${photoDataUrl}" alt="" />`
  return `<div class="id-photo-placeholder">${esc(initials || '?')}</div>`
}

export interface TableColumn {
  label: string
  /** Alignement numérique à droite. */
  num?: boolean
}

export function renderDataTable(columns: TableColumn[], rows: string[][]): string {
  const head = columns.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${r.map((cell, i) => `<td${columns[i]?.num ? ' class="num"' : ''}>${cell}</td>`).join('')}</tr>`)
    .join('\n')
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** Grille clé/valeur pour les fiches. Les valeurs sont échappées ici. */
export function renderInfoGrid(pairs: Array<[string, unknown]>): string {
  const items = pairs
    .map(([k, v]) => `<div class="info-item"><span class="k">${esc(k)}</span><span class="v">${esc(v === '' || v == null ? '—' : v)}</span></div>`)
    .join('')
  return `<div class="info-grid">${items}</div>`
}

export function sectionHtml(title: string, innerHtml: string): string {
  return `<div class="section"><div class="section-title">${esc(title)}</div>${innerHtml}</div>`
}
