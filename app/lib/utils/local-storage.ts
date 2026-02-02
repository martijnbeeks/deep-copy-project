/**
 * Safe localStorage utilities that handle SSR and errors gracefully
 */

/**
 * Safely get an item from localStorage
 * Returns null if localStorage is not available (SSR) or on error
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return localStorage.getItem(key)
  } catch (error) {
    // localStorage might be disabled or quota exceeded
    return null
  }
}

/**
 * Safely set an item in localStorage
 * Returns false if localStorage is not available (SSR) or on error
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    // localStorage might be disabled or quota exceeded
    return false
  }
}

/**
 * Safely remove an item from localStorage
 * Returns false if localStorage is not available (SSR) or on error
 */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get user email from auth storage safely
 */
export function getUserEmailFromStorage(): string {
  const authStorage = safeGetItem('auth-storage')
  if (!authStorage) return ''

  try {
    const authData = JSON.parse(authStorage)
    return authData.state?.user?.email || ''
  } catch {
    return ''
  }
}

