let token: string | null = null

export function setAuthToken(newToken: string | null) {
  token = newToken
}

export function getAuthToken(): string | null {
  return token
}
