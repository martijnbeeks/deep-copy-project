/**
 * Centralized client for all internal Next.js API routes
 * This replaces scattered fetch() calls throughout the codebase
 */

import { getAuthToken, getUserEmail } from '@/lib/utils/client-auth'

interface ApiClientConfig {
  baseUrl?: string
  getAuthToken?: () => string | null
  getUserEmail?: () => string
}

class InternalApiClient {
  private baseUrl: string
  private getAuthToken: () => string | null
  private getUserEmail: () => string

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || ''
    this.getAuthToken = config.getAuthToken || getAuthToken
    this.getUserEmail = config.getUserEmail || getUserEmail
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    // Add auth token if available (prefer token, fallback to email)
    const token = this.getAuthToken()
    const userEmail = this.getUserEmail()

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (userEmail) {
      headers['Authorization'] = `Bearer ${userEmail}`
    }

    // Only use no-store for mutations or status endpoints that need real-time data
    // GET requests for static/semi-static data can use default caching
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')
    const isStatusEndpoint = endpoint.includes('/status') || endpoint.includes('/result')
    const shouldCache = !isMutation && !isStatusEndpoint

    const response = await fetch(url, {
      ...options,
      headers,
      cache: shouldCache ? 'default' : 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      
      // Preserve error data including status code, usage limit, and overage info
      const error = new Error(errorData.error || errorData.message || `API request failed: ${response.status}`) as Error & {
        status?: number
        currentUsage?: number
        limit?: number
        message?: string
        code?: string
        overageCredits?: number
        overageCostPerCredit?: number
        overageCostTotal?: number
        currency?: string
      }
      error.status = response.status
      if (errorData.currentUsage !== undefined) error.currentUsage = errorData.currentUsage
      if (errorData.limit !== undefined) error.limit = errorData.limit
      if (errorData.message) error.message = errorData.message
      if (errorData.code) error.code = errorData.code
      if (errorData.overageCredits !== undefined) error.overageCredits = errorData.overageCredits
      if (errorData.overageCostPerCredit !== undefined) error.overageCostPerCredit = errorData.overageCostPerCredit
      if (errorData.overageCostTotal !== undefined) error.overageCostTotal = errorData.overageCostTotal
      if (errorData.currency) error.currency = errorData.currency
      
      throw error
    }

    return response.json()
  }

  // ==================== MARKETING ANGLES API ====================

  async getMarketingAngles(filters?: { status?: string; search?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.search) params.append('search', filters.search)
    const query = params.toString() ? `?${params}` : ''
    return this.request(`/api/marketing-angles${query}`)
  }

  async getMarketingAngle(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}`)
  }

  async createMarketingAngle(marketingAngleData: any) {
    return this.request('/api/marketing-angles', {
      method: 'POST',
      body: JSON.stringify(marketingAngleData)
    })
  }

  async updateMarketingAngle(marketingAngleId: string, updates: any) {
    return this.request(`/api/marketing-angles/${marketingAngleId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }

  async deleteMarketingAngle(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}`, {
      method: 'DELETE'
    })
  }

  async getMarketingAngleStatus(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/status`)
  }

  async getMarketingAngleResult(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/result`)
  }

  // Legacy methods that still point to old /api/jobs routes for backward compatibility
  async getJobs(filters?: { status?: string; search?: string }) {
    return this.getMarketingAngles(filters)
  }

  async getJob(jobId: string) {
    return this.getMarketingAngle(jobId)
  }

  async createJob(jobData: any) {
    return this.createMarketingAngle(jobData)
  }

  async updateJob(jobId: string, updates: any) {
    return this.updateMarketingAngle(jobId, updates)
  }

  async deleteJob(jobId: string) {
    return this.deleteMarketingAngle(jobId)
  }

  async getJobStatus(jobId: string) {
    return this.getMarketingAngleStatus(jobId)
  }

  async getJobResult(jobId: string) {
    return this.getMarketingAngleResult(jobId)
  }

  async getGeneratedAngles(jobId: string) {
    // Use jobs endpoint since we're working with job IDs
    return this.request<string[]>(`/api/jobs/${jobId}/generated-angles`)
  }

  async getInjectedTemplates(jobId: string, includeHtml: boolean = true) {
    // Use jobs endpoint since we're working with job IDs
    // By default include HTML for backward compatibility, but can be disabled for faster requests
    const params = includeHtml ? '?includeHtml=true' : ''
    return this.request(`/api/jobs/${jobId}/injected-templates${params}`)
  }

  async updateGeneratedAngles(marketingAngleId: string, angles: string[]) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/update-generated-angles`, {
      method: 'POST',
      body: JSON.stringify({ angles })
    })
  }

  async generateRefinedTemplate(marketingAngleId: string, data: any) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/generate-refined-template`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async retryTemplates(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/retry-templates`, {
      method: 'POST'
    })
  }

  async processMarketingAngleResults(marketingAngleId: string) {
    return this.request(`/api/marketing-angles/${marketingAngleId}/process-results`, {
      method: 'POST'
    })
  }

  // ==================== SWIPE FILES API ====================

  async generateSwipeFiles(data: {
    original_job_id: string
    avatar_id: string
    angle_id: string
    swipe_file_ids?: string[]
  }) {
    return this.request('/api/swipe-files/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getSwipeFileStatus(swipeFileJobId: string) {
    return this.request(`/api/swipe-files/${swipeFileJobId}`)
  }

  async getSwipeFileResult(swipeFileJobId: string) {
    return this.request(`/api/swipe-files/${swipeFileJobId}/result`)
  }

  async processSwipeFile(data: {
    jobId: string
    angle: string
    swipeFileResponse: any
  }) {
    return this.request('/api/swipe-files/process', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // ==================== AVATARS API ====================

  async extractAvatars(url: string) {
    return this.request('/api/avatars/extract', {
      method: 'POST',
      body: JSON.stringify({ url })
    })
  }

  async getAvatarStatus(avatarJobId: string) {
    return this.request(`/api/avatars/${avatarJobId}`)
  }

  async getAvatarResult(avatarJobId: string) {
    return this.request(`/api/avatars/${avatarJobId}/result`)
  }

  async getAvatarToken() {
    return this.request('/api/avatars/token')
  }

  // ==================== TEMPLATES API ====================

  async getTemplates() {
    return this.request('/api/templates')
  }

  async getAllInjectedTemplates() {
    return this.request('/api/templates/injected')
  }

  // ==================== POLLING API ====================

  async pollMarketingAngles() {
    return this.request('/api/poll-marketing-angles', {
      method: 'POST'
    })
  }

  // ==================== STATIC ADS API ====================

  async getImageLibrary() {
    return this.request<Array<{ id: number; library_id: string; url: string; created_at: string }>>('/api/static-ads/image-library')
  }

  async generateStaticAds(formData: FormData) {
    // For multipart/form-data, we need to pass FormData directly without JSON.stringify
    const url = `${this.baseUrl}/api/static-ads/generate`
    const headers: Record<string, string> = {}
    
    // Add auth token if available
    const token = this.getAuthToken()
    const userEmail = this.getUserEmail()
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (userEmail) {
      headers['Authorization'] = `Bearer ${userEmail}`
    }
    
    // Don't set Content-Type for FormData - browser will set it with boundary
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      
      const error = new Error(errorData.error || errorData.message || `API request failed: ${response.status}`) as Error & {
        status?: number
        currentUsage?: number
        limit?: number
        message?: string
        code?: string
        overageCredits?: number
        overageCostPerCredit?: number
        overageCostTotal?: number
        currency?: string
      }
      error.status = response.status
      if (errorData.currentUsage !== undefined) error.currentUsage = errorData.currentUsage
      if (errorData.limit !== undefined) error.limit = errorData.limit
      if (errorData.message) error.message = errorData.message
      if (errorData.code) error.code = errorData.code
      if (errorData.overageCredits !== undefined) error.overageCredits = errorData.overageCredits
      if (errorData.overageCostPerCredit !== undefined) error.overageCostPerCredit = errorData.overageCostPerCredit
      if (errorData.overageCostTotal !== undefined) error.overageCostTotal = errorData.overageCostTotal
      if (errorData.currency) error.currency = errorData.currency
      
      throw error
    }

    return response.json()
  }

  async getStaticAdStatus(jobId: string) {
    console.log(`🌐 [InternalClient] Polling static ad status for job: ${jobId}`);
    return this.request(`/api/static-ads/${jobId}/status`)
  }

  async getStaticAdsByOriginalJob(originalJobId: string) {
    return this.request(`/api/static-ads/original-job/${originalJobId}`)
  }

  // ==================== ADMIN API ====================

  async getAdminInjectableTemplates(filters?: { id?: string; type?: string }) {
    const params = new URLSearchParams()
    if (filters?.id) params.append('id', filters.id)
    if (filters?.type) params.append('type', filters.type)
    const query = params.toString() ? `?${params}` : ''
    return this.request(`/api/admin/injectable-templates${query}`)
  }

}

// Create singleton instance with auth token getter
export const internalApiClient = new InternalApiClient()

// Export types
export type { InternalApiClient }

