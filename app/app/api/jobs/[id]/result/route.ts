import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    
    console.log(`🔍 Fetching DeepCopy result for job: ${jobId}`)
    
    // Get job details
    const jobResult = await query(`
      SELECT id, execution_id, status
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (jobResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    const job = jobResult.rows[0]
    console.log(`📊 Job details:`, job)
    
    // Get result from DeepCopy API
    const result = await deepCopyClient.getJobResult(jobId)
    console.log(`📊 DeepCopy result received, keys:`, Object.keys(result))
    
    // Store the result in database
    await query(`
      UPDATE jobs 
      SET result = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(result), jobId])
    
    console.log(`✅ Result stored for job ${jobId}`)
    
    return NextResponse.json({
      jobId,
      status: job.status,
      result,
      stored: true
    })
    
  } catch (error) {
    console.error('❌ Result Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch result', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
