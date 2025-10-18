import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Check injectable templates
    const injectableTemplates = await query('SELECT id, name, type FROM injectable_templates ORDER BY created_at DESC')
    
    // Check jobs
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type, j.status
      FROM jobs j
      WHERE j.status = 'completed'
      ORDER BY j.created_at DESC
    `)
    
    return NextResponse.json({
      success: true,
      injectableTemplates: injectableTemplates.rows,
      completedJobs: jobs.rows
    })
  } catch (error) {
    console.error('Check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
