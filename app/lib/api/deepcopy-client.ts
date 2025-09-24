interface DeepCopyConfig {
  apiUrl: string
  tokenEndpoint: string
  clientId: string
  clientSecret: string
}

interface AccessTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SubmitJobRequest {
  sales_page_url?: string
  project_name?: string
  swipe_file_id?: string
  advertorial_type?: string
}

interface SubmitJobResponse {
  jobId: string
  taskArn?: string
  status: 'SUBMITTED'
}

interface JobStatusResponse {
  jobId: string
  status: string
}

interface JobResult {
  [key: string]: any
}

class DeepCopyClient {
  private config: DeepCopyConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: DeepCopyConfig) {
    this.config = config
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://deep-copy.api/read https://deep-copy.api/write'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Token request failed:', errorText)
        throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data: AccessTokenResponse = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // 1 minute buffer
      
      return this.accessToken
    } catch (error) {
      console.error('Failed to get access token:', error)
      throw new Error('Authentication failed')
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken()
    const fullUrl = `${this.config.apiUrl}${endpoint}`
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API request failed:', errorText)
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // Handle different content types
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    } else {
      return response.text() as T
    }
  }

  async submitJob(jobData: SubmitJobRequest): Promise<SubmitJobResponse> {
    return this.makeRequest<SubmitJobResponse>('jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    })
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest<JobStatusResponse>(`jobs/${jobId}`)
  }

  async getJobResult(jobId: string): Promise<JobResult> {
    return this.makeRequest<JobResult>(`jobs/${jobId}/result`)
  }
}

// Create a singleton instance with production configuration
export const deepCopyClient = new DeepCopyClient({
  apiUrl: 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/',
  tokenEndpoint: 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token',
  clientId: process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5',
  clientSecret: process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu724113t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
})

export type { SubmitJobRequest, SubmitJobResponse, JobStatusResponse, JobResult }
