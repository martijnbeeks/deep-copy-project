import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job to debug step by step
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
    
    // Parse the metadata
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
    
    // Check for angles and swipe_results
    const angles = metadata.angles || 
                  metadata.full_result?.results?.angles || 
                  metadata.full_result?.angles ||
                  []
    const swipeResults = metadata.swipe_results || 
                        metadata.full_result?.results?.swipe_results || 
                        metadata.full_result?.swipe_results ||
                        []
    
    // Check injectable templates
    const injectableTemplates = await query(`
      SELECT id, name, advertorial_type FROM injectable_templates
    `)
    
    // Try to find matching template
    let matchingTemplate = null
    if (job.template_id) {
      const exactMatch = injectableTemplates.rows.find(t => t.id === job.template_id)
      if (exactMatch) {
        matchingTemplate = exactMatch
      }
    }
    
    if (!matchingTemplate) {
      const typeMatch = injectableTemplates.rows.find(t => t.advertorial_type === job.advertorial_type)
      if (typeMatch) {
        matchingTemplate = typeMatch
      }
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
        hasAngles: angles.length > 0,
        anglesCount: angles.length,
        angles: angles.slice(0, 3),
        hasSwipeResults: swipeResults.length > 0,
        swipeResultsCount: swipeResults.length,
        swipeResults: swipeResults.slice(0, 1) // First swipe result
      },
      injectableTemplates: injectableTemplates.rows,
      matchingTemplate,
      debug: {
        metadataKeys: Object.keys(metadata),
        hasFullResult: !!metadata.full_result,
        fullResultKeys: metadata.full_result ? Object.keys(metadata.full_result) : [],
        hasResults: !!metadata.full_result?.results,
        resultsKeys: metadata.full_result?.results ? Object.keys(metadata.full_result.results) : []
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
