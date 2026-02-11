import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import {
  getOrganizationUsageLimits,
  setOrganizationUsageLimits,
  getAllOrganizationsWithLimits,
  getCurrentBillingPeriodForOrganization,
  getUsedCreditsInPeriod,
  getPlanCredits,
  getAdminBonusCredits,
  getTotalAvailableCredits,
  getRemainingCredits,
  updateAdminBonusCredits
} from '@/lib/db/queries'
import { handleApiError, createValidationErrorResponse } from '@/lib/middleware/error-handler'

// GET limits and current usage for a specific organization
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const organizationId = params.id
    const limits = await getOrganizationUsageLimits(organizationId)

    if (!limits) {
      return createValidationErrorResponse('Organization not found', 404)
    }

    const allOrgs = await getAllOrganizationsWithLimits()
    const orgData = allOrgs.find(org => org.organization_id === organizationId)
    const period = await getCurrentBillingPeriodForOrganization(organizationId)
    const jobCreditsUsed = await getUsedCreditsInPeriod(organizationId, period.start)
    
    // Get new credit breakdown
    const [planCredits, adminBonusCredits, totalAvailable, remainingCredits] = await Promise.all([
      getPlanCredits(organizationId),
      getAdminBonusCredits(organizationId),
      getTotalAvailableCredits(organizationId),
      getRemainingCredits(organizationId)
    ])

    return NextResponse.json({
      organization_id: organizationId,
      credits: {
        plan_credits: planCredits,
        admin_bonus_credits: adminBonusCredits,
        total_available: totalAvailable,
        used: jobCreditsUsed,
        remaining: remainingCredits,
        billing_period_end: period.end.toISOString()
      },
      usage: {
        deep_research: {
          current: orgData?.current_deep_research_usage || 0,
          limit: limits.deep_research_limit,
          week_start: orgData?.deep_research_week_start || null
        },
        pre_lander: {
          current: orgData?.current_pre_lander_usage || 0,
          limit: limits.pre_lander_limit,
          week_start: orgData?.pre_lander_week_start || null
        },
        static_ads: {
          current: orgData?.current_static_ads_usage || 0,
          limit: limits.static_ads_limit,
          week_start: orgData?.static_ads_week_start || null
        }
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT update admin bonus credits for an organization
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const organizationId = params.id
    const body = await request.json()
    const { admin_bonus_credits } = body

    if (admin_bonus_credits !== undefined) {
      if (typeof admin_bonus_credits !== 'number' || admin_bonus_credits < 0) {
        return createValidationErrorResponse('admin_bonus_credits must be a non-negative integer')
      }
    }

    const updatedCredits = await updateAdminBonusCredits(organizationId, admin_bonus_credits)

    return NextResponse.json({
      success: true,
      admin_bonus_credits: updatedCredits
    })
  } catch (error) {
    return handleApiError(error)
  }
}
