import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { getJobCreditEvents, getJobCreditEventsCount } from '@/lib/db/queries'
import { UsageType } from '@/lib/db/types'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return createAuthErrorResponse(authResult)
    }

    // Get user's organization
    const { query } = await import('@/lib/db/connection')
    const userOrgResult = await query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
      [authResult.user.id, 'approved']
    )

    if (userOrgResult.rows.length === 0) {
      return createValidationErrorResponse('User is not a member of any organization')
    }

    const organizationId = userOrgResult.rows[0].organization_id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const jobType = searchParams.get('jobType') as UsageType | null
    const isOverage = searchParams.get('isOverage') === 'true' ? true : searchParams.get('isOverage') === 'false' ? false : undefined
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return createValidationErrorResponse('Invalid pagination parameters')
    }

    if (jobType && !['deep_research', 'pre_lander', 'static_ads', 'templates_images'].includes(jobType)) {
      return createValidationErrorResponse('Invalid job type')
    }

    const offset = (page - 1) * limit

    // Fetch data
    const [events, totalCount] = await Promise.all([
      getJobCreditEvents(organizationId, {
        limit,
        offset,
        jobType: jobType || undefined,
        isOverage,
        startDate,
        endDate
      }),
      getJobCreditEventsCount(organizationId, {
        jobType: jobType || undefined,
        isOverage,
        startDate,
        endDate
      })
    ])

    // Format response
    const formattedEvents = events.map(event => ({
      id: event.id,
      jobId: event.job_id,
      userName: event.user_name || 'Unknown User',
      userEmail: event.user_email || 'unknown@example.com',
      credits: event.credits,
      jobType: event.job_type,
      isOverage: event.is_overage,
      status: event.status,
      createdAt: event.job_created_at || new Date().toISOString(),
      billingPeriodStart: event.billing_period_start
    }))

    console.log('Formatted events:', formattedEvents)

    return createSuccessResponse({
      events: formattedEvents,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error: any) {
    console.error('Usage breakdown API error:', error)
    
    // Provide more specific error messages for database issues
    if (error.code === '42883') {
      return createValidationErrorResponse('Database type mismatch error. Please contact support.')
    }
    
    return handleApiError(error)
  }
}
