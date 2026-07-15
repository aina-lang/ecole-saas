import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const SETTINGS_PATH = join(app.getPath('userData'), 'settings.json')
const DEFAULT_SETTINGS: Record<string, string> = {}

function ensureSettingsFile() {
  const dir = join(app.getPath('userData'))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(SETTINGS_PATH)) {
    writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2))
  }
}

function readSettings(): Record<string, string> {
  ensureSettingsFile()
  try {
    const data = readFileSync(SETTINGS_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: Record<string, string>) {
  ensureSettingsFile()
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

export function getSetting(key: string): string | null {
  const settings = readSettings()
  return settings[key] ?? null
}

export function setSetting(key: string, value: string) {
  const settings = readSettings()
  settings[key] = value
  writeSettings(settings)
}

export function getAllSettings(): Record<string, string> {
  return readSettings()
}
