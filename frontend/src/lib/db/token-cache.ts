let accessToken: string | null = null
let refreshToken: string | null = null
let tenantId: string | null = null

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access
  refreshToken = refresh
}

export function setTenantId(id: string | null): void {
  tenantId = id
  if (id) {
    localStorage.setItem('tenantId', id)
  } else {
    localStorage.removeItem('tenantId')
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return refreshToken
}

export function getTenantId(): string | null {
  return tenantId
}

export function clearTokens(): void {
  accessToken = null
  refreshToken = null
  tenantId = null
  localStorage.removeItem('tenantId')
}
