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

/**
 * Get avatar-based numbering (1a, 1b, 1c... for first avatar, 2a, 2b... for second avatar, etc.)
 */
export const getAvatarBasedNumber = (avatarIndex: number, angleIndex: number): string => {
  const avatarNumber = avatarIndex + 1;
  const angleLetter = String.fromCharCode(97 + (angleIndex % 26)); // 97 = 'a' in ASCII. Using % 26 just in case.
  return `${avatarNumber}${angleLetter}`;
};
