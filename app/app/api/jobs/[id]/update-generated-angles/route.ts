import { NextRequest, NextResponse } from 'next/server'
import { updateJobResult } from '@/lib/db/queries'
import { query } from '@/lib/db/connection'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const body = await request.json()
    const { generatedAngles, swipeResults } = body

    // Get the current result metadata
    const resultQuery = await query(
      `SELECT metadata FROM results WHERE job_id = $1`,
      [jobId]
    )

    if (resultQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    const currentMetadata = resultQuery.rows[0].metadata || {}
    const currentFullResult = currentMetadata.full_result || {}
    
    // Update the full_result with new swipe_results
    const updatedFullResult = {
      ...currentFullResult,
      results: {
        ...currentFullResult.results,
        swipe_results: swipeResults || currentFullResult.results?.swipe_results || []
      }
    }

    // Store generated angles in metadata
    const updatedMetadata = {
      ...currentMetadata,
      full_result: updatedFullResult,
      generated_angles: Array.from(generatedAngles || [])
    }

    // Update the result metadata
    const updated = await updateJobResult(jobId, {
      metadata: updatedMetadata
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      generatedAngles: Array.from(generatedAngles || []),
      swipeResults: swipeResults || []
    })

  } catch (error) {
    console.error('Error updating generated angles:', error)
    return NextResponse.json(
      { error: 'Failed to update generated angles', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

