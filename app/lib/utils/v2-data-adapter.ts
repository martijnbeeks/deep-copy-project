import { isV2Job } from './v2-data-transformer'

/**
 * Adapter to make V2 data compatible with existing components
 * This bridges the gap between V2 structure and existing component expectations
 */

/**
 * Extract marketing angles from V2 or V1 job data
 * Returns a flat array of angles in the format expected by existing components
 */
export function extractMarketingAngles(job: any): any[] {
  if (!job || !job.result?.metadata?.full_result) {
    return []
  }

  const fullResult = job.result.metadata.full_result

  // Check if this is V2 data
  if (fullResult.results?.marketing_avatars) {
    // V2 data - extract angles from all avatars
    const angles: any[] = []
    
    fullResult.results.marketing_avatars.forEach((avatarData: any, avatarIndex: number) => {
      const avatarName = avatarData.avatar?.name || `Avatar ${avatarIndex + 1}`
      const anglesData = avatarData.angles
      
      if (anglesData?.generated_angles) {
        anglesData.generated_angles.forEach((angle: any, angleIndex: number) => {
          // Create angle object in V1-compatible format
          const angleObject = {
            angle: angle.angle_title,
            title: angle.angle_title,
            subtitle: angle.angle_subtitle,
            type: angle.angle_type,
            emotional_driver: angle.emotional_driver,
            risk_level: angle.risk_level,
            core_argument: angle.core_argument,
            target_age_range: angle.target_age_range,
            target_audience: angle.target_audience,
            pain_points: angle.pain_points || [],
            desires: angle.desires || [],
            common_objections: angle.common_objections || [],
            failed_alternatives: angle.failed_alternatives || [],
            pain_quotes: angle.pain_quotes || [],
            desire_quotes: angle.desire_quotes || [],
            objection_quotes: angle.objection_quotes || [],
            // V2 specific metadata
            avatar_name: avatarName,
            avatar_index: avatarIndex,
            angle_index: angleIndex,
            necessary_beliefs: avatarData.necessary_beliefs
          }
          
          angles.push(angleObject)
        })
      }
    })
    
    return angles
  } else {
    // V1 data - return existing marketing_angles
    return fullResult.results?.marketing_angles || []
  }
}

/**
 * Extract avatars from V2 or V1 job data
 * Returns avatars in the format expected by existing components
 */
export function extractAvatars(job: any): any[] {
  if (!job || !job.result?.metadata?.full_result) {
    return []
  }

  const fullResult = job.result.metadata.full_result

  // Check if this is V2 data
  if (fullResult.results?.marketing_avatars) {
    // V2 data - return the transformed avatars (already stored in job.avatars)
    return job.avatars || []
  } else {
    // V1 data - return existing avatars
    return job.avatars || []
  }
}

/**
 * Get foundational document text (deep research output)
 */
export function getFoundationalDocText(job: any): string {
  if (!job || !job.result?.metadata?.full_result) {
    return ''
  }

  const fullResult = job.result.metadata.full_result

  // Both V1 and V2 have deep_research_output
  return fullResult.results?.deep_research_output || ''
}

/**
 * Check if job has marketing angles available
 */
export function hasMarketingAngles(job: any): boolean {
  const angles = extractMarketingAngles(job)
  return angles.length > 0
}

/**
 * Get avatar selection options for V2 jobs
 */
export function getAvatarSelectionOptions(job: any): any[] {
  if (!isV2Job(job?.avatars)) {
    return []
  }

  // For V2 jobs, return all avatars as selection options
  return job.avatars?.map((avatar: any, index: number) => ({
    index,
    name: avatar.persona_name,
    description: avatar.description,
    avatar_data: avatar.v2_avatar_data,
    angles_data: avatar.v2_angles_data
  })) || []
}

/**
 * Get angles for a specific avatar (V2 only)
 */
export function getAvatarAngles(job: any, avatarIndex: number): any[] {
  if (!isV2Job(job?.avatars) || !job.avatars[avatarIndex]) {
    return []
  }

  const avatar = job.avatars[avatarIndex]
  return avatar.v2_angles_data?.generated_angles || []
}

/**
 * Format angle for display (compatible with existing components)
 */
export function formatAngleForDisplay(angle: any): {
  angleString: string
  angleTitle: string
  angleDescription: string
  angleObj: any
} {
  if (typeof angle === 'string') {
    // V1 string format
    return {
      angleString: angle,
      angleTitle: angle.split(':')[0]?.trim() || angle,
      angleDescription: angle,
      angleObj: null
    }
  } else {
    // V2 object format
    const angleString = angle.angle || angle.angle_title || ''
    return {
      angleString,
      angleTitle: angle.title || angle.angle_title || angleString,
      angleDescription: angle.subtitle || angle.angle_subtitle || angleString,
      angleObj: angle
    }
  }
}

/**
 * Get necessary beliefs for an avatar (V2 only)
 */
export function getAvatarNecessaryBeliefs(job: any, avatarIndex: number): string {
  if (!isV2Job(job?.avatars) || !job.avatars[avatarIndex]) {
    return ''
  }

  return job.avatars[avatarIndex].v2_necessary_beliefs || ''
}

/**
 * Create avatar selection data for UI components
 */
export function createAvatarSelectionData(job: any): {
  avatars: any[]
  selectedAvatar: any
  angles: any[]
} {
  const avatars = extractAvatars(job)
  const angles = extractMarketingAngles(job)
  
  // Default to first avatar for selection
  const selectedAvatar = avatars[0] || null

  return {
    avatars,
    selectedAvatar,
    angles
  }
}
