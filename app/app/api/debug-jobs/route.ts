import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging all jobs with DeepCopy execution IDs...')
    
    // Get all jobs that have DeepCopy execution IDs
    const result = await query(`
      SELECT id, title, status, execution_id, created_at, updated_at 
      FROM jobs 
      WHERE execution_id IS NOT NULL
      AND execution_id LIKE 'deepcopy_%'
      ORDER BY updated_at DESC
    `)
    
    const jobs = result.rows
    console.log(`Found ${jobs.length} jobs with DeepCopy execution IDs`)
    
    return NextResponse.json({
      success: true,
      total: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        title: job.title,
        status: job.status,
        execution_id: job.execution_id,
        deepcopy_job_id: job.execution_id.replace('deepcopy_', ''),
        created_at: job.created_at,
        updated_at: job.updated_at
      }))
    })
    
  } catch (error) {
    console.error('Error debugging jobs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
