/**
 * Environment configuration utilities
 */

/**
 * Check if we're in development mode
 * Uses DEEPCOPY_API_MODE env var if set, otherwise falls back to NODE_ENV
 */
export function isDevMode(): boolean {
  const apiMode = process.env.DEEPCOPY_API_MODE
  if (apiMode === 'dev' || apiMode === 'development') {
    return true
  }
  if (apiMode === 'prod' || apiMode === 'production') {
    return false
  }
  // Fallback to NODE_ENV
  return process.env.NODE_ENV === 'development'
}

