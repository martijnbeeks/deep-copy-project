import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting database migration...')
    
    // Add completed_at column to jobs table if it doesn't exist
    await query(`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE
    `)
    
    console.log('Migration completed successfully')
    
    return NextResponse.json({
      status: 'success',
      message: 'Migration completed successfully'
    })
    
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
