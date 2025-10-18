import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing migration data...')
    
    // Get completed jobs with results
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type, j.status,
             r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      ORDER BY j.created_at DESC
      LIMIT 5
    `)
    
    // Get injectable templates
    const injectableTemplates = await query(`
      SELECT id, name, type FROM injectable_templates ORDER BY created_at DESC
    `)
    
    // Check existing injected templates
    const existingInjectedTemplates = await query(`
      SELECT COUNT(*) as count FROM injected_templates
    `)
    
    const analysis = {
      completedJobs: jobs.rows.length,
      injectableTemplates: injectableTemplates.rows.length,
      existingInjectedTemplates: parseInt(existingInjectedTemplates.rows[0].count),
      sampleJobs: jobs.rows.map(job => ({
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type,
        hasMetadata: !!job.metadata,
        anglesCount: job.metadata?.angles?.length || 0,
        angles: job.metadata?.angles || []
      })),
      injectableTemplates: injectableTemplates.rows.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type
      }))
    }
    
    console.log('📊 Migration Test Analysis:', analysis)
    
    return NextResponse.json({
      success: true,
      message: 'Migration test completed',
      analysis
    })
    
  } catch (error) {
    console.error('❌ Migration test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration test failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
