import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useJobsStore } from '@/stores/jobs-store'
import { JobWithTemplate, JobWithResult } from '@/lib/db/types'

// Query keys
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: string) => [...jobKeys.lists(), { filters }] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
}

// Fetch all jobs
export function useJobs() {
  const { fetchJobs } = useJobsStore()
  
  return useQuery<JobWithTemplate[]>({
    queryKey: jobKeys.lists(),
    queryFn: async () => {
      await fetchJobs()
      return useJobsStore.getState().jobs
    },
    staleTime: 0, // Data is immediately stale - always refetch
    gcTime: 30 * 1000, // Keep in cache for only 30 seconds
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  })
}

// Fetch single job
export function useJob(id: string) {
  const { fetchJob } = useJobsStore()
  
  return useQuery<JobWithResult>({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      await fetchJob(id)
      return useJobsStore.getState().currentJob!
    },
    enabled: !!id,
    staleTime: 0, // Data is immediately stale - always refetch
    gcTime: 30 * 1000, // Keep in cache for only 30 seconds
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  })
}

// Create job mutation
export function useCreateJob() {
  const queryClient = useQueryClient()
  const { addJob } = useJobsStore()
  
  return useMutation({
    mutationFn: async (jobData: {
      title: string
      brand_info: string
      sales_page_url?: string
      template_id?: string
    }) => {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create job')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      // Add to store
      addJob(data.job)
      
      // Invalidate and refetch jobs list
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
    },
  })
}

// Update job mutation
export function useUpdateJob() {
  const queryClient = useQueryClient()
  const { updateJob } = useJobsStore()
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update job')
      }
      
      return response.json()
    },
    onSuccess: (data, variables) => {
      // Update in store
      updateJob(variables.id, data.job)
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
    },
  })
}

// Invalidate jobs cache
export function useInvalidateJobs() {
  const queryClient = useQueryClient()
  
  return () => {
    queryClient.invalidateQueries({ queryKey: jobKeys.all })
  }
}
