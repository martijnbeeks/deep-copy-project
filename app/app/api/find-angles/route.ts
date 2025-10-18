import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Get one completed job to check metadata structure
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
    
    // Recursively search for angles and swipe_results
    function findKeys(obj, path = '') {
      const keys = []
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key
          if (key.toLowerCase().includes('angle') || key.toLowerCase().includes('swipe')) {
            keys.push({
              path: currentPath,
              key,
              type: typeof value,
              isArray: Array.isArray(value),
              length: Array.isArray(value) ? value.length : undefined
            })
          }
          if (typeof value === 'object' && value !== null) {
            keys.push(...findKeys(value, currentPath))
          }
        }
      }
      return keys
    }
    
    const foundKeys = findKeys(metadata)
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type
      },
      foundKeys,
      topLevelKeys: Object.keys(metadata)
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
