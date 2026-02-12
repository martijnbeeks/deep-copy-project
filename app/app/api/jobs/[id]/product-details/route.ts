import { NextRequest, NextResponse } from 'next/server'
import { getJobById } from '@/lib/db/queries'
import { getEditableProductDetails, updateEditableProductDetails } from '@/lib/db/queries'
import { EditableProductDetails } from '@/lib/db/types'

export async function GET(
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

    // Get editable product details
    const editableDetails = await getEditableProductDetails(jobId)

    return NextResponse.json({ 
      editableProductDetails: editableDetails,
      originalProductDetails: job.result?.metadata?.results?.offer_brief?.product || null
    })
  } catch (error) {
    console.error('Error fetching product details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    const body = await request.json()
    
    // Verify job exists and user has access
    const job = await getJobById(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Validate the request body
    const productDetails: EditableProductDetails = body.productDetails
    if (!productDetails) {
      return NextResponse.json({ error: 'Product details are required' }, { status: 400 })
    }

    // Update editable product details
    const success = await updateEditableProductDetails(jobId, productDetails)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update product details' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Product details updated successfully',
      editableProductDetails: { ...productDetails, updated_at: new Date().toISOString() }
    })
  } catch (error) {
    console.error('Error updating product details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
