/**
 * Shared pre-lander (swipe file) generation logic.
 * Used by both "Explore More Templates" and Angle Modal → Generate flows
 * so credit handling, 402 overage, and retry behavior are identical.
 */

import { internalApiClient } from '@/lib/clients/internal-client'

const OVERAGE_CODE = 'JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED'

function getJobIdFromResponse(response: any): string | null {
  return (
    response?.jobId ??
    response?.job_id ??
    response?.data?.jobId ??
    response?.data?.job_id ??
    response?.id ??
    response?.execution_id ??
    response?.data?.id ??
    response?.data?.execution_id ??
    null
  )
}

export interface SubmitPreLanderOptions {
  original_job_id: string
  avatar_id: string
  angle_id: string
  swipe_file_ids?: string[]
  /** Toast function for overage message (same signature as useToast().toast) */
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void
}

export interface SubmitPreLanderResult {
  jobId: string
}

/**
 * Submits pre-lander generation: calls API, handles 402 overage (toast + retry with allowOverage).
 * Caller is responsible for polling and state (generatingAngles, etc.).
 */
export async function submitPreLanderGeneration(
  options: SubmitPreLanderOptions
): Promise<SubmitPreLanderResult> {
  const { original_job_id, avatar_id, angle_id, swipe_file_ids, toast } = options

  const payload = {
    original_job_id,
    avatar_id,
    angle_id,
    ...(swipe_file_ids && swipe_file_ids.length > 0 && { swipe_file_ids }),
  }

  try {
    const response = (await internalApiClient.generateSwipeFiles(payload)) as any
    const jobId = getJobIdFromResponse(response)
    if (!jobId) {
      throw new Error('Failed to start generation. No job ID received.')
    }
    return { jobId }
  } catch (error: any) {
    if (error.status === 402 && error.code === OVERAGE_CODE) {
      const overageCredits = error.overageCredits ?? 0
      toast({
        title: 'Overage Charges Apply',
        description: `This job requires ${overageCredits} extra credit${overageCredits === 1 ? '' : 's'}. Overage charges will be added to your next invoice.`,
        variant: 'default',
      })

      const retryResponse = (await internalApiClient.generateSwipeFiles({
        ...payload,
        swipe_file_ids: swipe_file_ids ?? undefined,
        allowOverage: true,
      })) as any

      const jobId = getJobIdFromResponse(retryResponse)
      if (!jobId) {
        throw new Error(retryResponse?.message ?? 'Failed to start generation after overage confirmation.')
      }
      return { jobId }
    }
    throw error
  }
}
