import { MarketingAvatarV2, MarketingAngleV2 } from '@/lib/clients/deepcopy-client'

// Interface for existing avatar schema in database
export interface TransformedAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
  pain_point: string
  emotion: string
  desire: string
  characteristics: string[]
  objections: string[]
  failed_alternatives: string[]
  is_researched: boolean
  // V2 specific fields
  v2_avatar_data: any
  v2_angles_data: any
  v2_necessary_beliefs: string
  avatar_index: number
  marketing_angles?: any[] // Direct access to angles for easier component usage
}

/**
 * Transform V2 API response to existing database schema format
 * This allows V2 data to be stored in the existing avatars field without schema changes
 */
export function transformV2ToExistingSchema(v2Result: any): TransformedAvatar[] {
  if (!v2Result?.results?.marketing_avatars) {
    throw new Error('Invalid V2 result structure: missing marketing_avatars')
  }

  return v2Result.results.marketing_avatars.map((avatarData: MarketingAvatarV2, index: number) => {
    const avatar = avatarData.avatar
    const angles = avatarData.angles

    return {
      // Map to existing schema fields
      persona_name: avatar.name || `Avatar ${index + 1}`,
      description: avatar.demographics?.one_sentence_description || '',
      age_range: avatar.demographics?.age_range || '',
      gender: avatar.demographics?.gender || '',
      key_buying_motivation: avatar.desire_dimensions?.surface_desire || '',
      pain_point: avatar.pain_dimensions?.surface_pain || '',
      emotion: avatar.pain_dimensions?.dominant_negative_emotion || '',
      desire: avatar.desire_dimensions?.surface_desire || '',
      characteristics: avatar.demographics?.occupation ? [avatar.demographics.occupation] : [],
      objections: avatar.objections?.primary_objection ? [avatar.objections.primary_objection] : [],
      failed_alternatives: avatar.failed_solutions?.solutions_tried ? [avatar.failed_solutions.solutions_tried] : [],
      is_researched: true, // All V2 avatars come pre-researched

      // Store V2 specific data for enhanced functionality
      v2_avatar_data: avatar, // Full avatar sheet with all details
      v2_angles_data: angles, // Angles for this avatar
      v2_necessary_beliefs: avatarData.necessary_beliefs || '',
      avatar_index: index,

      // Add marketing_angles for direct component access
      marketing_angles: angles?.generated_angles || []
    }
  })
}

/**
 * Extract selected angle from V2 data
 */
export function getSelectedAngleFromV2(avatar: TransformedAvatar, angleIndex: number): MarketingAngleV2 | null {
  if (!avatar.v2_angles_data?.generated_angles) {
    return null
  }

  return avatar.v2_angles_data.generated_angles[angleIndex] || null
}

/**
 * Get top 3 angles for an avatar from V2 data
 */
export function getTopAnglesFromV2(avatar: TransformedAvatar) {
  if (!avatar.v2_angles_data?.top_3_angles) {
    return null
  }

  return avatar.v2_angles_data.top_3_angles
}

/**
 * Check if a job uses V2 data
 */
export function isV2Job(avatars: any[]): boolean {
  if (!avatars || avatars.length === 0) return false

  // Check if first avatar has V2 specific fields
  const firstAvatar = avatars[0]
  return !!(firstAvatar.v2_avatar_data && firstAvatar.v2_angles_data)
}

/**
 * Get avatar display name from V2 data
 */
export function getAvatarDisplayName(avatar: TransformedAvatar): string {
  return avatar.persona_name || `Avatar ${avatar.avatar_index + 1}`
}

/**
 * Get avatar description for UI display
 */
export function getAvatarDescription(avatar: TransformedAvatar): string {
  if (avatar.v2_avatar_data?.demographics?.one_sentence_description) {
    return avatar.v2_avatar_data.demographics.one_sentence_description
  }
  return avatar.description
}

/**
 * Get avatar pain points for UI display
 */
export function getAvatarPainPoints(avatar: TransformedAvatar): string[] {
  if (avatar.v2_avatar_data?.raw_language?.pain_language) {
    return avatar.v2_avatar_data.raw_language.pain_language
  }
  return avatar.pain_point ? [avatar.pain_point] : []
}

/**
 * Get avatar desires for UI display
 */
export function getAvatarDesires(avatar: TransformedAvatar): string[] {
  if (avatar.v2_avatar_data?.raw_language?.desire_language) {
    return avatar.v2_avatar_data.raw_language.desire_language
  }
  return avatar.desire ? [avatar.desire] : []
}

/**
 * Format angle for display
 */
export function formatAngleForDisplay(angle: MarketingAngleV2): {
  title: string
  subtitle: string
  type: string
  coreArgument: string
  riskLevel: string
  targetAudience: string
  painPoints: string[]
  desires: string[]
} {
  return {
    title: angle.angle_title,
    subtitle: angle.angle_subtitle,
    type: angle.angle_type,
    coreArgument: angle.core_argument,
    riskLevel: angle.risk_level,
    targetAudience: angle.target_audience,
    painPoints: angle.pain_points || [],
    desires: angle.desires || []
  }
}

/**
 * Validate V2 result structure
 */
export function validateV2Result(v2Result: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!v2Result) {
    errors.push('V2 result is null or undefined')
    return { isValid: false, errors }
  }

  if (!v2Result.results) {
    errors.push('Missing results object')
  }

  if (!v2Result.results.marketing_avatars) {
    errors.push('Missing marketing_avatars array')
  } else if (!Array.isArray(v2Result.results.marketing_avatars)) {
    errors.push('marketing_avatars is not an array')
  } else if (v2Result.results.marketing_avatars.length === 0) {
    errors.push('marketing_avatars array is empty')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
