/**
 * DeepCopy API authentication utilities
 * Centralizes access token retrieval to eliminate duplication
 */

import { logger } from '@/lib/utils/logger'

interface AccessTokenResponse {
    access_token: string
    token_type: string
    expires_in: number
}

/**
 * Get DeepCopy API access token using client credentials
 * Always fetches a fresh token (no caching)
 */
export async function getDeepCopyAccessToken(): Promise<string> {
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
            throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data: AccessTokenResponse = await response.json()
        return data.access_token
  } catch (error) {
    logger.error('Authentication error:', error)
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get full access token response (includes expires_in)
 */
export async function getDeepCopyAccessTokenResponse(): Promise<AccessTokenResponse> {
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
            throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data: AccessTokenResponse = await response.json()
        return data
  } catch (error) {
    logger.error('Authentication error:', error)
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

