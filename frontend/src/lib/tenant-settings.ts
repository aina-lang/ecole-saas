import { getTenantId } from './db/token-cache'

// window.api.settings (Electron) est un fichier JSON local UNIQUE pour tout
// le poste (settings.json dans userData) — sans cloisonnement, deux comptes de
// deux écoles différentes utilisées sur le même appareil se partageaient la
// configuration scolaire (couleur, année scolaire, système de périodes,
// config paiement...). Ce module force la clé à inclure le tenantId courant :
// tous les comptes d'UN MÊME tenant partagent la même configuration (c'est le
// but), mais deux tenants différents ne se voient plus jamais.
function scopedKey(key: string, tenantId: string): string {
  return `${key}__${tenantId}`
}

function currentTenantId(): string {
  return getTenantId() || localStorage.getItem('tenantId') || 'default'
}

export async function getTenantSetting(key: string): Promise<string | null> {
  const api = (window as any).api
  if (!api?.settings?.get) return null
  const tenantId = currentTenantId()

  const scoped = await api.settings.get(scopedKey(key, tenantId))
  if (scoped != null) return scoped

  // Migration ponctuelle : valeur pré-existante non cloisonnée (avant ce
  // correctif). On la rapatrie une fois sous la clé scopée à ce tenant, puis
  // on ne relit plus jamais la clé globale pour ce tenant.
  const legacy = await api.settings.get(key)
  if (legacy != null) {
    await api.settings.set(scopedKey(key, tenantId), legacy)
    return legacy
  }
  return null
}

export async function setTenantSetting(key: string, value: string): Promise<void> {
  const api = (window as any).api
  if (!api?.settings?.set) return
  await api.settings.set(scopedKey(key, currentTenantId()), value)
}
