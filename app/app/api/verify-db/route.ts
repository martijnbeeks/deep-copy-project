import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const issues: string[] = []
    const fixes: string[] = []

    // Check all required tables exist
    const requiredTables = ['users', 'templates', 'jobs', 'results', 'injectable_templates', 'admin_users']
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    const existingTables = tables.rows.map(row => row.table_name)
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))

    if (missingTables.length > 0) {
      issues.push(`Missing tables: ${missingTables.join(', ')}`)
    }

    // Check jobs table structure
    const jobsColumns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      ORDER BY ordinal_position
    `)
    
    const requiredJobColumns = ['id', 'user_id', 'title', 'brand_info', 'advertorial_type', 'status', 'progress', 'created_at', 'updated_at']
    const existingJobColumns = jobsColumns.rows.map(col => col.column_name)
    const missingJobColumns = requiredJobColumns.filter(col => !existingJobColumns.includes(col))

    if (missingJobColumns.length > 0) {
      issues.push(`Jobs table missing columns: ${missingJobColumns.join(', ')}`)
    }

    // Check if completed_at exists, if not, suggest adding it
    if (!existingJobColumns.includes('completed_at')) {
      fixes.push('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP')
    }

    // Check results table structure
    const resultsColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'results' 
      ORDER BY ordinal_position
    `).catch(() => ({ rows: [] }))

    if (resultsColumns.rows.length === 0 && existingTables.includes('results')) {
      issues.push('Results table exists but has no columns')
    }

    // Check injectable_templates table structure
    const injectableColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'injectable_templates' 
      ORDER BY ordinal_position
    `).catch(() => ({ rows: [] }))

    if (injectableColumns.rows.length === 0 && existingTables.includes('injectable_templates')) {
      issues.push('Injectable_templates table exists but has no columns')
    }

    // Check for indexes
    const indexes = await query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `)

    // Check foreign key constraints
    const foreignKeys = await query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
    `)

    return NextResponse.json({
      success: issues.length === 0,
      status: issues.length === 0 ? 'healthy' : 'needs_attention',
      tables: {
        existing: existingTables,
        required: requiredTables,
        missing: missingTables
      },
      jobs: {
        columns: jobsColumns.rows,
        missingColumns: missingJobColumns
      },
      indexes: indexes.rows,
      foreignKeys: foreignKeys.rows,
      issues,
      suggestedFixes: fixes,
      summary: {
        totalTables: existingTables.length,
        requiredTables: requiredTables.length,
        missingTables: missingTables.length,
        totalIssues: issues.length
      }
    })

  } catch (error: any) {
    console.error('Database verification failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database verification failed', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

