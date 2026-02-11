import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/utils/logger'
import { query } from '@/lib/db/connection'

// Stripe overage price ID from environment
const OVERAGE_PRICE_ID = process.env.STRIPE_JOB_CREDITS_OVERAGE_PRICE_ID

export interface JobCreationLimitResult {
  canCreate: boolean
  reason?: string
  remaining?: number
  required?: number
  overageCredits?: number
  overageCostPerCredit?: number
  overageCostTotal?: number
  overageConfirmationRequired?: boolean
}

/**
 * Fetch overage unit price from Stripe using the price ID
 */
export async function getOverageUnitPrice(): Promise<number> {
  if (!OVERAGE_PRICE_ID) {
    throw new Error('STRIPE_JOB_CREDITS_OVERAGE_PRICE_ID environment variable is not set')
  }
  
  try {
    const price = await stripe.prices.retrieve(OVERAGE_PRICE_ID)
    if (!price.unit_amount) {
      throw new Error('Overage price does not have unit_amount defined')
    }
    // Convert from cents to EUR
    return price.unit_amount / 100
  } catch (error) {
    logger.error('Failed to fetch overage unit price from Stripe:', error)
    throw error
  }
}

/**
 * Reports job usage to Stripe for paid users (event-based; value = credits)
 */
export async function reportJobUsage({
  stripeCustomerId,
  jobId,
  credits,
  identifier,
}: {
  stripeCustomerId: string
  jobId: string
  credits: number
  identifier?: string
}) {
  const id = identifier ?? `job_${jobId}_v1`
  try {
    await stripe.billing.meterEvents.create({
      event_name: 'job_credits_used',
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: String(credits),
      },
      identifier: id,
    } as any)
    logger.info(`Usage reported to Stripe for job ${jobId}`, { customerId: stripeCustomerId, credits, identifier: id })
  } catch (error) {
    logger.error('Failed to report usage to Stripe:', error)
  }
}

/**
 * Checks if user can create a new job based on remaining credits
 * Uses simplified logic: remaining >= credits_required_for_job
 */
export async function checkJobCreationLimit(
  userId: string,
  jobType: 'deep_research' | 'pre_lander' | 'static_ads' | 'templates_images',
  requiredCreditsOverride?: number
): Promise<JobCreationLimitResult> {
  const {
    getRemainingCredits,
  } = await import('@/lib/db/queries')
  const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')

  // Get required credits for this job type
  const requiredCredits = requiredCreditsOverride ?? JOB_CREDITS_BY_TYPE[jobType]

  // Get overage unit price from Stripe
  let overageCostPerCredit = 0
  try {
    overageCostPerCredit = await getOverageUnitPrice()
  } catch (error) {
    logger.error('Failed to get overage unit price, defaulting to 0:', error)
  }

  // Get user's organization
  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [userId, 'approved']
  )
  if (userResult.rows.length === 0) {
    // User without organization has unlimited usage
    return {
      canCreate: true,
      remaining: Infinity,
      required: requiredCredits,
      overageConfirmationRequired: false,
      overageCredits: 0,
      overageCostPerCredit,
      overageCostTotal: 0,
    }
  }
  const organizationId = userResult.rows[0].organization_id

  // Get remaining credits
  const remainingCredits = await getRemainingCredits(organizationId)
  const effectiveRemainingCredits = Math.max(0, remainingCredits)

  // If remaining credits are insufficient, require explicit overage confirmation
  if (effectiveRemainingCredits < requiredCredits) {
    const overageCredits = requiredCredits - effectiveRemainingCredits
    const overageCostTotal = overageCredits * overageCostPerCredit

    return {
      canCreate: false,
      reason: `Insufficient credits. Required: ${requiredCredits}, Available: ${effectiveRemainingCredits}. Jobs are all-or-nothing - no partial execution.`,
      remaining: effectiveRemainingCredits,
      required: requiredCredits,
      overageCredits,
      overageCostPerCredit,
      overageCostTotal,
      overageConfirmationRequired: true,
    }
  }

  return {
    canCreate: true,
    remaining: effectiveRemainingCredits,
    required: requiredCredits,
    overageCredits: 0,
    overageCostPerCredit,
    overageCostTotal: 0,
    overageConfirmationRequired: false,
  }
}

/**
 * Record one job credit event on completion (event-based; idempotent by jobId).
 * Inserts into job_credit_events and optionally reports to Stripe for paid orgs.
 */
export async function recordJobCreditEvent(params: {
  userId: string
  jobId: string
  jobType: 'deep_research' | 'pre_lander' | 'static_ads' | 'templates_images'
  credits: number
}): Promise<void> {
  const {
    getCurrentBillingPeriodForOrganization,
    getUsedCreditsInPeriod,
    getPlanCredits,
    getAdminBonusCredits,
    insertJobCreditEvent,
    getSubscriptionByOrganizationId,
    getStripeCustomerId,
  } = await import('@/lib/db/queries')

  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [params.userId, 'approved']
  )
  if (userResult.rows.length === 0) return
  const organizationId = userResult.rows[0].organization_id

  const period = await getCurrentBillingPeriodForOrganization(organizationId)
  const [planCredits, adminBonusCredits, used] = await Promise.all([
    getPlanCredits(organizationId),
    getAdminBonusCredits(organizationId),
    getUsedCreditsInPeriod(organizationId, period.start)
  ])
  const totalAvailable = planCredits + adminBonusCredits
  const isOverage = used + params.credits > totalAvailable

  // Calculate overage credits to report to Stripe (only the portion exceeding plan limits)
  const remainingPlanCredits = Math.max(0, totalAvailable - used)
  const overageCreditsToReport = Math.max(0, params.credits - remainingPlanCredits)

  let subscriptionId: string | null = null
  const sub = await getSubscriptionByOrganizationId(organizationId)
  if (sub?.id) subscriptionId = sub.id

  // Record the full job credits internally for tracking
  await insertJobCreditEvent({
    organizationId,
    userId: params.userId,
    jobId: params.jobId,
    jobType: params.jobType,
    credits: params.credits, // Store full job credits internally
    billingPeriodStart: period.start,
    subscriptionId,
    isOverage,
    stripeMeterEventIdentifier: 'job_credits_used',
  })

  // Report only overage credits to Stripe
  const stripeCustomerId = await getStripeCustomerId(params.userId)
  if (stripeCustomerId && overageCreditsToReport > 0) {
    await reportJobUsage({
      stripeCustomerId,
      jobId: params.jobId,
      credits: overageCreditsToReport, // Send only overage credits to Stripe
      identifier: `job_${params.jobId}_v1`,
    })
  }
}
