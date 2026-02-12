import { NextRequest, NextResponse } from 'next/server'
import { getJobById } from '@/lib/db/queries'
import { confirmEditableProductDetails } from '@/lib/db/queries'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Verify job exists and user has access
    const job = await getJobById(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Confirm editable product details
    const success = await confirmEditableProductDetails(jobId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to confirm product details' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Product details confirmed successfully',
      confirmed: true
    })
  } catch (error) {
    console.error('Error confirming product details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
