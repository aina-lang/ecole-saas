import { printPdf } from '@/lib/print-pdf'
import { getSchoolSettings } from '@/lib/school-settings'
import { DAYS } from '@/lib/days'

interface TimetableSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  subjectLabel: string
  subjectId?: string | null
  teacherDisplay?: string | null
  room?: string | null
  isRecreation?: boolean | string
}

interface TimetableParams {
  className: string
  slots: TimetableSlot[]
}

// Même palette et même fonction de hachage que l'écran Emploi du temps : une
// matière garde sa couleur entre l'app et le PDF.
const PALETTE = [
  ['#0ea5e9', '#f0f9ff', '#082f49'], ['#8b5cf6', '#f5f3ff', '#2e1065'], ['#10b981', '#ecfdf5', '#022c22'],
  ['#f43f5e', '#fff1f2', '#4c0519'], ['#f97316', '#fff7ed', '#431407'], ['#14b8a6', '#f0fdfa', '#042f2e'],
  ['#d946ef', '#fdf4ff', '#4a044e'], ['#6366f1', '#eef2ff', '#1e1b4b'], ['#65a30d', '#f7fee7', '#1a2e05'],
  ['#06b6d4', '#ecfeff', '#083344'],
]
function subjectIndex(id?: string | null): number {
  if (!id) return 0
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % PALETTE.length
}
const toMin = (t: string) => { const [h, m] = String(t ?? '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

export async function generateTimetable(params: TimetableParams): Promise<void> {
  const school = await getSchoolSettings()
  const className = params.className || 'classe'
  const isBreak = (s: TimetableSlot) => s.isRecreation === true || s.isRecreation === 'true' || (!s.subjectId && /r[ée]cr[ée]/i.test(s.room ?? ''))
  const slots = params.slots.filter((s) => s.startTime && s.endTime)

  // Plage horaire : de l'heure du premier cours (min 07:00) à la fin du dernier (max 18:00).
  const mins = slots.map((s) => toMin(s.startTime)); const maxs = slots.map((s) => toMin(s.endTime))
  const first = Math.min(7 * 60, ...(mins.length ? mins : [7 * 60]))
  const last = Math.max(17 * 60, ...(maxs.length ? maxs : [17 * 60]))
  const startH = Math.floor(first / 60); const endH = Math.ceil(last / 60)
  const ROW = 50 // px par heure — grille aérée (une page paysage jusqu'à 11 h de plage)
  const gridH = (endH - startH) * ROW
  const days = DAYS.filter((d) => d.value !== 0 || slots.some((s) => s.dayOfWeek === 0))
  const lunchTop = (12 * 60 - startH * 60) / 60 * ROW

  const hourLabels = Array.from({ length: endH - startH + 1 }, (_, i) => `<div class="hour" style="top:${i * ROW}px">${String(startH + i).padStart(2, '0')}:00</div>`).join('')
  const hourLines = Array.from({ length: endH - startH }, (_, i) => `<div class="line ${i % 2 ? 'alt' : ''}" style="top:${i * ROW}px;height:${ROW}px"></div>`).join('')

  const columns = days.map((d) => {
    const list = slots.filter((s) => s.dayOfWeek === d.value).sort((a, b) => toMin(a.startTime) - toMin(b.startTime))
    const courses = list.filter((s) => !isBreak(s))
    const hours = courses.reduce((n, s) => n + (toMin(s.endTime) - toMin(s.startTime)), 0) / 60
    const cards = list.map((s) => {
      const top = (toMin(s.startTime) - startH * 60) / 60 * ROW + 2
      const height = Math.max((toMin(s.endTime) - toMin(s.startTime)) / 60 * ROW - 4, 16)
      if (isBreak(s)) {
        return `<div class="card break" style="top:${top}px;height:${height}px"><span>☕ ${esc(s.room || 'Récréation')}</span><span class="t">${esc(s.startTime)}–${esc(s.endTime)}</span></div>`
      }
      const [border, bg, fg] = PALETTE[subjectIndex(s.subjectId)]
      const compact = height < 34
      return `<div class="card" style="top:${top}px;height:${height}px;border-left-color:${border};background:${bg};color:${fg}">
        <div class="s">${esc(s.subjectLabel || 'Cours')}</div>
        ${!compact && s.teacherDisplay ? `<div class="p">${esc(s.teacherDisplay)}</div>` : ''}
        <div class="t">${esc(s.startTime)}–${esc(s.endTime)}${s.room ? ` · ${esc(s.room)}` : ''}</div>
      </div>`
    }).join('')
    return `<div class="col">
      <div class="head"><div class="dn">${d.label}</div><div class="ds">${courses.length ? `${courses.length} cours · ${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h` : 'Libre'}</div></div>
      <div class="body" style="height:${gridH}px">${hourLines}<div class="lunch" style="top:${lunchTop}px;height:${ROW}px"><span>PAUSE</span></div>${cards}</div>
    </div>`
  }).join('')

  const logoHtml = school.logoDataUrl ? `<img class="logo" src="${school.logoDataUrl}" alt="" />` : ''
  const total = slots.filter((s) => !isBreak(s))
  const totalH = total.reduce((n, s) => n + (toMin(s.endTime) - toMin(s.startTime)), 0) / 60

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Emploi du temps - ${esc(className)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
  .hdr { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .logo { width: 48px; height: 48px; object-fit: contain; border-radius: 10px; }
  .hdr h1 { margin: 0; font-size: 16px; }
  .hdr .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .hdr .right { margin-left: auto; text-align: right; }
  .hdr .right .cls { font-size: 18px; font-weight: 700; }
  .grid { display: flex; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; }
  .hours { width: 46px; flex: none; position: relative; background: #f8fafc; border-right: 1px solid #e2e8f0; }
  .hours .head { height: 42px; border-bottom: 1px solid #e2e8f0; }
  .hours .body { position: relative; }
  .hour { position: absolute; right: 6px; transform: translateY(-50%); font-size: 9px; color: #64748b; font-variant-numeric: tabular-nums; }
  .col { flex: 1; min-width: 0; border-left: 1px solid #e2e8f0; }
  .col:first-of-type { border-left: 0; }
  .head { height: 42px; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
  .dn { font-size: 11px; font-weight: 700; }
  .ds { font-size: 8.5px; color: #64748b; margin-top: 1px; }
  .body { position: relative; }
  .line { position: absolute; left: 0; right: 0; border-top: 1px solid #eef2f7; }
  .line.alt { background: #fafbfd; }
  .lunch { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(135deg, transparent, transparent 6px, #eef2f7 6px, #eef2f7 7px); }
  .lunch span { font-size: 8px; font-weight: 700; letter-spacing: .1em; color: #94a3b8; background: rgba(255,255,255,.9); padding: 2px 6px; border-radius: 4px; }
  .card { position: absolute; left: 4px; right: 4px; border: 1px solid rgba(15,23,42,.06); border-left-width: 3px; border-radius: 6px; padding: 4px 6px; overflow: hidden; line-height: 1.25; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
  .card .s { font-size: 9.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card .p { font-size: 8.5px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card .t { font-size: 8px; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card.break { flex-direction: row; align-items: center; justify-content: space-between; gap: 4px; border: 1px dashed #f59e0b; background: #fffbeb; color: #92400e; font-size: 8px; font-weight: 600; padding: 2px 6px; }
  .card.break .t { opacity: .8; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; font-size: 9px; color: #64748b; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .footer { margin-top: 10px; font-size: 8.5px; color: #94a3b8; text-align: center; }
</style></head><body>
<div class="hdr">${logoHtml}<div><h1>${esc(school.schoolName)}</h1><div class="sub">Emploi du temps · année scolaire en cours</div></div>
  <div class="right"><div class="cls">${esc(className)}</div><div class="sub">${total.length} cours · ${totalH.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h par semaine</div></div></div>
<div class="grid">
  <div class="hours"><div class="head"></div><div class="body" style="height:${gridH}px">${hourLabels}</div></div>
  ${columns}
</div>
<div class="legend">${Array.from(new Map(total.map((s) => [s.subjectId ?? s.subjectLabel, s])).values()).map((s) => `<span><i style="background:${PALETTE[subjectIndex(s.subjectId)][0]}"></i>${esc(s.subjectLabel)}</span>`).join('')}<span><i style="background:#fffbeb;border:1px dashed #f59e0b"></i>Récréation</span></div>
<div class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')} · ${esc(school.schoolName)}</div>
</body></html>`

  await printPdf(html, `Emploi du temps - ${className}.pdf`)
}
