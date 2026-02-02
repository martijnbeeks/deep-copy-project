import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { updateJobStatus } from '@/lib/db/queries'
import { storeJobResults } from '@/lib/utils/job-results'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    
    
    // Optional: Add authentication for admin access
    const authHeader = request.headers.get('authorization')
    if (process.env.ADMIN_SECRET && authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return createValidationErrorResponse('Unauthorized', 401)
    }

    const result = await query(`
      SELECT id, execution_id, status, updated_at 
      FROM jobs 
      WHERE status = 'processing'
      ORDER BY updated_at DESC
    `)
    
    const jobsToCheck = result.rows
    
    
    if (jobsToCheck.length === 0) {
      return createSuccessResponse({ 
        success: true, 
        message: 'No jobs need recovery',
        checked: 0,
        completed: 0,
        failed: 0
      })
    }
    
    let completed = 0
    let failed = 0
    let stillProcessing = 0
    
    // Process jobs in parallel (but limit concurrency)
    const batchSize = 3
    for (let i = 0; i < jobsToCheck.length; i += batchSize) {
      const batch = jobsToCheck.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(job => checkJobStatus(job))
      )
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const status = result.value
          if (status === 'completed') completed++
          else if (status === 'failed') failed++
          else stillProcessing++
        } else {
          failed++
          logger.error(`Failed to recover job ${batch[index].id}:`, result.reason)
        }
      })
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < jobsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    
    
    return createSuccessResponse({
      success: true,
      message: `Job recovery completed - Completed: ${completed}, Failed: ${failed}, Still Processing: ${stillProcessing}`,
      checked: jobsToCheck.length,
      completed,
      failed,
      stillProcessing
    })
    
  } catch (error) {
    return handleApiError(error)
  }
}

// Check and update a single job
async function checkJobStatus(job: { id: string; execution_id: string; status: string; updated_at: string }): Promise<string> {
  try {
    // Use the job ID directly as the DeepCopy job ID (since we now use DeepCopy job ID as primary key)
    const deepCopyJobId = job.id
    
    const statusResponse = await deepCopyClient.getMarketingAngleStatus(deepCopyJobId)
    
    
    if (statusResponse.status === 'SUCCEEDED') {
      // Marketing angle completed - get results and store them
      const result = await deepCopyClient.getMarketingAngleResult(deepCopyJobId)
      await storeJobResults(job.id, result, deepCopyJobId)
      await updateJobStatus(job.id, 'completed', 100)
      return 'completed'
      
    } else if (statusResponse.status === 'FAILED') {
      // Job failed
      await updateJobStatus(job.id, 'failed')
      
      return 'failed'
      
    } else if (['RUNNING', 'SUBMITTED', 'PENDING'].includes(statusResponse.status)) {
      // Job still processing - update progress and let it continue
      const progress = statusResponse.status === 'SUBMITTED' ? 25 : 
                     statusResponse.status === 'RUNNING' ? 50 : 30
      await updateJobStatus(job.id, 'processing', progress)
      return 'processing'
      
    } else {
      // Unknown status - mark as failed
      await updateJobStatus(job.id, 'failed')
      
      return 'failed'
    }
    
  } catch (error) {
    logger.error(`Error checking job ${job.id}:`, error)
    // If we can't check the status, mark as failed
    await updateJobStatus(job.id, 'failed')
    return 'failed'
  }
}
