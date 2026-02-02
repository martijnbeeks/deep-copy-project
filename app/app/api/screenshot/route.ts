import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const result = await query('SELECT screenshot FROM jobs WHERE id = $1', [jobId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const screenshot = result.rows[0]?.screenshot

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not available' }, { status: 404 })
    }

    return NextResponse.json({ screenshot })
  } catch (error) {
    console.error('Screenshot fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch screenshot', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

