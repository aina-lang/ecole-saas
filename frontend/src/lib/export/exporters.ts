import { queryEntities, getEntityById } from '@/lib/db/pouchdb-compat'
import { getSchoolSettings } from '@/lib/school-settings'
import { fetchAsDataUrl } from '@/lib/image-utils'
import { formatDate, getInitials } from '@/lib/utils'
import { printPdf } from '@/lib/print-pdf'
import {
  esc,
  renderDataTable,
  renderDocumentShell,
  renderIdPhoto,
  renderInfoGrid,
  sectionHtml,
} from './pdf-design'
import { exportExcel, type ExcelColumn } from './excel'
import {
  buildAndSaveWordDoc,
  wordDataTable,
  wordFooter,
  wordHeader,
  wordInfoTable,
  wordPhoto,
  wordSectionTitle,
  type WordColumn,
} from './word'
import type { ExportFormat } from './save'

// ─────────────────────────────────────────────────────────────────────────────
// Aides communes
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolCtx {
  schoolName: string
  logoDataUrl?: string
}

async function schoolCtx(): Promise<SchoolCtx> {
  const s = await getSchoolSettings()
  return { schoolName: s.schoolName, logoDataUrl: s.logoDataUrl || undefined }
}

async function resolvePhoto(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined
  const resolved = await fetchAsDataUrl(url)
  return resolved && resolved.startsWith('data:') ? resolved : undefined
}

const GENDER_LABEL: Record<string, string> = { M: 'Masculin', F: 'Féminin' }

function phonesToText(phones: unknown): string {
  if (!Array.isArray(phones)) return ''
  return phones
    .map((p: any) => (typeof p === 'string' ? p : p?.value))
    .filter(Boolean)
    .join(' · ')
}

/**
 * Export tabulaire générique : un même jeu (titre, colonnes, lignes) rendu
 * en PDF, Word ou Excel selon le format demandé.
 */
async function exportTable(p: {
  format: ExportFormat
  fileBase: string
  title: string
  subtitle?: string
  columns: Array<{ label: string; num?: boolean; width?: number }>
  rows: string[][]
  /** Bloc HTML additionnel avant le tableau (PDF uniquement). */
  pdfPrelude?: string
}): Promise<void> {
  const school = await schoolCtx()
  if (p.format === 'xlsx') {
    const cols: ExcelColumn[] = p.columns.map((c) => ({ label: c.label, num: c.num, width: c.width }))
    await exportExcel({
      schoolName: school.schoolName,
      title: p.title,
      subtitle: p.subtitle,
      columns: cols,
      rows: p.rows,
      fileName: `${p.fileBase}.xlsx`,
    })
    return
  }
  if (p.format === 'docx') {
    const cols: WordColumn[] = p.columns.map((c) => ({ label: c.label, num: c.num }))
    await buildAndSaveWordDoc(`${p.fileBase}.docx`, [
      ...wordHeader({ ...school, title: p.title, subtitle: p.subtitle }),
      wordDataTable(cols, p.rows),
      wordFooter(school.schoolName),
    ])
    return
  }
  const html = renderDocumentShell({
    ...school,
    title: p.title,
    subtitle: p.subtitle,
    bodyHtml: `${p.pdfPrelude ?? ''}${renderDataTable(p.columns, p.rows.map((r) => r.map(esc)))}`,
  })
  await printPdf(html, `${p.fileBase}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Liste des classes
// ─────────────────────────────────────────────────────────────────────────────

export async function exportClassList(format: ExportFormat): Promise<void> {
  const [classes, levels, students] = await Promise.all([
    queryEntities<any>('Class'),
    queryEntities<any>('Level'),
    queryEntities<any>('Student'),
  ])
  const levelName = new Map<string, string>(levels.map((l: any) => [l.id, l.name]))
  const countByClass = new Map<string, number>()
  for (const s of students) {
    if (s.classId) countByClass.set(s.classId, (countByClass.get(s.classId) ?? 0) + 1)
  }
  const sorted = [...classes].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
  const rows = sorted.map((c) => [
    c.name ?? '',
    levelName.get(c.levelId) ?? c.level ?? '',
    c.room ?? '',
    String(countByClass.get(c.id) ?? 0),
    c.capacity ? String(c.capacity) : '',
  ])
  const total = students.filter((s: any) => s.classId).length
  await exportTable({
    format,
    fileBase: 'Liste des classes',
    title: 'Liste des classes',
    subtitle: `${sorted.length} classe${sorted.length > 1 ? 's' : ''} — ${total} élève${total > 1 ? 's' : ''} affecté${total > 1 ? 's' : ''}`,
    columns: [
      { label: 'Classe', width: 22 },
      { label: 'Niveau', width: 16 },
      { label: 'Salle', width: 12 },
      { label: 'Effectif', num: true, width: 10 },
      { label: 'Capacité', num: true, width: 10 },
    ],
    rows,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Élèves d'une classe
// ─────────────────────────────────────────────────────────────────────────────

export async function exportClassStudents(classId: string, format: ExportFormat): Promise<void> {
  const [cls, students] = await Promise.all([
    getEntityById<any>('Class', classId),
    queryEntities<any>('Student', { classId }),
  ])
  const className = cls?.name ?? 'Classe'
  const sorted = [...students].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
  )
  const rows = sorted.map((s, i) => [
    String(i + 1),
    s.registrationNumber ?? '',
    (s.lastName ?? '').toUpperCase(),
    s.firstName ?? '',
    GENDER_LABEL[s.gender] ?? s.gender ?? '',
    s.birthDate ? formatDate(s.birthDate) : '',
    s.phoneNumber ?? s.phone ?? '',
  ])
  await exportTable({
    format,
    fileBase: `Élèves - ${className}`,
    title: `Liste des élèves — ${className}`,
    subtitle: `Effectif : ${sorted.length} élève${sorted.length > 1 ? 's' : ''}`,
    columns: [
      { label: 'N°', num: true, width: 5 },
      { label: 'Matricule', width: 18 },
      { label: 'Nom', width: 20 },
      { label: 'Prénom(s)', width: 20 },
      { label: 'Genre', width: 10 },
      { label: 'Né(e) le', width: 13 },
      { label: 'Téléphone', width: 15 },
    ],
    rows,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fiche élève
// ─────────────────────────────────────────────────────────────────────────────

interface StudentProfileData {
  student: any
  className: string
  photoDataUrl?: string
  parents: Array<{ name: string; relation: string; isPrimary: boolean; phones: string; email: string }>
}

async function collectStudentProfile(studentId: string): Promise<StudentProfileData> {
  const student = await getEntityById<any>('Student', studentId)
  if (!student) throw new Error('Élève introuvable')
  const [classes, users] = await Promise.all([
    queryEntities<any>('Class'),
    queryEntities<any>('User'),
  ])
  const userMap = new Map<string, any>(users.map((u: any) => [u.id, u]))
  const className =
    student.class?.name ?? classes.find((c: any) => c.id === student.classId)?.name ?? student.classId ?? ''
  const parents = (student.parents ?? []).map((link: any) => {
    const pu = link.parent ?? userMap.get(link.parentId) ?? {}
    return {
      name: `${pu.firstName ?? ''} ${pu.lastName ?? ''}`.trim() || link.parentId || '',
      relation: link.relation === 'TUTEUR' ? 'Tuteur' : 'Parent',
      isPrimary: !!link.isPrimary,
      phones: phonesToText(pu.phones) || pu.phone || '',
      email: pu.email ?? '',
    }
  })
  const photoDataUrl = await resolvePhoto(student.photoUrl)
  return { student, className, photoDataUrl, parents }
}

const STUDENT_STATUS_LABEL: Record<string, string> = {
  active: 'Actif', inactive: 'Inactif', graduated: 'Diplômé', suspended: 'Suspendu',
}

export async function exportStudentProfile(studentId: string, format: ExportFormat): Promise<void> {
  const school = await schoolCtx()
  const d = await collectStudentProfile(studentId)
  const s = d.student
  const fullName = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
  const fileBase = `Fiche élève - ${fullName || s.registrationNumber || studentId}`

  const identity: Array<[string, unknown]> = [
    ['Matricule', s.registrationNumber],
    ['Statut', STUDENT_STATUS_LABEL[s.status] ?? s.status],
    ['Date de naissance', s.birthDate ? formatDate(s.birthDate) : ''],
    ['Lieu de naissance', s.birthPlace],
    ['Genre', GENDER_LABEL[s.gender] ?? s.gender],
    ['Nationalité', s.nationality],
  ]
  const contact: Array<[string, unknown]> = [
    ['Adresse', s.address],
    ['Téléphone', s.phoneNumber ?? s.phone],
    ['Email', s.email],
  ]
  const health: Array<[string, unknown]> = [
    ['Groupe sanguin', s.bloodType],
    ['Allergies', s.allergies],
    ['Contact d’urgence', s.emergencyContact],
    ['Tél. urgence', s.emergencyPhone],
    ['Notes médicales', s.medicalNotes],
  ]
  const schooling: Array<[string, unknown]> = [
    ['Classe', d.className],
    ['Inscrit le', s.enrollmentDate ? formatDate(s.enrollmentDate) : ''],
  ]
  const parentCols = [
    { label: 'Nom', width: 30 },
    { label: 'Lien', width: 14 },
    { label: 'Téléphone', width: 24 },
    { label: 'Email', width: 26 },
  ]
  const parentRows = d.parents.map((p) => [
    p.isPrimary ? `${p.name} (principal)` : p.name,
    p.relation,
    p.phones,
    p.email,
  ])

  if (format === 'xlsx') {
    const rows: (string | number)[][] = [
      ...identity, ...contact, ...health, ...schooling,
    ].map(([k, v]) => [String(k), String(v === '' || v == null ? '—' : v)])
    for (const p of d.parents) {
      rows.push([`Parent — ${p.relation}${p.isPrimary ? ' (principal)' : ''}`, `${p.name} · ${p.phones || '—'} · ${p.email || '—'}`])
    }
    await exportExcel({
      schoolName: school.schoolName,
      title: `Fiche élève — ${fullName}`,
      subtitle: `Matricule ${s.registrationNumber ?? '—'} · Classe ${d.className || '—'}`,
      columns: [{ label: 'Champ', width: 26 }, { label: 'Valeur', width: 60 }],
      rows,
      fileName: `${fileBase}.xlsx`,
    })
    return
  }

  if (format === 'docx') {
    const photo = wordPhoto(d.photoDataUrl)
    const children: any[] = [
      ...wordHeader({ ...school, title: 'Fiche élève', subtitle: `${fullName} — ${d.className || 'Sans classe'}` }),
    ]
    if (photo) children.push(photo)
    children.push(
      wordSectionTitle('État civil'), wordInfoTable(identity),
      wordSectionTitle('Contact'), wordInfoTable(contact),
      wordSectionTitle('Urgence & santé'), wordInfoTable(health),
      wordSectionTitle('Scolarité'), wordInfoTable(schooling),
    )
    if (parentRows.length) {
      children.push(wordSectionTitle('Parents / Tuteurs'), wordDataTable(parentCols, parentRows))
    }
    children.push(wordFooter(school.schoolName))
    await buildAndSaveWordDoc(`${fileBase}.docx`, children)
    return
  }

  const idCard = `
  <div class="id-card">
    ${renderIdPhoto(d.photoDataUrl, getInitials(s.firstName, s.lastName))}
    <div class="id-main">
      <div class="id-name">${esc(fullName)}</div>
      <div class="id-sub">Matricule ${esc(s.registrationNumber ?? '—')} · Classe ${esc(d.className || '—')}</div>
      <span class="badge">${esc(STUDENT_STATUS_LABEL[s.status] ?? s.status ?? '')}</span>
    </div>
  </div>`
  const body =
    idCard +
    sectionHtml('État civil', renderInfoGrid(identity)) +
    sectionHtml('Contact', renderInfoGrid(contact)) +
    sectionHtml('Urgence & santé', renderInfoGrid(health)) +
    sectionHtml('Scolarité', renderInfoGrid(schooling)) +
    (parentRows.length
      ? sectionHtml('Parents / Tuteurs', renderDataTable(parentCols, parentRows.map((r) => r.map(esc))))
      : '')
  const html = renderDocumentShell({ ...school, title: 'Fiche élève', subtitle: fullName, bodyHtml: body })
  await printPdf(html, `${fileBase}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fiche parent
// ─────────────────────────────────────────────────────────────────────────────

export async function exportParentProfile(parentId: string, format: ExportFormat): Promise<void> {
  const school = await schoolCtx()
  const [parent, students, classes] = await Promise.all([
    getEntityById<any>('User', parentId),
    queryEntities<any>('Student'),
    queryEntities<any>('Class'),
  ])
  if (!parent) throw new Error('Parent introuvable')
  const classMap = new Map<string, string>(classes.map((c: any) => [c.id, c.name]))
  const children = students.filter((st: any) =>
    (st.parents ?? []).some((l: any) => l.parentId === parentId || l.parent?.id === parentId),
  )
  const fullName = `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim()
  const fileBase = `Fiche parent - ${fullName || parentId}`
  const photoDataUrl = await resolvePhoto(parent.photoUrl)

  const identity: Array<[string, unknown]> = [
    ['Nom', (parent.lastName ?? '').toUpperCase()],
    ['Prénom(s)', parent.firstName],
    ['Email', parent.email],
    ['Téléphone(s)', phonesToText(parent.phones) || parent.phone],
  ]
  const childCols = [
    { label: 'Élève', width: 30 },
    { label: 'Matricule', width: 20 },
    { label: 'Classe', width: 16 },
    { label: 'Lien', width: 16 },
  ]
  const childRows = children.map((st: any) => {
    const link = (st.parents ?? []).find((l: any) => l.parentId === parentId || l.parent?.id === parentId)
    const rel = link?.relation === 'TUTEUR' ? 'Tuteur' : 'Parent'
    return [
      `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim(),
      st.registrationNumber ?? '',
      classMap.get(st.classId) ?? '',
      link?.isPrimary ? `${rel} (principal)` : rel,
    ]
  })

  if (format === 'xlsx') {
    const rows = identity.map(([k, v]) => [String(k), String(v === '' || v == null ? '—' : v)])
    for (const r of childRows) rows.push(['Élève lié', r.join(' · ')])
    await exportExcel({
      schoolName: school.schoolName,
      title: `Fiche parent — ${fullName}`,
      subtitle: `${childRows.length} élève${childRows.length > 1 ? 's' : ''} lié${childRows.length > 1 ? 's' : ''}`,
      columns: [{ label: 'Champ', width: 24 }, { label: 'Valeur', width: 62 }],
      rows,
      fileName: `${fileBase}.xlsx`,
    })
    return
  }

  if (format === 'docx') {
    const photo = wordPhoto(photoDataUrl)
    const children2: any[] = [
      ...wordHeader({ ...school, title: 'Fiche parent', subtitle: fullName }),
    ]
    if (photo) children2.push(photo)
    children2.push(wordSectionTitle('Identité & contact'), wordInfoTable(identity))
    if (childRows.length) children2.push(wordSectionTitle('Élèves liés'), wordDataTable(childCols, childRows))
    children2.push(wordFooter(school.schoolName))
    await buildAndSaveWordDoc(`${fileBase}.docx`, children2)
    return
  }

  const idCard = `
  <div class="id-card">
    ${renderIdPhoto(photoDataUrl, getInitials(parent.firstName, parent.lastName))}
    <div class="id-main">
      <div class="id-name">${esc(fullName)}</div>
      <div class="id-sub">${esc(parent.email ?? '')}</div>
      <span class="badge">${childRows.length} élève${childRows.length > 1 ? 's' : ''} lié${childRows.length > 1 ? 's' : ''}</span>
    </div>
  </div>`
  const body =
    idCard +
    sectionHtml('Identité & contact', renderInfoGrid(identity)) +
    (childRows.length
      ? sectionHtml('Élèves liés', renderDataTable(childCols, childRows.map((r) => r.map(esc))))
      : '')
  const html = renderDocumentShell({ ...school, title: 'Fiche parent', subtitle: fullName, bodyHtml: body })
  await printPdf(html, `${fileBase}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Liste des enseignants
// ─────────────────────────────────────────────────────────────────────────────

export async function exportTeacherList(format: ExportFormat): Promise<void> {
  const teachers = await queryEntities<any>('Teacher')
  const sorted = [...teachers].sort((a, b) =>
    `${a.user_lastName ?? ''} ${a.user_firstName ?? ''}`.localeCompare(
      `${b.user_lastName ?? ''} ${b.user_firstName ?? ''}`, 'fr'),
  )
  const flatNames = (t: any, prefix: string): string => {
    const names: string[] = []
    for (let i = 0; i < 20; i++) {
      const n = t[`${prefix}_${i}_name`]
      if (n) names.push(n)
    }
    return names.join(', ')
  }
  const teacherPhones = (t: any): string => {
    // Deux formes selon l'origine du doc : tableau `phones` (créé en local)
    // ou champs aplatis user_phone_N (propagé depuis le serveur).
    const local = phonesToText(t.phones)
    if (local) return local
    const flat: string[] = []
    for (let i = 0; i < 3; i++) if (t[`user_phone_${i}`]) flat.push(t[`user_phone_${i}`])
    return flat.join(' · ')
  }
  const rows = sorted.map((t) => [
    (t.user_lastName ?? t.lastName ?? '').toUpperCase(),
    t.user_firstName ?? t.firstName ?? '',
    t.specialty ?? '',
    t.user_email ?? t.email ?? '',
    teacherPhones(t),
    flatNames(t, 'subject'),
    flatNames(t, 'class'),
  ])
  await exportTable({
    format,
    fileBase: 'Liste des enseignants',
    title: 'Liste des enseignants',
    subtitle: `${sorted.length} enseignant${sorted.length > 1 ? 's' : ''}`,
    columns: [
      { label: 'Nom', width: 18 },
      { label: 'Prénom(s)', width: 16 },
      { label: 'Spécialité', width: 16 },
      { label: 'Email', width: 24 },
      { label: 'Téléphone', width: 16 },
      { label: 'Matières', width: 22 },
      { label: 'Classes', width: 18 },
    ],
    rows,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Liste des élèves (tout l'établissement)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste complète des élèves, éventuellement restreinte à une classe ou à un
 * statut. Les filtres sont ceux de l'écran : on exporte ce que l'utilisateur a
 * sous les yeux, pas systématiquement toute la base.
 *
 * La pagination de l'écran, elle, n'est PAS reprise : exporter la seule page
 * affichée n'aurait aucun intérêt.
 */
export async function exportStudentList(
  format: ExportFormat,
  filters: { classId?: string; status?: string; search?: string } = {},
): Promise<void> {
  const [students, classes] = await Promise.all([
    queryEntities<any>('Student'),
    queryEntities<any>('Class'),
  ])
  const classNameById = new Map(classes.map((c: any) => [c.id, c.name]))

  const needle = (filters.search ?? '').trim().toLowerCase()
  const filtered = students.filter((s: any) => {
    if (filters.classId && s.classId !== filters.classId) return false
    if (filters.status && (s.status ?? 'active') !== filters.status) return false
    if (!needle) return true
    return [s.firstName, s.lastName, s.registrationNumber]
      .some((v) => String(v ?? '').toLowerCase().includes(needle))
  })

  const sorted = [...filtered].sort((a, b) =>
    `${a.lastName ?? ''} ${a.firstName ?? ''}`.localeCompare(
      `${b.lastName ?? ''} ${b.firstName ?? ''}`, 'fr'),
  )

  const rows = sorted.map((s: any, i: number) => [
    String(i + 1),
    s.registrationNumber ?? '',
    (s.lastName ?? '').toUpperCase(),
    s.firstName ?? '',
    GENDER_LABEL[s.gender] ?? s.gender ?? '',
    s.birthDate ? formatDate(s.birthDate) : '',
    classNameById.get(s.classId) ?? '',
    s.phoneNumber ?? s.phone ?? '',
    STUDENT_STATUS_LABEL[s.status] ?? s.status ?? 'Actif',
  ])

  const scope = filters.classId ? classNameById.get(filters.classId) : undefined
  await exportTable({
    format,
    fileBase: scope ? `Élèves - ${scope}` : 'Liste des élèves',
    title: 'Liste des élèves',
    subtitle: `${sorted.length} élève${sorted.length > 1 ? 's' : ''}${scope ? ` — ${scope}` : ''}`,
    columns: [
      { label: 'N°', num: true, width: 5 },
      { label: 'Matricule', width: 16 },
      { label: 'Nom', width: 20 },
      { label: 'Prénom(s)', width: 20 },
      { label: 'Genre', width: 10 },
      { label: 'Né(e) le', width: 13 },
      { label: 'Classe', width: 16 },
      { label: 'Téléphone', width: 16 },
      { label: 'Statut', width: 12 },
    ],
    rows,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Liste des parents / tuteurs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste des parents et tuteurs, avec les enfants rattachés. Le lien se lit
 * côté élève (`student.parents[].parentId`), comme sur ParentsPage.
 */
export async function exportParentList(
  format: ExportFormat,
  filters: { search?: string } = {},
): Promise<void> {
  const [users, students] = await Promise.all([
    queryEntities<any>('User'),
    queryEntities<any>('Student'),
  ])
  const parents = users.filter((u: any) => u.role === 'PARENT')

  const childrenByParent = new Map<string, string[]>()
  for (const s of students as any[]) {
    for (const link of s.parents ?? []) {
      if (!link?.parentId) continue
      const label = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
      const list = childrenByParent.get(link.parentId)
      if (list) list.push(label)
      else childrenByParent.set(link.parentId, [label])
    }
  }

  const needle = (filters.search ?? '').trim().toLowerCase()
  const filtered = parents.filter((p: any) => {
    if (!needle) return true
    return [p.firstName, p.lastName, p.email]
      .some((v) => String(v ?? '').toLowerCase().includes(needle))
  })

  const sorted = [...filtered].sort((a: any, b: any) =>
    `${a.lastName ?? ''} ${a.firstName ?? ''}`.localeCompare(
      `${b.lastName ?? ''} ${b.firstName ?? ''}`, 'fr'),
  )

  const parentPhones = (p: any): string => {
    // `phone` (champ simple) et `phones` (tableau) coexistent selon l'origine
    // du document — on dédoublonne, comme l'affichage de ParentsPage.
    const all = [p.phone, ...(Array.isArray(p.phones) ? p.phones.map((ph: any) => (typeof ph === 'string' ? ph : ph?.value)) : [])]
    return [...new Set(all.filter(Boolean))].join(' · ')
  }

  const rows = sorted.map((p: any, i: number) => {
    const children = childrenByParent.get(p.id) ?? []
    return [
      String(i + 1),
      (p.lastName ?? '').toUpperCase(),
      p.firstName ?? '',
      p.email ?? '',
      parentPhones(p),
      String(children.length),
      children.join(', '),
    ]
  })

  await exportTable({
    format,
    fileBase: 'Liste des parents',
    title: 'Liste des parents et tuteurs',
    subtitle: `${sorted.length} parent${sorted.length > 1 ? 's' : ''}`,
    columns: [
      { label: 'N°', num: true, width: 5 },
      { label: 'Nom', width: 18 },
      { label: 'Prénom(s)', width: 18 },
      { label: 'Email', width: 26 },
      { label: 'Téléphone(s)', width: 20 },
      { label: 'Enfants', num: true, width: 9 },
      { label: 'Nom des enfants', width: 34 },
    ],
    rows,
  })
}
