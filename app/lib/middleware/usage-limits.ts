import { User } from '@/lib/db/types'
import { AuthenticatedUser } from '@/lib/auth/user-auth'
import { 
  getUserOrganizations, 
  getOrganizationUsageLimits, 
  getOrganizationUsage, 
  incrementOrganizationUsage,
} from '@/lib/db/queries'
import { UsageType } from '@/lib/db/types'

export interface UsageLimitResult {
  allowed: boolean
  currentUsage: number
  limit: number
  organizationId: string | null
  error?: string
}

/**
 * Get user's primary organization (first organization they belong to)
 */
export const getUserOrganization = async (user: AuthenticatedUser): Promise<string | null> => {
  const organizations = await getUserOrganizations(user.id)
  return organizations.length > 0 ? organizations[0].id : null
}

/**
 * Get the week start date for rolling 7-day window
 * Returns the date of the first usage in the current period, or today if no usage exists
 */
export const getWeekStartDate = async (
  organizationId: string,
  usageType: UsageType
): Promise<string> => {
  // Check for existing usage within the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
  
  const { query } = await import('@/lib/db/connection')
  const result = await query(
    `SELECT week_start_date 
     FROM organization_usage_tracking 
     WHERE organization_id = $1 AND usage_type = $2 
     AND week_start_date >= $3 
     ORDER BY week_start_date DESC 
     LIMIT 1`,
    [organizationId, usageType, sevenDaysAgoStr]
  )
  
  if (result.rows.length > 0) {
    const weekStart = result.rows[0].week_start_date
    const weekStartDate = new Date(weekStart)
    const today = new Date()
    const daysDiff = Math.floor((today.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // If still within 7-day window, use existing week start date
    if (daysDiff < 7) {
      return weekStart
    }
  }
  
  // No existing usage or outside window, return today's date
  return new Date().toISOString().split('T')[0]
}

/**
 * Check if user can perform an action based on usage limits
 * Returns allowed status, current usage, and limit
 */
export const checkUsageLimit = async (
  user: AuthenticatedUser,
  usageType: UsageType
): Promise<UsageLimitResult> => {
  // Users without organization have unlimited usage
  const organizationId = await getUserOrganization(user)
  if (!organizationId) {
    return {
      allowed: true,
      currentUsage: 0,
      limit: Infinity,
      organizationId: null
    }
  }
  
  // Get organization limits
  const limits = await getOrganizationUsageLimits(organizationId)
  if (!limits) {
    // No limits set, allow (shouldn't happen, but fail open)
    return {
      allowed: true,
      currentUsage: 0,
      limit: Infinity,
      organizationId
    }
  }
  
  // Get the limit for this usage type
  const limit = usageType === 'deep_research' 
    ? limits.deep_research_limit 
    : usageType === 'static_ads'
    ? limits.static_ads_limit
    : usageType === 'templates_images'
    ? limits.templates_images_limit
    : limits.pre_lander_limit
  
  // Get current week start date
  const weekStartDate = await getWeekStartDate(organizationId, usageType)
  
  // Check if we're still within the 7-day window
  const weekStart = new Date(weekStartDate)
  const today = new Date()
  const daysDiff = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
  
  let currentUsage = 0
  
  if (daysDiff < 7) {
    // Within the 7-day window, get current usage
    const usage = await getOrganizationUsage(organizationId, usageType, weekStartDate)
    currentUsage = usage?.count || 0
  } else {
    // Outside the 7-day window, usage is 0 (will reset on next increment)
    currentUsage = 0
  }
  
  // Check if limit is exceeded
  const allowed = currentUsage < limit
  
  return {
    allowed,
    currentUsage,
    limit,
    organizationId,
      error: !allowed 
      ? `You've reached your weekly limit of ${limit} ${usageType === 'deep_research' ? 'Deep Research' : usageType === 'static_ads' ? 'Static Ads' : usageType === 'templates_images' ? 'Template Images' : 'Pre-Lander'} actions. Your limit resets automatically based on a rolling 7-day window.`
      : undefined
  }
}

/**
 * Check and increment usage (analytics only - does not block jobs)
 * Per-type usage is tracked for analytics purposes only
 * Job credit enforcement is handled by checkJobCreationLimit in billing.ts
 */
export const checkAndIncrementUsage = async (
  user: AuthenticatedUser,
  usageType: UsageType
): Promise<UsageLimitResult> => {
  // Get user's organization
  const organizationId = await getUserOrganization(user)
  if (!organizationId) {
    // User without organization has unlimited usage
    return {
      allowed: true,
      currentUsage: 0,
      limit: Infinity,
      organizationId: null
    }
  }
  
  // Always allow - per-type usage is analytics only
  // Increment usage for tracking
  const updatedUsage = await incrementOrganizationUsage(organizationId, usageType)

  return {
    allowed: true,
    currentUsage: updatedUsage.count,
    limit: Infinity, // No limit for analytics tracking
    organizationId
  }
}

/**
 * Get current usage statistics for analytics (does not block jobs)
 */
export const getUsageStats = async (
  user: AuthenticatedUser,
  usageType: UsageType
): Promise<{ count: number; limit: number; organizationId: string | null }> => {
  const organizationId = await getUserOrganization(user)
  if (!organizationId) {
    return { count: 0, limit: Infinity, organizationId: null }
  }
  
  const limits = await getOrganizationUsageLimits(organizationId)
  if (!limits) {
    return { count: 0, limit: Infinity, organizationId }
  }
  
  const limit = usageType === 'deep_research' 
    ? limits.deep_research_limit 
    : usageType === 'static_ads'
    ? limits.static_ads_limit
    : limits.pre_lander_limit
  
  const weekStartDate = await getWeekStartDate(organizationId, usageType)
  const usage = await getOrganizationUsage(organizationId, usageType, weekStartDate)
  
  return {
    count: usage?.count || 0,
    limit,
    organizationId
  }
}

