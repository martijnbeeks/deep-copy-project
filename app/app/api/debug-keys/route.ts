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
    
    // Check all keys in results
    const resultKeys = Object.keys(results)
    
    // Look for any keys that might contain angles or swipe data
    const angleKeys = resultKeys.filter(key => 
      key.toLowerCase().includes('angle') || 
      key.toLowerCase().includes('swipe') ||
      key.toLowerCase().includes('template') ||
      key.toLowerCase().includes('content')
    )
    
    // Check the values of these keys
    const angleKeyValues = {}
    angleKeys.forEach(key => {
      const value = results[key]
      angleKeyValues[key] = {
        type: typeof value,
        isArray: Array.isArray(value),
        length: Array.isArray(value) ? value.length : undefined,
        sample: Array.isArray(value) && value.length > 0 ? value[0] : value
      }
    })
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type
      },
      results: {
        allKeys: resultKeys,
        angleKeys,
        angleKeyValues,
        totalKeys: resultKeys.length
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
