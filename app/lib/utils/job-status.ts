/**
 * Job status utilities
 */

/**
 * Check if a job status indicates the job is currently processing
 */
export function isProcessingStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase()
  return ['submitted', 'processing', 'running', 'pending'].includes(normalized || '')
}

/**
 * Check if a job status indicates the job is completed
 */
export function isCompletedStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase()
  return ['completed', 'succeeded'].includes(normalized || '')
}

/**
 * Check if a job status indicates the job has failed
 */
export function isFailedStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase()
  return ['failed', 'failure'].includes(normalized || '')
}

