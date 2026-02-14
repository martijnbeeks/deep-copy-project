import { logger } from '@/lib/utils/logger'
import { isDevMode } from '@/lib/utils/env'
import { getDeepCopyAccessToken } from '@/lib/auth/deepcopy-auth'

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
  is_researched?: boolean
}

interface SubmitMarketingAngleRequest {
  title: string
  brand_info?: string
  sales_page_url: string
  target_approach: string
  avatars?: {
    persona_name: string
    is_researched: boolean
  }[]
}

interface SubmitJobResponse {
  jobId: string
  taskArn?: string
  status: 'SUBMITTED'
}

interface JobStatusResponse {
  jobId: string
  status: string
  progress?: number
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

interface MarketingAngleResult {
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
    marketing_angles?: (string | Angle)[]
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

// Updated to match OpenAPI spec
interface AvatarExtractionResult {
  success: boolean
  url: string
  job_id: string
  timestamp_iso: string
  avatars: CustomerAvatar[]
  company_type: string
  product_description: string
  product_image?: string
}

interface SwipeFileGenerationRequest {
  original_job_id: string
  avatar_id: string
  angle_id: string
  swipe_file_ids?: string[]
}

// V2 API Interfaces
interface SubmitV2JobRequest {
  sales_page_url: string
  project_name: string
  advertorial_type?: string
  research_requirements?: string
  gender?: string
  location?: string
  notification_email?: string
  callback_url?: string
}

interface JobResultV2 {
  project_name: string
  timestamp_iso: string
  job_id: string
  api_version: string
  results: {
    research_page_analysis?: string
    deep_research_prompt?: string
    deep_research_output?: string
    marketing_avatars?: MarketingAvatarV2[]
    summary?: string
  }
}

export interface MarketingAvatarV2 {
  avatar: {
    name: string
    demographics: {
      age_range: string
      gender: string
      occupation: string
      income_level: string
      location_type: string
      family_situation: string
      education_level: string
      one_sentence_description: string
    }
    problem_experience: any
    pain_dimensions: {
      surface_pain: string
      emotional_pain: string
      social_pain: string
      identity_pain: string
      secret_pain: string
      dominant_negative_emotion: string
    }
    desire_dimensions: {
      surface_desire: string
      emotional_desire: string
      social_desire: string
      identity_desire: string
      secret_desire: string
      dream_outcome: string
    }
    awareness: any
    failed_solutions: any
    objections: any
    buying_psychology: any
    info_comm: any
    raw_language: any
    strategic_summary: any
  }
  angles: {
    avatar_name: string
    generated_angles: MarketingAngleV2[]
    top_3_angles: {
      primary_angle: TopAngleV2
      secondary_angle: TopAngleV2
      test_angle: TopAngleV2
    }
  }
  necessary_beliefs: string
}

export interface MarketingAngleV2 {
  angle_title: string
  angle_subtitle: string
  angle_type: string
  emotional_driver: string
  risk_level: string
  core_argument: string
  target_age_range: string
  target_audience: string
  pain_points: string[]
  desires: string[]
  common_objections: string[]
  failed_alternatives: string[]
  pain_quotes: string[]
  desire_quotes: string[]
  objection_quotes: string[]
  template_predictions?: {
    predictions: Array<{
      template_id: string
      overall_fit_score: number
      reasoning: string
      audience_fit?: number
      pain_point_fit?: number
      tone_fit?: number
    }>
  }
}

interface TopAngleV2 {
  name: string
  angle_type: string
  core_argument: string
  why_selected: string
  primary_hook: string
  emotional_driver: string
  risk_level: string
}

class DeepCopyClient {
  private config: DeepCopyConfig

  constructor(config: DeepCopyConfig) {
    this.config = config
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getDeepCopyAccessToken()
    const fullUrl = `${this.config.apiUrl}${endpoint}`


    logger.debug(`DeepCopy API Request [${endpoint}]:`, {
      url: fullUrl,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body as string) : undefined
    })


    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    const response = await fetch(fullUrl, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`API Error [${endpoint}]: ${response.status} - ${errorText}`)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    const responseData: T = contentType?.includes('application/json')
      ? await response.json()
      : await response.text() as T

    logger.debug(`DeepCopy API Response [${endpoint}]:`, !!responseData)

    return responseData
  }

  // Marketing Angle Jobs
  async submitMarketingAngle(data: SubmitMarketingAngleRequest): Promise<SubmitJobResponse> {
    const endpoint = isDevMode() ? 'dev/jobs' : 'jobs'
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        brand_info: data.brand_info || '',
        sales_page_url: data.sales_page_url,
        target_approach: data.target_approach,
        avatars: data.avatars || []
      })
    })
  }

  async getMarketingAngleStatus(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest(`jobs/${jobId}`)
  }

  async getMarketingAngleResult(jobId: string): Promise<MarketingAngleResult> {
    return this.makeRequest(`jobs/${jobId}/result`)
  }

  // Avatar Extraction (follows async pattern like other jobs)
  async submitAvatarExtraction(request: AvatarExtractionRequest): Promise<SubmitJobResponse> {
    const endpoint = isDevMode() ? 'dev/avatars/extract' : 'avatars/extract'
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  async getAvatarExtractionStatus(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest(`avatars/${jobId}`)
  }

  async getAvatarExtractionResult(jobId: string): Promise<AvatarExtractionResult> {
    return this.makeRequest(`avatars/${jobId}/result`)
  }

  // Swipe File Generation
  async submitSwipeFileGeneration(request: SwipeFileGenerationRequest): Promise<SubmitJobResponse> {
    const endpoint = isDevMode() ? 'dev/swipe-files/generate' : 'swipe-files/generate'
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  async getSwipeFileStatus(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest(`swipe-files/${jobId}`)
  }

  async getSwipeFileResult(jobId: string): Promise<any> {
    return this.makeRequest(`swipe-files/${jobId}/result`)
  }

  // V2 API Methods
  async submitV2Research(data: SubmitV2JobRequest): Promise<SubmitJobResponse> {
    const endpoint = isDevMode() ? 'dev/v2/jobs' : 'v2/jobs'
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        sales_page_url: data.sales_page_url,
        project_name: data.project_name,
        advertorial_type: data.advertorial_type,
        research_requirements: data.research_requirements,
        gender: data.gender,
        location: data.location,
        notification_email: data.notification_email,
        callback_url: data.callback_url,
      })
    })
  }

  async getV2Status(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest(`v2/jobs/${jobId}`)
  }

  async getV2Result(jobId: string): Promise<JobResultV2> {
    return this.makeRequest(`v2/jobs/${jobId}/result`)
  }
}

// Singleton instance
export const deepCopyClient = new DeepCopyClient({
  apiUrl: 'https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/',
  tokenEndpoint: 'https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token',
  clientId: process.env.DEEPCOPY_CLIENT_ID || '5mbatc7uv35hr23qip437s2ai5',
  clientSecret: process.env.DEEPCOPY_CLIENT_SECRET || '1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5'
})

export type {
  SubmitMarketingAngleRequest,
  SubmitJobResponse,
  JobStatusResponse,
  MarketingAngleResult,
  SwipeResult,
  Listicle,
  ListicleItem,
  Advertorial,
  CustomerAvatar,
  AvatarExtractionRequest,
  AvatarExtractionResult,
  SwipeFileGenerationRequest,
  Angle,
  SubmitV2JobRequest,
  JobResultV2
}