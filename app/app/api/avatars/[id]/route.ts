import { NextRequest, NextResponse } from 'next/server'

interface AccessTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

async function getAccessToken(): Promise<string> {
  console.log('Requesting fresh access token...')
  
  const clientId = process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5'
  const clientSecret = process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
  const tokenEndpoint = 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token'

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://deep-copy.api/read https://deep-copy.api/write'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data: AccessTokenResponse = await response.json()
    console.log('Fresh access token obtained, expires_in:', data.expires_in)
    return data.access_token
  } catch (error) {
    console.error('Authentication error:', error)
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Avatar extraction job ID is required' }, { status: 400 })
    }

    // Get fresh access token
    const accessToken = await getAccessToken()

    // Get avatar extraction job status with cache-busting
    const response = await fetch(`https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/avatars/${id}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Avatar extraction job not found' }, { status: 404 })
      }
      const errorText = await response.text()
      throw new Error(`Avatar extraction status API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    return NextResponse.json(data)

  } catch (error) {
    console.error('Avatar extraction status error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to get avatar extraction status'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
