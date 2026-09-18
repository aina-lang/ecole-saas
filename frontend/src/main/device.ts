import { app } from 'electron'
import { execFile } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'

// Identifiant de la machine, envoyé à la création d'un établissement : le
// serveur n'ouvre qu'un essai gratuit par ordinateur.
//
// On part de l'identifiant de l'OS (MachineGuid sous Windows) parce qu'il
// survit à une réinstallation de l'application et à l'effacement de ses
// données. Le serveur n'en reçoit qu'une empreinte : il doit reconnaître la
// machine, pas connaître son identifiant Windows.

let cached: string | null = null

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout)),
    )
  })
}

async function osMachineId(): Promise<string | null> {
  try {
    if (process.platform === 'win32') {
      // /reg:64 : l'installateur livre aussi une version 32 bits. Sans ce
      // drapeau, un processus 32 bits sur Windows 64 bits lit la vue
      // redirigée du registre (WOW6432Node), où MachineGuid n'existe pas.
      const out = await run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'])
      return out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i)?.[1] ?? null
    }
    if (process.platform === 'darwin') {
      const out = await run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'])
      return out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] ?? null
    }
    for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const v = readFileSync(p, 'utf8').trim()
        if (v) return v
      } catch { /* fichier suivant */ }
    }
  } catch { /* secours ci-dessous */ }
  return null
}

/**
 * Secours si l'OS ne fournit rien : identifiant aléatoire conservé dans le
 * profil de l'application. Plus faible — il disparaît avec les données de
 * l'app — mais la règle reste appliquée dans le cas courant.
 */
function fallbackId(): string {
  const file = join(app.getPath('userData'), 'device-id')
  try {
    const v = readFileSync(file, 'utf8').trim()
    if (v) return v
  } catch { /* à créer */ }
  const id = randomUUID()
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file, id, 'utf8')
  } catch { /* profil en lecture seule : identifiant de session */ }
  return id
}

/** Empreinte SHA-256 (64 caractères hexadécimaux) de la machine. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  const raw = (await osMachineId()) ?? fallbackId()
  cached = createHash('sha256').update(`sekoliko-device-v1:${raw.toLowerCase()}`).digest('hex')
  return cached
}
