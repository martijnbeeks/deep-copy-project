import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/clients/deepcopy-client'
import { updateJobStatus, createResult, updateJobScreenshot, populateEditableProductDetailsFromV2 } from '@/lib/db/queries'
import { transformV2ToExistingSchema } from '@/lib/utils/v2-data-transformer'
import { isDevMode } from '@/lib/utils/env'
import { logger } from '@/lib/utils/logger'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''

function verifySignature(payload: Buffer, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    logger.error('WEBHOOK_SECRET not configured')
    return false
  }
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const signatureBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== signatureBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(expectedBuf, signatureBuf)
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer())
    const signature = request.headers.get('x-webhook-signature') || ''

    if (!signature || !verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody.toString('utf-8'))
    const { jobId, status } = body

    if (!jobId || !status) {
      return NextResponse.json({ error: 'Missing jobId or status' }, { status: 400 })
    }

    logger.log(`Webhook received: job=${jobId} status=${status}`)

    // Look up the job in our database by the DeepCopy job ID
    // The DeepCopy job ID is stored as both `id` (custom_id) and `execution_id`
    const jobResult = await query(
      `SELECT id, execution_id, target_approach, status as current_status
       FROM jobs
       WHERE id = $1 OR execution_id = $1
       LIMIT 1`,
      [jobId],
    )

    if (jobResult.rows.length === 0) {
      logger.error(`Webhook: job ${jobId} not found in database`)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobResult.rows[0]
    const localJobId = job.id
    const deepCopyJobId = job.execution_id || localJobId

    // Skip if already in a terminal state
    if (job.current_status === 'completed' || job.current_status === 'failed') {
      logger.log(`Webhook: job ${localJobId} already ${job.current_status}, skipping`)
      return NextResponse.json({ message: 'Already processed' })
    }

    if (status === 'completed') {
      try {
        // Fetch results from DeepCopy API
        const isV2 = job.target_approach === 'v2'
        const result = isV2
          ? await deepCopyClient.getV2Result(deepCopyJobId)
          : await deepCopyClient.getMarketingAngleResult(deepCopyJobId)

        // Store results based on job type
        if (isV2) {
          await storeV2Results(localJobId, result, deepCopyJobId)
        } else {
          const { storeJobResults } = await import('@/lib/utils/job-results')
          await storeJobResults(localJobId, result, deepCopyJobId)
        }

        await updateJobStatus(localJobId, 'completed', 100)

        // Record billing credit
        try {
          const userRow = await query('SELECT user_id FROM jobs WHERE id = $1', [localJobId])
          if (userRow.rows[0]) {
            const { recordJobCreditEvent } = await import('@/lib/services/billing')
            const { JOB_CREDITS_BY_TYPE } = await import('@/lib/constants/job-credits')
            const jobType = isV2 ? 'deep_research' : 'pre_lander'
            await recordJobCreditEvent({
              userId: userRow.rows[0].user_id,
              jobId: localJobId,
              jobType,
              credits: JOB_CREDITS_BY_TYPE[jobType],
            })
          }
        } catch (creditErr) {
          logger.error('Webhook: failed to record credit event:', creditErr)
        }

        logger.log(`Webhook: job ${localJobId} completed successfully`)
      } catch (resultErr) {
        // Don't mark as failed — the upstream job succeeded. Polling will retry result processing.
        logger.error(`Webhook: failed to fetch/store results for ${localJobId}:`, resultErr)
        return NextResponse.json(
          { error: 'Failed to process results' },
          { status: 500 },
        )
      }
    } else if (status === 'failed') {
      await updateJobStatus(localJobId, 'failed')
      logger.log(`Webhook: job ${localJobId} marked as failed`)
    } else {
      logger.log(`Webhook: ignoring status '${status}' for job ${localJobId}`)
    }

    return NextResponse.json({ message: 'OK' })
  } catch (error) {
    logger.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// Inline V2 result storage (mirrors logic from /api/jobs/route.ts)
async function storeV2Results(localJobId: string, result: any, deepCopyJobId: string) {
  const sanitizedResult = isDevMode() ? stripNulls(result) : result

  const transformedAvatars = transformV2ToExistingSchema(sanitizedResult)
  const sanitizedAvatars = isDevMode() ? stripNulls(transformedAvatars) : transformedAvatars

  const { updateJobAvatars } = await import('@/lib/db/queries')
  await updateJobAvatars(localJobId, sanitizedAvatars)

  const productImage = sanitizedResult?.results?.product_image || sanitizedResult?.product_image
  if (productImage && typeof productImage === 'string') {
    await updateJobScreenshot(localJobId, productImage)
  }

  await createResult(localJobId, '', {
    deepcopy_job_id: deepCopyJobId,
    full_result: sanitizedResult,
    project_name: sanitizedResult.project_name,
    timestamp_iso: sanitizedResult.timestamp_iso,
    job_id: sanitizedResult.job_id,
    api_version: sanitizedResult.api_version || 'v2',
    generated_at: new Date().toISOString(),
  })

  await populateEditableProductDetailsFromV2(localJobId, sanitizedResult)
}

function stripNulls(value: any): any {
  if (typeof value === 'string') return value.replace(/\u0000/g, '')
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripNulls(v)]))
  }
  return value
}
