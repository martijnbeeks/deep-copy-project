import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting avatars column migration...')
    
    // First, add the avatars column if it doesn't exist
    try {
      await query(`
        ALTER TABLE jobs 
        ADD COLUMN IF NOT EXISTS avatars JSONB DEFAULT '[]'::jsonb
      `)
      console.log('✅ Added avatars column')
    } catch (err: any) {
      // If column already exists, that's fine
      if (!err.message?.includes('already exists')) {
        throw err
      }
      console.log('ℹ️  Avatars column already exists')
    }
    
    // Check if old columns exist before trying to drop them
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
        AND column_name IN ('customer_avatars', 'persona', 'age_range', 'gender')
    `)
    
    const columnsToDrop = columnCheck.rows.map((row: any) => row.column_name)
    
    if (columnsToDrop.length > 0) {
      console.log(`📋 Found columns to drop: ${columnsToDrop.join(', ')}`)
      
      // Drop old columns one by one to avoid errors
      for (const column of columnsToDrop) {
        try {
          await query(`ALTER TABLE jobs DROP COLUMN IF EXISTS ${column}`)
          console.log(`✅ Dropped column: ${column}`)
        } catch (err) {
          console.error(`⚠️  Error dropping column ${column}:`, err)
        }
      }
    } else {
      console.log('ℹ️  No old columns to drop')
    }
    
    // Try to migrate existing data if customer_avatars column still exists
    try {
      const existingJobs = await query(`
        SELECT id, customer_avatars 
        FROM jobs 
        WHERE customer_avatars IS NOT NULL 
          AND (avatars IS NULL OR avatars = '[]'::jsonb)
        LIMIT 1000
      `)
      
      if (existingJobs.rows.length > 0) {
        console.log(`📊 Migrating ${existingJobs.rows.length} existing jobs...`)
        
        for (const job of existingJobs.rows) {
          try {
            // Parse customer_avatars and mark them as researched
            const customerAvatars = typeof job.customer_avatars === 'string' 
              ? JSON.parse(job.customer_avatars) 
              : job.customer_avatars || []
            
            // Mark all existing customer_avatars as researched
            const migratedAvatars = Array.isArray(customerAvatars)
              ? customerAvatars.map((avatar: any) => ({
                  ...avatar,
                  is_researched: true
                }))
              : []
            
            await query(
              `UPDATE jobs SET avatars = $1 WHERE id = $2`,
              [JSON.stringify(migratedAvatars), job.id]
            )
          } catch (err) {
            console.error(`❌ Error migrating job ${job.id}:`, err)
          }
        }
        
        console.log('✅ Data migration complete')
      } else {
        console.log('ℹ️  No existing data to migrate')
      }
    } catch (err: any) {
      // If customer_avatars column doesn't exist, that's fine
      if (err.message?.includes('does not exist') || err.message?.includes('column')) {
        console.log('ℹ️  customer_avatars column does not exist, skipping data migration')
      } else {
        throw err
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Avatars column migration completed successfully'
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

