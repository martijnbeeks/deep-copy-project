import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.DEEPCOPY_CLIENT_ID
    const clientSecret = process.env.DEEPCOPY_CLIENT_SECRET
    
    return NextResponse.json({
      success: true,
      clientId: clientId,
      clientSecretLength: clientSecret?.length || 0,
      clientSecretPreview: clientSecret ? clientSecret.substring(0, 10) + '...' : 'Not found',
      hasCredentials: !!(clientId && clientSecret)
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
