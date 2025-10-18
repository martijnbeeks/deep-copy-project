import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job to check for angles
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
    
    // Parse the metadata to check for angles
    let metadata = {}
    try {
      metadata = typeof job.metadata === 'string' 
        ? JSON.parse(job.metadata) 
        : job.metadata
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse metadata',
        raw: job.metadata
      })
    }
    
    // Check for angles in different possible locations
    const angles = metadata.angles || 
                  metadata.results?.angles || 
                  metadata.full_result?.angles ||
                  metadata.full_result?.results?.angles ||
                  []
    
    const swipeResults = metadata.swipe_results || 
                        metadata.results?.swipe_results || 
                        metadata.full_result?.swipe_results ||
                        metadata.full_result?.results?.swipe_results ||
                        []
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type,
        hasAngles: angles.length > 0,
        anglesCount: angles.length,
        angles: angles.slice(0, 3), // First 3 angles
        hasSwipeResults: swipeResults.length > 0,
        swipeResultsCount: swipeResults.length,
        metadataKeys: Object.keys(metadata),
        resultsKeys: metadata.results ? Object.keys(metadata.results) : [],
        fullResultKeys: metadata.full_result ? Object.keys(metadata.full_result) : []
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
