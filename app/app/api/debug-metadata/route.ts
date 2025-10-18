import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job to debug metadata structure
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type, j.status,
             r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      LIMIT 1
    `)
    
    if (jobs.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No completed jobs found',
        jobs: []
      })
    }
    
    const job = jobs.rows[0]
    
    // Parse the metadata to see its structure
    let metadataStructure = {}
    try {
      metadataStructure = typeof job.metadata === 'string' 
        ? JSON.parse(job.metadata) 
        : job.metadata
    } catch (e) {
      metadataStructure = { error: 'Failed to parse metadata', raw: job.metadata }
    }
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type,
        metadataType: typeof job.metadata,
        metadataStructure
      }
    })
    
  } catch (error) {
    console.error('Debug failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Debug failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
