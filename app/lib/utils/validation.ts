/**
 * Shared validation utilities
 */

/**
 * Normalize URL by adding https:// if protocol is missing
 */
export function normalizeUrl(url: string): string {
  if (!url || url.trim().length === 0) return url
  
  const trimmed = url.trim()
  
  // If it already has a protocol, return as is
  if (trimmed.match(/^https?:\/\//i)) {
    return trimmed
  }
  
  // Otherwise, prepend https://
  return `https://${trimmed}`
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false
  try {
    // Normalize the URL first (add https:// if missing)
    const normalized = normalizeUrl(url)
    const urlObj = new URL(normalized)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate if a string is a valid email address
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.trim().length === 0) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

