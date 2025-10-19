import { NextRequest, NextResponse } from 'next/server'
import { deepCopyClient } from '@/lib/api/deepcopy-client'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Server-side polling: Starting...')
    
    // Get all jobs that need polling (submitted, pending, processing, running)
    const jobs = await query(`
      SELECT id, status, progress, updated_at
      FROM jobs 
      WHERE UPPER(status) IN ('SUBMITTED', 'PENDING', 'PROCESSING', 'RUNNING')
      ORDER BY updated_at DESC
    `)
    
    console.log(`📊 Found ${jobs.rows.length} processing jobs to poll`)
    
    if (jobs.rows.length === 0) {
      return NextResponse.json({ message: 'No processing jobs found' })
    }
    
    const results = []
    
    for (const job of jobs.rows) {
      try {
        console.log(`🔍 Polling job ${job.id}...`)
        
        // Poll DeepCopy API
        const data = await deepCopyClient.getJobStatus(job.id)
        console.log(`📊 Job ${job.id}: ${data.status}${data.progress ? ` (${data.progress}%)` : ''}`)
        
        // Map DeepCopy status to our database status
        let mappedStatus = data.status
        if (data.status === 'RUNNING') {
          mappedStatus = 'PROCESSING'
        } else if (data.status === 'SUCCEEDED') {
          mappedStatus = 'COMPLETED'
        }
        
        // Update job status in database
        await query(`
          UPDATE jobs 
          SET status = $1, progress = $2, updated_at = NOW()
          WHERE id = $3
        `, [mappedStatus, data.progress || 0, job.id])
        
        console.log(`✅ Updated job ${job.id} status from ${job.status} to ${data.status}`)
        
        results.push({
          jobId: job.id,
          status: data.status,
          progress: data.progress || 0,
          updated: true
        })
        
        // If job completed, trigger result processing
        if (mappedStatus === 'COMPLETED') {
          console.log(`✅ Job ${job.id} completed, triggering result processing...`)
          
          // Call the status endpoint to process results
          try {
            const statusResponse = await fetch(`${request.nextUrl.origin}/api/jobs/${job.id}/status`, {
              method: 'GET',
              headers: {
                'Authorization': request.headers.get('authorization') || '',
                'Content-Type': 'application/json'
              }
            })
            
            if (statusResponse.ok) {
              console.log(`✅ Result processing triggered for job ${job.id}`)
            } else {
              console.error(`❌ Failed to trigger result processing for job ${job.id}`)
            }
          } catch (error) {
            console.error(`❌ Error triggering result processing for job ${job.id}:`, error)
          }
        }
        
      } catch (error) {
        console.error(`❌ Error polling job ${job.id}:`, error)
        results.push({
          jobId: job.id,
          error: error.message,
          updated: false
        })
      }
    }
    
    console.log(`✅ Server-side polling completed: ${results.filter(r => r.updated).length}/${results.length} jobs updated`)
    
    return NextResponse.json({
      message: 'Polling completed',
      results,
      updated: results.filter(r => r.updated).length,
      total: results.length
    })
    
  } catch (error) {
    console.error('❌ Server-side polling error:', error)
    return NextResponse.json(
      { error: 'Polling failed', details: error.message },
      { status: 500 }
    )
  }
}
