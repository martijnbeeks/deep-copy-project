import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    // Check injected templates
    const injectedTemplates = await query(`
      SELECT 
        it.id,
        it.job_id,
        it.angle_index,
        it.angle_name,
        it.template_id,
        j.title as job_title,
        j.advertorial_type
      FROM injected_templates it
      LEFT JOIN jobs j ON it.job_id = j.id
      ORDER BY it.created_at DESC
      LIMIT 10
    `)
    
    // Get summary stats
    const stats = await query(`
      SELECT 
        COUNT(*) as total_templates,
        COUNT(DISTINCT job_id) as total_jobs,
        COUNT(DISTINCT template_id) as total_template_types
      FROM injected_templates
    `)
    
    // Get template usage stats
    const templateStats = await query(`
      SELECT 
        template_id,
        COUNT(*) as template_count,
        COUNT(DISTINCT job_id) as job_count
      FROM injected_templates 
      GROUP BY template_id
      ORDER BY template_count DESC
    `)
    
    return NextResponse.json({
      success: true,
      summary: stats.rows[0],
      templateStats: templateStats.rows,
      recentTemplates: injectedTemplates.rows
    })
    
  } catch (error) {
    console.error('Verification failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Verification failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
