import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { generateScreenshot } from '@/lib/utils/screenshot'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Check if screenshot exists in DB
    const jobResult = await query('SELECT screenshot, sales_page_url FROM jobs WHERE id = $1', [jobId])
    
    if (jobResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobResult.rows[0]

    // Return existing screenshot if available
    if (job.screenshot) {
      return NextResponse.json({ screenshot: job.screenshot })
    }

    // Generate screenshot if URL exists
    if (!job.sales_page_url) {
      return NextResponse.json({ error: 'No sales page URL' }, { status: 400 })
    }

    // Generate and store screenshot
    await generateScreenshot(jobId, job.sales_page_url)

    // Fetch the newly generated screenshot
    const updatedResult = await query('SELECT screenshot FROM jobs WHERE id = $1', [jobId])
    const screenshot = updatedResult.rows[0]?.screenshot

    if (!screenshot) {
      return NextResponse.json({ error: 'Failed to generate screenshot' }, { status: 500 })
    }

    return NextResponse.json({ screenshot })
  } catch (error) {
    console.error('Screenshot error:', error)
    return NextResponse.json(
      { error: 'Failed to generate screenshot', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

