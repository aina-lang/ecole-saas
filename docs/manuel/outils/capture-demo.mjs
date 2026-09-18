// Capture en thème clair, pointeur hors champ, avec relevé des zones à flouter.
// Usage : node capture-demo.mjs <port> <dossier> <email> <mdp> <nom>=<route> …
import { writeFileSync } from 'node:fs'
const [port, outDir, email, password, ...shots] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 60; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = l.find((t) => t.type === 'page'); if (target) break } catch {}
  await sleep(1000)
}
if (!target) { console.log('AUCUNE PAGE'); process.exit(1) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id) } }
await new Promise((r) => (ws.onopen = r))
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const mouse = async (x, y, click = false) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  if (click) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
}
const clickEl = async (expr) => {
  const r = await ev(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  if (!r) return false
  await mouse(r.x, r.y, true); await sleep(700); return true
}
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 2, mobile: false })
await sleep(6000)
// Thème clair, comme les autres captures du manuel.
await ev(`localStorage.setItem('vite-ui-theme', 'light'); location.reload()`)
await sleep(6000)

await ev(`location.hash = '#/login'`); await sleep(2500)
await ev(`document.querySelector('input[type=email]').focus()`); await send('Input.insertText', { text: email })
await ev(`document.querySelector('input[type=password]').focus()`); await send('Input.insertText', { text: password })
await ev(`document.querySelector('form button[type=submit]').click()`)
for (let i = 0; i < 30; i++) { await sleep(1000); if ((await ev('location.hash')).includes('dashboard')) break }
console.log('  connexion :', await ev('location.hash'), '| thème :', await ev(`document.documentElement.className`))
await ev(`location.hash = '#/students'`)
for (let i = 0; i < 90; i++) { await sleep(2000); if ((await ev(`document.querySelectorAll('tbody tr').length`)) >= 8) break }
await sleep(8000)

// Zones sensibles, en pixels CSS : bloc logo + nom de l'établissement, et
// toute adresse e-mail hors des domaines de démo.
const SENSITIVE = `(() => {
  const rects = []
  const push = (el) => { const b = el.getBoundingClientRect(); if (b.width && b.height) rects.push([b.x, b.y, b.width, b.height]) }
  for (const el of document.querySelectorAll('aside *')) {
    if (el.children.length === 0 && el.textContent.trim() === 'JJ CHARLES') { push(el); const img = el.closest('div')?.parentElement?.querySelector('img'); if (img) push(img) }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length === 0 && /@/.test(el.textContent) && !/demo\\.mg/.test(el.textContent) && !/merciaaina@gmail\\.com/.test(el.textContent)) push(el)
  }
  return rects
})()`

for (const spec of shots) {
  const [name, route] = spec.split('=')
  await ev(`location.hash = ${JSON.stringify(route)}`)
  await sleep(4500)
  if (name === 'saisie-notes') {
    const pick = async (i, wanted) => {
      if (!(await clickEl(`document.querySelectorAll('button[role=combobox]')[${i}]`))) return 'sélecteur absent'
      await sleep(600)
      const ok = await clickEl(`(() => { const o = [...document.querySelectorAll('[role=option]')]; return o.find((x) => ${JSON.stringify(wanted)}.test(x.textContent)) || o[0] })()`.replace(`${JSON.stringify(wanted)}.test`, `${wanted}.test`))
      return ok ? await ev(`document.querySelectorAll('button[role=combobox]')[${i}].textContent.trim()`) : 'option absente'
    }
    console.log('    classe  :', await pick(0, '/^6ème A$/'))
    await sleep(1500)
    console.log('    matière :', await pick(1, '/Math|Français/'))
    await sleep(800)
    console.log('    type    :', await pick(2, '/Devoir|Contrôle/'))
    await sleep(2500)
    const notes = ['14', '11,5', '16', '9', '12']
    const inputs = await ev(`document.querySelectorAll('tbody input').length`)
    for (let i = 0; i < Math.min(notes.length, inputs); i++) {
      await ev(`(() => { const el = [...document.querySelectorAll('tbody input')].filter((x) => x.type !== 'hidden')[${i * 2}]; el?.focus() })()`)
      await send('Input.insertText', { text: notes[i] })
    }
    console.log('    notes saisies (non enregistrées) :', Math.min(notes.length, inputs), '/ champs :', inputs)
    await ev(`document.activeElement?.blur(); window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0)`)
    await sleep(800)
  }
  await mouse(683, 14) // barre de titre : aucun effet de survol
  await sleep(700)
  const rects = await ev(SENSITIVE)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.data, 'base64'))
  writeFileSync(`${outDir}/${name}.rects.json`, JSON.stringify(rects))
  console.log(`  ✔ ${name.padEnd(15)} zones à flouter : ${rects.length}`)
}
ws.close(); process.exit(0)
