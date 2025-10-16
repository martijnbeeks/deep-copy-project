import { NextRequest, NextResponse } from 'next/server'

interface AccessTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5'
  const clientSecret = process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu724113t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
  const tokenEndpoint = 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token'


  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://deep-copy.api/read https://deep-copy.api/write'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data: AccessTokenResponse = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Authentication error:', error)
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Get access token using client credentials
    const accessToken = await getAccessToken()

    // Retry logic for 504 errors
    const maxRetries = 2
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        
        // Call the external avatar extraction API with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minute timeout

        const response = await fetch('https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/avatars/extract', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: controller.signal
        })


        if (!response.ok) {
          if (response.status === 504) {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 5000))
              continue
            } else {
              throw new Error('Avatar extraction service timed out after multiple attempts. This can happen with complex websites. Please try again later or use the "I know exactly who my customer is" option.')
            }
          }
          throw new Error(`Avatar extraction API responded with status: ${response.status}`)
        }

        const data = await response.json()
        
        if (!data.success) {
          throw new Error('Avatar extraction failed')
        }

        return NextResponse.json(data)

      } catch (error) {
        lastError = error
        if (error.name === 'AbortError') {
          throw new Error('Avatar extraction timed out after 10 minutes. The service is taking longer than expected. Please try again later or use the "I know exactly who my customer is" option.')
        }
        
        // If it's not a 504 error, don't retry
        if (!error.message.includes('504') && !error.message.includes('Gateway Timeout')) {
          throw error
        }
        
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Avatar extraction failed after all retry attempts')
  } catch (error) {
    console.error('Avatar extraction error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract avatars from the provided URL'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
