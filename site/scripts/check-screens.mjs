/*
 * Vérifie que chaque capture citée dans le code existe bien dans
 * public/screens.
 *
 * Une image absente ne casse ni la compilation ni l'export statique : elle se
 * traduit par une icône brisée sur le site publié, qu'on ne voit qu'en
 * regardant la page en ligne. C'est exactement ce qui est arrivé après le
 * passage des captures de PNG en WebP — trois références en JSX avaient été
 * oubliées, et le site est parti en production avec un hero cassé.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const screensDir = join(root, 'public', 'screens')

const available = new Set(readdirSync(screensDir))

/** Tous les fichiers .ts/.tsx sous src/. */
function sources(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sources(full))
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

// Attrape aussi bien `screen: 'x.webp'` que `src="x.webp"`.
const REFERENCE = /['"]([a-z0-9-]+\.(?:webp|png|jpg|jpeg|avif))['"]/gi

const missing = []
const used = new Set()

for (const file of sources(join(root, 'src'))) {
  const code = readFileSync(file, 'utf8')
  for (const [, name] of code.matchAll(REFERENCE)) {
    // On ne juge que les noms qui désignent réellement une capture : les
    // autres images du site vivent ailleurs dans public/.
    if (!available.has(name) && !name.startsWith('sekoliko-')) {
      missing.push(`${file.replace(root + '/', '')} → ${name}`)
    }
    used.add(name)
  }
}

const orphans = [...available].filter((f) => !used.has(f))

if (missing.length) {
  console.error('\n✖ Captures référencées mais absentes de public/screens :')
  for (const m of missing) console.error('   ' + m)
  console.error(`\n   Disponibles : ${[...available].sort().join(', ')}\n`)
  process.exit(1)
}

if (orphans.length) {
  // Simple avertissement : un fichier inutilisé alourdit le déploiement sans
  // rien casser.
  console.warn(`⚠ Captures présentes mais jamais utilisées : ${orphans.join(', ')}`)
}

console.log(`✓ ${used.size} capture(s) référencée(s), toutes présentes`)
