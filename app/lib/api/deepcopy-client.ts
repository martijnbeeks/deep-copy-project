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

interface CustomerAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
  pain_point?: string
  emotion?: string
  desire?: string
  characteristics?: string[]
  objections?: string[]
  failed_alternatives?: string[]
  is_broad_avatar?: boolean
}

interface SubmitJobRequest {
  sales_page_url?: string
  project_name?: string
  swipe_file_id?: string
  advertorial_type: string // Required field
  customer_avatars?: CustomerAvatar[]
  // Deprecated fields for backward compatibility
  persona?: string
  age_range?: string
  gender?: string
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

interface Angle {
  angle: string
  title: string
  target_age_range?: string
  target_audience?: string
  pain_points?: string[]
  desires?: string[]
  common_objections?: string[]
  failed_alternatives?: string[]
  copy_approach?: string[]
}

interface JobResult {
  project_name: string
  timestamp_iso: string
  job_id: string
  results: {
      research_page_analysis?: string
      doc1_analysis?: string
      doc2_analysis?: string
      deep_research_prompt?: string
      deep_research_output?: string
      avatar_sheet?: string
      offer_brief?: string | object
      marketing_philosophy_analysis?: string
      summary?: string
      swipe_results?: SwipeResult[]
      marketing_angles?: (string | Angle)[] // Support both old (string) and new (Angle) formats
  }
}

interface SwipeResult {
  angle: string
  content: Listicle | Advertorial
}

interface Listicle {
  title: string
  author: string
  summary: string
  listicles: ListicleItem[]
  cta: string
  conclusion: string
}

interface ListicleItem {
  number: number
  title: string
  description: string
}

interface Advertorial {
  title: string
  subtitle: string
  body: string
  cta: string
  captions: string
}

interface AvatarExtractionRequest {
  url: string
}

interface AvatarExtractionResponse {
  success: boolean
  url: string
  avatars: CustomerAvatar[]
}

class DeepCopyClient {
  private config: DeepCopyConfig

  constructor(config: DeepCopyConfig) {
      this.config = config
  }

  private async getAccessToken(): Promise<string> {
      // ALWAYS get a fresh token - no caching
      console.log('Requesting fresh access token...')
      
      try {
          const response = await fetch(this.config.tokenEndpoint, {
              method: 'POST',
              cache: 'no-store',
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
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
          console.log('Token preview:', data.access_token.substring(0, 20) + '...')
          return data.access_token
      } catch (error) {
          console.error('Authentication error:', error)
          throw new Error('Authentication failed')
      }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      const token = await this.getAccessToken()
      console.log(`🔑 Using token: ${token.substring(0, 20)}...`)
      const fullUrl = `${this.config.apiUrl}${endpoint}?t=${Date.now()}`
      console.log(`🌐 Making request to: ${fullUrl}`)
      const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...(options.headers as Record<string, string> || {})
      }

      // Only add Content-Type for requests with body (POST, PUT, PATCH)
      if (options.body && ['POST', 'PUT', 'PATCH'].includes(options.method || 'POST')) {
          headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(fullUrl, {
          ...options,
          cache: 'no-store',
          headers
      })

      console.log(`📊 Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ API Error: ${response.status} ${response.statusText} - ${errorText}`)
          console.error(`❌ Request URL: ${fullUrl}`)
          console.error(`❌ Request headers:`, headers)
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
      return this.makeRequest('jobs', {
          method: 'POST',
          body: JSON.stringify(jobData)
      })
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
      // Don't add timestamp here - makeRequest will add it
      return this.makeRequest<JobStatusResponse>(`jobs/${jobId}`)
  }

  async getJobResult(jobId: string): Promise<JobResult> {
      return this.makeRequest(`jobs/${jobId}/result`)
  }

  async extractAvatars(request: AvatarExtractionRequest): Promise<AvatarExtractionResponse> {
      return this.makeRequest('avatars/extract', {
          method: 'POST',
          body: JSON.stringify(request),
          // Add timeout for avatar extraction
          signal: AbortSignal.timeout(30000) // 30 second timeout
      })
  }

  async generateSwipeFiles(originalJobId: string, selectAngle: string): Promise<SubmitJobResponse> {
      return this.makeRequest('swipe-files/generate', {
          method: 'POST',
          body: JSON.stringify({
              original_job_id: originalJobId,
              select_angle: selectAngle
          })
      })
  }

  async getSwipeFileStatus(swipeFileJobId: string): Promise<JobStatusResponse> {
      return this.makeRequest<JobStatusResponse>(`swipe-files/${swipeFileJobId}`)
  }

  async getSwipeFileResult(swipeFileJobId: string): Promise<any> {
      return this.makeRequest(`swipe-files/${swipeFileJobId}/result`)
  }
}

// Create a singleton instance with production configuration
export const deepCopyClient = new DeepCopyClient({
  apiUrl: 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/',
  tokenEndpoint: 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token',
  clientId: process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5',
  clientSecret: process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
})

export type { SubmitJobRequest, SubmitJobResponse, JobStatusResponse, JobResult, SwipeResult, Listicle, ListicleItem, Advertorial, CustomerAvatar, AvatarExtractionRequest, AvatarExtractionResponse, Angle }
