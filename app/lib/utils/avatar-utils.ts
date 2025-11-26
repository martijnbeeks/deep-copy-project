/**
 * Avatar-related utility functions
 * Shared across avatar components and pages
 */

/**
 * Get gender icon emoji based on gender string
 */
export const getGenderIcon = (gender: string): string => {
  switch (gender.toLowerCase()) {
    case 'male': return '👨'
    case 'female': return '👩'
    case 'both': return '👥'
    default: return '👤'
  }
}

/**
 * Capitalize the first letter of a string
 */
export const capitalizeFirst = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
