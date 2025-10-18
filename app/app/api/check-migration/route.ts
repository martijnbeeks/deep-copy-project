import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking migration readiness...')
    
    // Create injected_templates table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS injected_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        angle_index INTEGER NOT NULL,
        angle_name VARCHAR(255) NOT NULL,
        html_content TEXT NOT NULL,
        template_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Get completed jobs with results
    const jobs = await query(`
      SELECT j.id, j.title, j.template_id, j.advertorial_type, j.status,
             r.metadata
      FROM jobs j
      LEFT JOIN results r ON j.id = r.job_id
      WHERE j.status = 'completed' AND r.metadata IS NOT NULL
      ORDER BY j.created_at DESC
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
      jobs: jobs.rows.map(job => ({
        id: job.id,
        title: job.title,
        template_id: job.template_id,
        advertorial_type: job.advertorial_type,
        hasMetadata: !!job.metadata,
        anglesCount: job.metadata?.angles?.length || 0
      })),
      injectableTemplates: injectableTemplates.rows.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type
      }))
    }
    
    console.log('📊 Migration Analysis:', analysis)
    
    return NextResponse.json({
      success: true,
      message: 'Migration readiness check completed',
      analysis
    })
    
  } catch (error) {
    console.error('❌ Migration check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
