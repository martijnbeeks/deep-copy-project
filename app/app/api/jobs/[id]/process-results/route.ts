import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    
    console.log(`🔧 Manually processing results for job: ${jobId}`)
    
    // Get job details
    const jobResult = await query(`
      SELECT id, execution_id, status, template_id, advertorial_type, title
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (jobResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    const job = jobResult.rows[0]
    console.log(`📊 Job details:`, job)
    
    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Job is not completed' }, { status: 400 })
    }
    
    // Check if results already exist
    const existingResult = await query(`
      SELECT COUNT(*) as count
      FROM injected_templates 
      WHERE job_id = $1
    `, [jobId])
    
    const existingCount = parseInt(existingResult.rows[0].count)
    if (existingCount > 0) {
      return NextResponse.json({ 
        message: 'Results already exist', 
        count: existingCount 
      })
    }
    
    // Get result from DeepCopy API
    console.log(`🔍 Fetching result from DeepCopy API...`)
    const result = await deepCopyClient.getJobResult(jobId)
    console.log(`📊 DeepCopy result received, keys:`, Object.keys(result))
    
    // Store the result in database
    await query(`
      UPDATE jobs 
      SET result = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(result), jobId])
    
    console.log(`✅ Result stored for job ${jobId}`)
    
    // Call the status endpoint to trigger template generation
    const statusResponse = await fetch(`${request.nextUrl.origin}/api/jobs/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('authorization') || '',
        'Content-Type': 'application/json'
      }
    })
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json()
      console.log('📊 Status endpoint response:', statusData)
    } else {
      console.error('❌ Status endpoint failed:', statusResponse.status)
    }
    
    return NextResponse.json({
      jobId,
      status: job.status,
      resultStored: true,
      templateGeneration: templateResult,
      message: 'Results processed successfully'
    })
    
  } catch (error) {
    console.error('❌ Manual Processing Error:', error)
    return NextResponse.json(
      { error: 'Failed to process results', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
