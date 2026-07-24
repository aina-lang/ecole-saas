import { getTenantSetting } from './tenant-settings'

export interface SchoolSettings {
  schoolName: string
  logoDataUrl: string
}

async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

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
