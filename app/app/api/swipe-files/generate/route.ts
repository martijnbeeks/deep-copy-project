import { NextRequest, NextResponse } from 'next/server'

async function getAccessToken(): Promise<string> {
  const clientId = process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5'
  const clientSecret = process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
  const tokenEndpoint = 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token'

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://deep-copy.api/read https://deep-copy.api/write'
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    body: body.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { original_job_id, select_angle } = body

    if (!original_job_id || !select_angle) {
      return NextResponse.json(
        { error: 'original_job_id and select_angle are required' },
        { status: 400 }
      )
    }

    const apiUrl = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

    // Retry logic for connection timeouts
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get fresh access token for each attempt
        const accessToken = await getAccessToken()
        
        // Create AbortController with 60 second timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds

        const response = await fetch(`${apiUrl}swipe-files/generate?t=${Date.now()}`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            original_job_id,
            select_angle
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json(
            { error: `Swipe file generation failed: ${response.status} - ${errorText}` },
            { status: response.status }
          )
        }

        const data = await response.json()
        return NextResponse.json(data)

      } catch (error: any) {
        lastError = error
        
        // Check if it's a timeout or connection error
        const isTimeout = error.name === 'AbortError' || 
                         error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                         error.message?.includes('timeout') ||
                         error.message?.includes('ECONNRESET') ||
                         error.message?.includes('ENOTFOUND')

        if (isTimeout && attempt < maxRetries) {
          console.log(`⚠️ Swipe file generation attempt ${attempt} timed out, retrying... (${maxRetries - attempt} attempts left)`)
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }

        // If it's not a timeout or we're out of retries, throw
        throw error
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to generate swipe files after multiple attempts')

  } catch (error) {
    console.error('Swipe file generation error:', error)
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to generate swipe files'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The API is taking longer than expected. Please try again.'
        statusCode = 504 // Gateway Timeout
      } else if (error.message?.includes('ECONNRESET') || error.message?.includes('ENOTFOUND')) {
        errorMessage = 'Connection error. Please check your internet connection and try again.'
        statusCode = 503 // Service Unavailable
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}

