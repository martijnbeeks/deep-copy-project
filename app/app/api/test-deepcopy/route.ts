import { NextRequest, NextResponse } from 'next/server'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

export async function GET(request: NextRequest) {
  try {
    // Test the DeepCopy API connection
    console.log('Testing DeepCopy API connection...')
    
    // Test job submission
    const testJob = await deepCopyClient.submitJob({
      sales_page_url: 'https://example.com',
      project_name: 'test-connection',
      swipe_file_id: 'L00005',
      advertorial_type: 'Listicle'
    })
    
    console.log('Test job submitted:', testJob)
    
    return NextResponse.json({
      success: true,
      message: 'DeepCopy API connection successful',
      testJob
    })
    
  } catch (error) {
    console.error('DeepCopy API test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    )
  }
}
