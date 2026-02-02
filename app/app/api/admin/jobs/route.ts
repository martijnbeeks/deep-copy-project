import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { verifyAdminAuth, createAuthResponse } from '@/lib/auth/admin-auth'

// GET all jobs with template information
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const jobs = await query(`
      SELECT 
        j.id,
        j.title,
        j.status,
        j.created_at,
        u.email as user_email,
        t.name as template_name,
        t.id as template_id
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN templates t ON j.template_id = t.id
      ORDER BY j.created_at DESC
    `)
    
    return NextResponse.json({ jobs: jobs.rows })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

// DELETE a job
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth(request)
  if (authResult.error) {
    return createAuthResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('id')
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Delete related results first (if any)
    await query('DELETE FROM results WHERE job_id = $1', [jobId])
    
    // Delete the job
    const result = await query('DELETE FROM jobs WHERE id = $1', [jobId])
    
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
