import { getTenantId } from './db/token-cache'
import { getDocument, createDatabase } from './db/pouchdb'
import { saveEntity } from './db/pouchdb-compat'

// Les réglages d'établissement (nom/logo école, année scolaire, système de
// périodes, config paiement...) vivent dans des documents PouchDB
// 'TenantSetting' (_id = clé) : ils se répliquent donc entre les postes du
// tenant via CouchDB, comme le reste des données. Avant, ils n'existaient que
// dans le settings.json local du poste — le poste B démarrait sans logo, sans
// année scolaire et avec le système de périodes par défaut.
//
// Le fichier local reste utilisé en SECOURS (lecture si PouchDB est
// indisponible, ex. avant login) et les anciennes valeurs y sont rapatriées
// une fois vers PouchDB à la première lecture.

function scopedKey(key: string, tenantId: string): string {
  return `${key}__${tenantId}`
}

function currentTenantId(): string {
  return getTenantId() || localStorage.getItem('tenantId') || 'default'
}

async function readLegacy(key: string): Promise<string | null> {
  const api = (window as any).api
  if (!api?.settings?.get) return null
  // UNIQUEMENT la clé scopée au tenant. L'ancienne clé globale du poste
  // (d'avant le cloisonnement) contenait les réglages du DERNIER compte
  // utilisé : la relire pour un autre tenant lui faisait hériter du nom, du
  // logo et de la config d'une autre école — et, depuis la migration vers
  // PouchDB, les écrivait dans ses documents synchronisés.
  return (await api.settings.get(scopedKey(key, currentTenantId()))) ?? null
}

export async function getTenantSetting(key: string): Promise<string | null> {
  // Source primaire : document répliqué.
  try {
    const doc = await getDocument('TenantSetting', key)
    if (doc && typeof doc.value === 'string') return doc.value
  } catch { /* base indisponible (pas encore de session) : secours local */ }

  // Rapatriement depuis le fichier local UNIQUEMENT pour une installation
  // d'avant la migration (base de réglages encore vide). Dès que le tenant a
  // des réglages répliqués, l'absence d'un document est une information en
  // soi (réglage jamais défini, ou supprimé) — le recréer depuis une copie
  // locale ressusciterait des valeurs obsolètes ou héritées d'un autre compte.
  if (!(await settingsDbIsEmpty())) return null

  const legacy = await readLegacy(key)
  if (legacy != null) {
    setTenantSetting(key, legacy).catch(() => {})
    return legacy
  }
  return null
}

async function settingsDbIsEmpty(): Promise<boolean> {
  const db = createDatabase('TenantSetting')
  try {
    const info = await db.info()
    return (info.doc_count ?? 0) === 0
  } catch {
    return true
  } finally {
    /* pas de close() : connexion IndexedDB partagée avec la réplication live */
  }
}

export async function setTenantSetting(key: string, value: string): Promise<void> {
  await saveEntity('TenantSetting', { id: key, key, value })
  // Copie locale de secours (lisible avant login / si PouchDB indisponible).
  try {
    const api = (window as any).api
    if (api?.settings?.set) await api.settings.set(scopedKey(key, currentTenantId()), value)
  } catch { /* le document PouchDB fait foi */ }
}
