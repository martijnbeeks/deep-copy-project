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
    
    // Check if full_result exists and what it contains
    const hasFullResult = !!metadata.full_result
    const hasResults = !!metadata.full_result?.results
    
    let angles = []
    let swipeResults = []
    
    if (hasFullResult && hasResults) {
      angles = metadata.full_result.results.angles || []
      swipeResults = metadata.full_result.results.swipe_results || []
    }
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type
      },
      metadata: {
        hasFullResult,
        hasResults,
        anglesCount: angles.length,
        swipeResultsCount: swipeResults.length,
        angles: angles.slice(0, 2),
        swipeResults: swipeResults.slice(0, 1),
        fullResultKeys: hasFullResult ? Object.keys(metadata.full_result) : [],
        resultsKeys: hasResults ? Object.keys(metadata.full_result.results) : []
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
