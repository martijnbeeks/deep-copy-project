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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Swipe file job ID is required' }, { status: 400 })
    }

    const accessToken = await getAccessToken()
    const apiUrl = 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/'

    const response = await fetch(`${apiUrl}swipe-files/${id}/result?t=${Date.now()}`, {
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
        return NextResponse.json({ error: 'Swipe file result not available' }, { status: 404 })
      }
      const errorText = await response.text()
      throw new Error(`Swipe file result API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Swipe file result error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to get swipe file result'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

