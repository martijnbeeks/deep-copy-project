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
      return 'demo@example.com'
    }
  }
  return 'demo@example.com'
}

