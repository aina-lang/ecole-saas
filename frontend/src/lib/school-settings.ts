import { getTenantSetting } from './tenant-settings'

export interface SchoolSettings {
  schoolName: string
  logoDataUrl: string
}

// Implémentation déplacée dans image-utils (partagée avec useLocalPhotoSrc) ;
// ré-exportée ici pour les importeurs existants (pdf/receipt, pdf/bulletin).
export { fetchAsDataUrl } from './image-utils'
import { fetchAsDataUrl } from './image-utils'

export async function getSchoolSettings(): Promise<SchoolSettings> {
  const defaultName = 'Établissement scolaire'

  try {
    const raw = await getTenantSetting('school')
    const school = raw ? JSON.parse(raw) : {}
    const schoolName = school.schoolName || defaultName
    let logoDataUrl = ''

    if (school.logoUrl) {
      logoDataUrl = await fetchAsDataUrl(school.logoUrl)
    }

    return { schoolName, logoDataUrl }
  } catch {
    return { schoolName: defaultName, logoDataUrl: '' }
  }
}
