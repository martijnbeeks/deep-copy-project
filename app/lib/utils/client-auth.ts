/**
 * Client-side authentication utilities
 * For browser/client-side usage only
 */

// Shared constants
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
} as const

// Auth token getter
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken') || null
  }
  return null
}

// Get user email from auth store (for server-side compatibility)
export function getUserEmail(): string {
  if (typeof window !== 'undefined') {
    // Try to get from auth store
    try {
      const { useAuthStore } = require('@/stores/auth-store')
      const { user } = useAuthStore.getState()
      return user?.email || 'demo@example.com'
    } catch {
      // Fallback to persisted zustand storage (useful before store is hydrated/available)
      try {
        const raw = localStorage.getItem('auth-storage')
        if (!raw) return 'demo@example.com'

        const parsed = JSON.parse(raw)
        const email = parsed?.state?.user?.email
        return typeof email === 'string' && email.length > 0 ? email : 'demo@example.com'
      } catch {
        return 'demo@example.com'
      }
    }
  }
  return 'demo@example.com'
}

export function getAuthorizationHeader(): Record<string, string> {
  const token = getAuthToken()
  const userEmail = getUserEmail()
  const value = token ? token : userEmail

  return value ? { Authorization: `Bearer ${value}` } : {}
}

