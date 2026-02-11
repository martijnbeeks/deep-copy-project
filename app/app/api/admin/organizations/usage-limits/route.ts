import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import {
  getAllOrganizationsWithLimits,
  getCurrentBillingPeriodForOrganization,
  getUsedCreditsInPeriod,
  getPlanCredits,
  getAdminBonusCredits,
  getTotalAvailableCredits,
  getRemainingCredits
} from '@/lib/db/queries'
import { handleApiError } from '@/lib/middleware/error-handler'

// GET all organizations with their usage limits and current usage
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const list = await getAllOrganizationsWithLimits()
    const organizations = await Promise.all(
      list.map(async (org) => {
        const period = await getCurrentBillingPeriodForOrganization(org.organization_id)
        const used = await getUsedCreditsInPeriod(org.organization_id, period.start)

        const [planCredits, adminBonusCredits, totalAvailable, remainingCredits] = await Promise.all([
          getPlanCredits(org.organization_id),
          getAdminBonusCredits(org.organization_id),
          getTotalAvailableCredits(org.organization_id),
          getRemainingCredits(org.organization_id)
        ])

        return {
          organization_id: org.organization_id,
          organization: org.organization,
          credits: {
            plan_credits: planCredits,
            admin_bonus_credits: adminBonusCredits,
            total_available: totalAvailable,
            used,
            remaining: remainingCredits,
            billing_period_end: period.end.toISOString()
          },
          usage: {
            deep_research: {
              current: org.current_deep_research_usage || 0,
              limit: org.deep_research_limit,
              week_start: org.deep_research_week_start || null
            },
            pre_lander: {
              current: org.current_pre_lander_usage || 0,
              limit: org.pre_lander_limit,
              week_start: org.pre_lander_week_start || null
            },
            static_ads: {
              current: org.current_static_ads_usage || 0,
              limit: org.static_ads_limit,
              week_start: org.static_ads_week_start || null
            },
            templates_images: {
              current: org.current_templates_images_usage || 0,
              limit: org.templates_images_limit,
              week_start: org.templates_images_week_start || null
            }
          }
        }
      })
    )
    return NextResponse.json({ organizations })
  } catch (error) {
    return handleApiError(error)
  }
}

