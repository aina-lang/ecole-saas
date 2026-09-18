// Capture d'écrans de l'app via le protocole DevTools.
// Usage : node capture.mjs <port> <dossier> <nom>=<route> [<nom>=<route> …]
// Les routes sont des hash-routes (#/login, #/register…). Rendu 1366×768 ×2.
import { writeFileSync } from 'node:fs'
const [port, outDir, ...shots] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 45; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = l.find((t) => t.type === 'page'); if (target) break } catch {}
  await sleep(1000)
}
if (!target) { console.log('AUCUNE PAGE'); process.exit(1) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id) } }
await new Promise((r) => (ws.onopen = r))
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 2, mobile: false })
await sleep(6000)
for (const spec of shots) {
  const [name, route] = spec.split('=')
  await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(route)}` })
  await sleep(3500)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.data, 'base64'))
  const title = (await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,60)', returnByValue: true })).result?.value
  console.log(`  ✔ ${name}  (${route})  « ${String(title).replace(/\n/g, ' ').slice(0, 50)} »`)
}
ws.close(); process.exit(0)
