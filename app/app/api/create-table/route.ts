import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('Creating tables...')

    // Create templates table with TEXT ID
    await query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        html_content TEXT NOT NULL,
        category VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('✅ templates table created successfully')

    // Create injectable_templates table with TEXT ID
    await query(`
      CREATE TABLE IF NOT EXISTS injectable_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR(255) NOT NULL,
        advertorial_type VARCHAR(50) NOT NULL CHECK (advertorial_type IN ('listicle', 'advertorial')),
        html_content TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('✅ injectable_templates table created successfully')

    // Create injected_templates table
    await query(`
      CREATE TABLE IF NOT EXISTS injected_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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
      message: 'All tables created successfully'
    })
  } catch (error) {
    console.error('Table creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Table creation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
