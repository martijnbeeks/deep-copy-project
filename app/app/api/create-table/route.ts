import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('Creating injected_templates table...')
    
    // Create injected_templates table
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
    
    console.log('✅ injected_templates table created successfully')
    
    return NextResponse.json({
      success: true,
      message: 'injected_templates table created successfully'
    })
  } catch (error) {
    console.error('Table creation failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Table creation failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
