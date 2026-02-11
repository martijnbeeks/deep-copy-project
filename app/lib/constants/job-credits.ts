import type { UsageType } from '@/lib/db/types'

export interface FeaturePricing {
  name: string
  description: string
  cost: number
  unit: string
}

/** Credits per job type (single source of truth for enforcement + billing). */
export const JOB_CREDITS_BY_TYPE: Record<UsageType, number> = {
  deep_research: 10,
  pre_lander: 2,
  static_ads: 1,
  templates_images: 1,
}

/** Feature display information derived from JOB_CREDITS_BY_TYPE. */
export const FEATURE_DISPLAY_INFO: Record<UsageType, { name: string; description: string; unit: string }> = {
  deep_research: {
    name: "Deep Research",
    description: "AI-powered research tasks",
    unit: "credits per task"
  },
  pre_lander: {
    name: "Pre Lander", 
    description: "Landing page content",
    unit: "credits per page"
  },
  static_ads: {
    name: "Static Ads",
    description: "Advertisement creatives", 
    unit: "credit per ad"
  },
  templates_images: {
    name: "Advetorial Image",
    description: "Template generation",
    unit: "credits per template"
  }
}

/** Job credit limit by plan (enforcement). Free tier uses organization_usage_limits.job_credits_limit. */
export const JOB_CREDIT_LIMIT_BY_PLAN: Record<string, number> = {
  free: 19,
  starter: 120,
  business: 400,
  'scale-up': 900,
}

export function getJobCreditLimitByPlanId(planId: string | null): number {
  if (!planId) return JOB_CREDIT_LIMIT_BY_PLAN.free
  return JOB_CREDIT_LIMIT_BY_PLAN[planId] ?? JOB_CREDIT_LIMIT_BY_PLAN.free
}

export function getFeaturePricing(jobType: UsageType): FeaturePricing {
  return {
    ...FEATURE_DISPLAY_INFO[jobType],
    cost: JOB_CREDITS_BY_TYPE[jobType]
  }
}

export function getAllFeaturePricing(): FeaturePricing[] {
  return Object.entries(JOB_CREDITS_BY_TYPE).map(([jobType, cost]) => ({
    ...FEATURE_DISPLAY_INFO[jobType as UsageType],
    cost
  }))
}
