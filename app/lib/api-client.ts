// API utility functions for the AI Copywriting Dashboard

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface Job {
  id: string
  title: string
  description: string
  contentType: string
  tone: string
  targetAudience: string
  keywords: string[]
  additionalInstructions: string
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface JobStep {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed"
  startTime?: string
  endTime?: string
  duration?: number
}

export interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warning" | "success" | "error"
  message: string
  details?: string
}

export interface ContentResult {
  id: string
  jobId: string
  title: string
  sections: Array<{
    id: string
    title: string
    content: string
    type: "heading" | "paragraph" | "list" | "quote"
  }>
  wordCount: number
  readingTime: number
  tone: string
  contentType: string
  generatedAt: string
}

export interface Analytics {
  qualityScore: number
  readabilityScore: number
  seoScore: number
  toneAccuracy: number
  keywordDensity: Array<{ keyword: string; density: number; target: number }>
  contentMetrics: {
    sentences: number
    paragraphs: number
    avgSentenceLength: number
    fleschScore: number
  }
  performancePredictions: Array<{ metric: string; score: number; benchmark: number }>
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network error occurred",
      }
    }
  }

  // Job Management
  async createJob(
    jobData: Omit<Job, "id" | "status" | "progress" | "createdAt" | "updatedAt" | "createdBy">,
  ): Promise<ApiResponse<Job>> {
    return this.request<Job>("/jobs", {
      method: "POST",
      body: JSON.stringify(jobData),
    })
  }

  async getJob(jobId: string): Promise<ApiResponse<Job>> {
    return this.request<Job>(`/jobs/${jobId}`)
  }

  async getJobs(filters?: {
    status?: string
    contentType?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<{ jobs: Job[]; total: number }>> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString())
        }
      })
    }

    const queryString = params.toString()
    return this.request<{ jobs: Job[]; total: number }>(`/jobs${queryString ? `?${queryString}` : ""}`)
  }

  async getJobSteps(jobId: string): Promise<ApiResponse<JobStep[]>> {
    return this.request<JobStep[]>(`/jobs/${jobId}/steps`)
  }

  async getJobLogs(jobId: string): Promise<ApiResponse<LogEntry[]>> {
    return this.request<LogEntry[]>(`/jobs/${jobId}/logs`)
  }

  async cancelJob(jobId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    })
  }

  // Results Management
  async getResult(resultId: string): Promise<ApiResponse<{ content: ContentResult; analytics: Analytics }>> {
    return this.request<{ content: ContentResult; analytics: Analytics }>(`/results/${resultId}`)
  }

  async getResults(filters?: {
    contentType?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<{ results: Array<ContentResult & { qualityScore: number }>; total: number }>> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString())
        }
      })
    }

    const queryString = params.toString()
    return this.request<{ results: Array<ContentResult & { qualityScore: number }>; total: number }>(
      `/results${queryString ? `?${queryString}` : ""}`,
    )
  }

  async submitFeedback(
    resultId: string,
    rating: "positive" | "negative",
    feedback?: string,
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/results/${resultId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating, feedback }),
    })
  }

  async regenerateContent(resultId: string, sectionId?: string): Promise<ApiResponse<Job>> {
    return this.request<Job>(`/results/${resultId}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ sectionId }),
    })
  }

  // Analytics
  async getDashboardStats(): Promise<
    ApiResponse<{
      totalJobs: number
      activeJobs: number
      completedJobs: number
      totalWords: number
      avgQualityScore: number
      recentJobs: Job[]
    }>
  > {
    return this.request("/dashboard/stats")
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Utility functions for common operations
export function formatError(error: string | undefined): string {
  if (!error) return "An unknown error occurred"
  return error.charAt(0).toUpperCase() + error.slice(1)
}

export function isApiError(response: ApiResponse<any>): response is { error: string } {
  return "error" in response && !!response.error
}

export function getApiData<T>(response: ApiResponse<T>): T | null {
  return isApiError(response) ? null : response.data || null
}
