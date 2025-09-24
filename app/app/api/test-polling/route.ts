import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }
    
    console.log(`🧪 Testing polling for job ${jobId}`)
    
    // Get job from database
    const result = await query(`
      SELECT id, execution_id, status 
      FROM jobs 
      WHERE id = $1
    `, [jobId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    const job = result.rows[0]
    
    if (!job.execution_id || !job.execution_id.startsWith('deepcopy_')) {
      return NextResponse.json({ error: 'No DeepCopy job ID found' }, { status: 400 })
    }
    
    const deepCopyJobId = job.execution_id.replace('deepcopy_', '')
    console.log(`📡 Testing DeepCopy API endpoint: https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/jobs/${deepCopyJobId}`)
    
    // Test the DeepCopy API call
    const statusResponse = await deepCopyClient.getJobStatus(deepCopyJobId)
    console.log(`📊 DeepCopy API response:`, statusResponse)
    
    return NextResponse.json({
      success: true,
      localJobId: jobId,
      deepCopyJobId: deepCopyJobId,
      status: statusResponse.status,
      endpoint: `https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/jobs/${deepCopyJobId}`,
      response: statusResponse
    })
    
  } catch (error) {
    console.error('Test polling error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
