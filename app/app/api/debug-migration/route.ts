import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job to debug
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
    
    // Check injectable templates
    const injectableTemplates = await query(`
      SELECT id, name, advertorial_type FROM injectable_templates
    `)
    
    // Check if we have angles in metadata
    const apiResult = job.metadata
    const hasAngles = apiResult.angles && Array.isArray(apiResult.angles)
    const anglesCount = hasAngles ? apiResult.angles.length : 0
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type,
        hasMetadata: !!job.metadata,
        hasAngles,
        anglesCount,
        angles: apiResult.angles || []
      },
      injectableTemplates: injectableTemplates.rows,
      totalJobs: jobs.rows.length
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
