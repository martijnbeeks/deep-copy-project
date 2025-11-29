import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'
import { 
  getOrganizationUsageLimits, 
  setOrganizationUsageLimits, 
  resetOrganizationUsage,
  getAllOrganizationsWithLimits 
} from '@/lib/db/queries'
import { handleApiError, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { UsageType } from '@/lib/db/types'

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

    // Get current usage from the all organizations query
    const allOrgs = await getAllOrganizationsWithLimits()
    const orgData = allOrgs.find(org => org.organization_id === organizationId)

    return NextResponse.json({
      organization_id: organizationId,
      limits: {
        deep_research_limit: limits.deep_research_limit,
        pre_lander_limit: limits.pre_lander_limit
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
        }
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT update limits for an organization
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
    const { deep_research_limit, pre_lander_limit } = body

    // Validate limits
    if (deep_research_limit !== undefined && (typeof deep_research_limit !== 'number' || deep_research_limit < 0)) {
      return createValidationErrorResponse('deep_research_limit must be a non-negative integer')
    }

    if (pre_lander_limit !== undefined && (typeof pre_lander_limit !== 'number' || pre_lander_limit < 0)) {
      return createValidationErrorResponse('pre_lander_limit must be a non-negative integer')
    }

    const updatedLimits = await setOrganizationUsageLimits(organizationId, {
      deep_research_limit,
      pre_lander_limit
    })

    return NextResponse.json({
      success: true,
      limits: updatedLimits
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST reset usage for an organization
export async function POST(
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
    const { usage_type } = body

    // Validate usage_type if provided
    if (usage_type && usage_type !== 'deep_research' && usage_type !== 'pre_lander') {
      return createValidationErrorResponse('usage_type must be "deep_research" or "pre_lander"')
    }

    await resetOrganizationUsage(organizationId, usage_type as UsageType | undefined)

    return NextResponse.json({
      success: true,
      message: usage_type 
        ? `Usage reset for ${usage_type}` 
        : 'All usage reset for organization'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

