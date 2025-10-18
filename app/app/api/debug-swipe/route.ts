import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job
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
        message: 'No completed jobs found'
      })
    }
    
    const job = jobs.rows[0]
    
    // Parse metadata
    let metadata = {}
    try {
      metadata = typeof job.metadata === 'string' 
        ? JSON.parse(job.metadata) 
        : job.metadata
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse metadata'
      })
    }
    
    // Get the results object
    const results = metadata.full_result?.results || {}
    
    // Check specifically for swipe_results
    const swipeResults = results.swipe_results || []
    
    // Check if swipe_results contains angles
    let angles = []
    if (Array.isArray(swipeResults) && swipeResults.length > 0) {
      // Check if each swipe result has an angle property
      angles = swipeResults.map((swipe, index) => {
        if (swipe && typeof swipe === 'object') {
          return swipe.angle || swipe.angle_name || `Angle ${index + 1}`
        }
        return `Angle ${index + 1}`
      })
    }
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type
      },
      swipeResults: {
        count: swipeResults.length,
        isArray: Array.isArray(swipeResults),
        firstItem: swipeResults[0] || null,
        firstItemKeys: swipeResults[0] ? Object.keys(swipeResults[0]) : []
      },
      angles: {
        count: angles.length,
        angles: angles.slice(0, 3)
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
