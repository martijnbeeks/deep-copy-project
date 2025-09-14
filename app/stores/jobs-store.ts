import { create } from 'zustand'
import { Job, JobWithTemplate, JobWithResult } from '@/lib/db/types'

interface JobsState {
  jobs: JobWithTemplate[]
  currentJob: JobWithResult | null
  isLoading: boolean
  error: string | null
  filters: {
    status?: string
    search?: string
  }
}

interface JobsActions {
  setJobs: (jobs: JobWithTemplate[]) => void
  addJob: (job: JobWithTemplate) => void
  updateJob: (id: string, updates: Partial<Job>) => void
  setCurrentJob: (job: JobWithResult | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFilters: (filters: Partial<JobsState['filters']>) => void
  fetchJobs: () => Promise<void>
  fetchJob: (id: string) => Promise<void>
  createJob: (jobData: {
    title: string
    brand_info: string
    sales_page_url?: string
    template_id?: string
  }) => Promise<JobWithTemplate>
  pollJobStatus: (jobId: string) => void
}

export const useJobsStore = create<JobsState & JobsActions>((set, get) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,
  error: null,
  filters: {},

  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJob: (id, updates) => set((state) => ({
    jobs: state.jobs.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ),
    currentJob: state.currentJob?.id === id 
      ? { ...state.currentJob, ...updates }
      : state.currentJob
  })),
  setCurrentJob: (job) => set({ currentJob: job }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (filters) => set((state) => ({ 
    filters: { ...state.filters, ...filters } 
  })),

  fetchJobs: async () => {
    set({ isLoading: true, error: null })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/jobs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch jobs')
      
      const { jobs } = await response.json()
      set({ jobs, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        isLoading: false 
      })
    }
  },

  fetchJob: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/jobs/${id}`)
      if (!response.ok) throw new Error('Failed to fetch job')
      
      const job = await response.json()
      set({ currentJob: job, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch job',
        isLoading: false 
      })
    }
  },

  createJob: async (jobData) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create job')
      }

      const job = await response.json()
      set((state) => ({ 
        jobs: [job, ...state.jobs],
        isLoading: false 
      }))
      return job
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create job',
        isLoading: false 
      })
      throw error
    }
  },

  pollJobStatus: (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) return

        const job = await response.json()
        get().updateJob(jobId, job)

        // Continue polling if job is still processing
        if (job.status === 'pending' || job.status === 'processing') {
          setTimeout(poll, 2000) // Poll every 2 seconds
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    poll()
  },
}))
