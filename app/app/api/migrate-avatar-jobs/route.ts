import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting migration: Add avatar job support...')
    
    // Add new columns to jobs table
    console.log('📝 Adding parent_job_id column...')
    await query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS parent_job_id TEXT 
      REFERENCES jobs(id) ON DELETE CASCADE
    `)
    
    console.log('📝 Adding avatar_persona_name column...')
    await query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS avatar_persona_name TEXT
    `)
    
    console.log('📝 Adding is_avatar_job column...')
    await query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS is_avatar_job BOOLEAN DEFAULT FALSE
    `)
    
    // Create index for faster queries
    console.log('📝 Creating indexes...')
    await query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id 
      ON jobs(parent_job_id) 
      WHERE parent_job_id IS NOT NULL
    `)
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_avatar_persona 
      ON jobs(avatar_persona_name) 
      WHERE avatar_persona_name IS NOT NULL
    `)
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_is_avatar_job 
      ON jobs(is_avatar_job) 
      WHERE is_avatar_job = TRUE
    `)
    
    console.log('✅ Migration completed successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

