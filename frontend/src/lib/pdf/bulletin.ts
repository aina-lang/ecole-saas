import { printPdf } from '@/lib/print-pdf'
import { getSchoolSettings } from '@/lib/school-settings'
import { fetchAsDataUrl } from '@/lib/image-utils'
import { getTenantSetting } from '@/lib/tenant-settings'
import { getEntityById, queryEntities } from '@/lib/db/pouchdb-compat'
import { getInitials } from '@/lib/utils'
import {
  esc,
  EXPORT_BASE_CSS,
  renderDataTable,
  renderFooter,
  renderHeader,
  renderIdPhoto,
} from '@/lib/export/pdf-design'
import {
  buildAndSaveWordDoc,
  wordDataTable,
  wordFooter,
  wordHeader,
  wordInfoTable,
  wordPhoto,
  wordSectionTitle,
} from '@/lib/export/word'
import { Paragraph } from 'docx'

// ─────────────────────────────────────────────────────────────────────────────
// Collecte des données (commune PDF / DOCX)
// ─────────────────────────────────────────────────────────────────────────────

interface SubjectLine {
  subject: string
  values: number[]
  coeff: number
  avg: number
}

interface StudentBulletinData {
  name: string
  registrationNumber: string
  photoDataUrl?: string
  initials: string
  rank: number
  total: number
  avg: number | null
  lines: SubjectLine[]
}

interface BulletinData {
  className: string
  schoolName: string
  logoDataUrl?: string
  yearLabel: string
  students: StudentBulletinData[]
}

async function collectBulletinData(classId: string): Promise<BulletinData> {
  const [school, classData, students, grades, subjects, yearRaw] = await Promise.all([
    getSchoolSettings(),
    getEntityById<any>('Class', classId),
    queryEntities<any>('Student', { classId }),
    queryEntities<any>('Grade'),
    queryEntities<any>('Subject'),
    getTenantSetting('academic_year'),
  ])

  let yearLabel = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  try {
    const parsed = yearRaw ? JSON.parse(yearRaw) : null
    if (parsed?.name) yearLabel = parsed.name
  } catch { /* réglage absent/illisible : année par défaut */ }

  const subjectName = new Map<string, string>(subjects.map((s: any) => [s.id, s.name]))
  const gradesByStudent = new Map<string, any[]>()
  for (const g of grades) {
    if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, [])
    gradesByStudent.get(g.studentId)!.push(g)
  }

  const ranked = (students ?? [])
    .map((student: any) => {
      const sg = gradesByStudent.get(student.id) ?? []
      const avg = sg.length
        ? sg.reduce((s: number, g: any) => s + (g.value || 0) * (g.coefficient || 1), 0) /
          sg.reduce((s: number, g: any) => s + (g.coefficient || 1), 0)
        : null
      return { student, sg, avg }
    })
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return b.avg - a.avg
    })

  const result: StudentBulletinData[] = []
  for (let i = 0; i < ranked.length; i++) {
    const { student, sg, avg } = ranked[i]
    const bySubject = new Map<string, { values: number[]; coeff: number }>()
    for (const g of sg) {
      if (!bySubject.has(g.subjectId)) bySubject.set(g.subjectId, { values: [], coeff: g.coefficient || 1 })
      bySubject.get(g.subjectId)!.values.push(g.value || 0)
    }
    const lines: SubjectLine[] = [...bySubject.entries()].map(([sid, d]) => ({
      subject: subjectName.get(sid) ?? sid,
      values: d.values,
      coeff: d.coeff,
      avg: d.values.reduce((a, b) => a + b, 0) / d.values.length,
    })).sort((a, b) => a.subject.localeCompare(b.subject, 'fr'))

    const photoDataUrl = student.photoUrl ? await fetchAsDataUrl(student.photoUrl) : ''
    result.push({
      name: `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
      registrationNumber: student.registrationNumber ?? '—',
      photoDataUrl: photoDataUrl.startsWith('data:') ? photoDataUrl : undefined,
      initials: getInitials(student.firstName, student.lastName),
      rank: i + 1,
      total: ranked.length,
      avg,
      lines,
    })
  }

  return {
    className: classData?.name ?? '',
    schoolName: school.schoolName,
    logoDataUrl: school.logoDataUrl || undefined,
    yearLabel,
    students: result,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendus
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_COLUMNS = [
  { label: 'Matière', width: 34 },
  { label: 'Notes', width: 30 },
  { label: 'Coeff.', num: true, width: 12 },
  { label: 'Moyenne', num: true, width: 14 },
]

function gradeRows(s: StudentBulletinData): string[][] {
  return s.lines.map((l) => [
    l.subject,
    l.values.map((v) => v.toFixed(2).replace(/\.00$/, '')).join(' · '),
    String(l.coeff),
    l.avg.toFixed(2),
  ])
}

async function renderBulletinsPdf(d: BulletinData): Promise<void> {
  const pages = d.students.map((s, i) => {
    const idCard = `
    <div class="id-card" style="margin-bottom:10px">
      ${renderIdPhoto(s.photoDataUrl, s.initials)}
      <div class="id-main">
        <div class="id-name">${esc(s.name)}</div>
        <div class="id-sub">Matricule ${esc(s.registrationNumber)} · Classe ${esc(d.className)}</div>
        <span class="badge">Rang ${s.rank}/${s.total}</span>
      </div>
    </div>`
    const stats = `
    <div class="stat-row">
      <div class="stat"><div class="stat-label">Moyenne générale</div><div class="stat-value">${s.avg !== null ? esc(s.avg.toFixed(2)) + '/20' : '—'}</div></div>
      <div class="stat"><div class="stat-label">Rang</div><div class="stat-value">${s.rank}/${s.total}</div></div>
      <div class="stat"><div class="stat-label">Matières évaluées</div><div class="stat-value">${s.lines.length}</div></div>
    </div>`
    const header = renderHeader({
      schoolName: d.schoolName,
      logoDataUrl: d.logoDataUrl,
      title: 'Bulletin de notes',
      subtitle: `Classe ${d.className} — Année scolaire ${d.yearLabel}`,
    })
    const table = s.lines.length
      ? renderDataTable(GRADE_COLUMNS, gradeRows(s).map((r) => r.map(esc)))
      : '<p style="color:#64748b">Aucune note enregistrée pour cet élève.</p>'
    return `${i > 0 ? '<div class="page-break"></div>' : ''}${header}${idCard}${table}${stats}`
  })

  // Assemblage direct (pas de shell) : chaque élève porte son propre
  // en-tête, le pied de page ferme le document.
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <title>Bulletins — ${esc(d.className)}</title>
  <style>${EXPORT_BASE_CSS}</style>
  </head><body>
  ${pages.join('\n')}
  ${renderFooter(d.schoolName)}
  </body></html>`
  await printPdf(html, `Bulletins - ${d.className}.pdf`)
}

async function renderBulletinsDocx(d: BulletinData): Promise<void> {
  const children: (Paragraph | any)[] = []
  d.students.forEach((s, i) => {
    if (i > 0) children.push(new Paragraph({ children: [], pageBreakBefore: true }))
    children.push(
      ...wordHeader({
        schoolName: d.schoolName,
        logoDataUrl: d.logoDataUrl,
        title: 'Bulletin de notes',
        subtitle: `Classe ${d.className} — Année scolaire ${d.yearLabel}`,
      }),
    )
    const photo = wordPhoto(s.photoDataUrl, 84, 104)
    if (photo) children.push(photo)
    children.push(
      wordInfoTable([
        ['Élève', s.name],
        ['Matricule', s.registrationNumber],
        ['Classe', d.className],
        ['Rang', `${s.rank}/${s.total}`],
      ]),
      wordSectionTitle('Résultats par matière'),
      s.lines.length
        ? wordDataTable(GRADE_COLUMNS, gradeRows(s))
        : new Paragraph({ children: [] }),
      wordSectionTitle('Synthèse'),
      wordInfoTable([
        ['Moyenne générale', s.avg !== null ? `${s.avg.toFixed(2)}/20` : '—'],
        ['Matières évaluées', String(s.lines.length)],
      ]),
    )
  })
  children.push(wordFooter(d.schoolName))
  await buildAndSaveWordDoc(`Bulletins - ${d.className}.docx`, children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBulletinsByClass(
  classId: string,
  format: 'pdf' | 'docx' = 'pdf',
): Promise<void> {
  const data = await collectBulletinData(classId)
  if (data.students.length === 0) throw new Error('Aucun élève dans cette classe.')
  if (format === 'docx') await renderBulletinsDocx(data)
  else await renderBulletinsPdf(data)
}
