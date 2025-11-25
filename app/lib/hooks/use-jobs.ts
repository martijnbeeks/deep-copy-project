import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { JobWithTemplate, JobWithResult } from '@/lib/db/types'
import { internalApiClient } from '@/lib/clients/internal-client'
import { useJobsStore } from '@/stores/jobs-store'

// Query keys
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters?: { status?: string; search?: string }) => [...jobKeys.lists(), { filters }] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
}

// Fetch all jobs - uses TanStack Query directly, no Zustand
export function useJobs(filters?: { status?: string; search?: string }) {
  return useQuery<JobWithTemplate[]>({
    queryKey: jobKeys.list(filters),
    queryFn: async () => {
      const response = await internalApiClient.getJobs(filters) as { jobs: JobWithTemplate[] }
      return response.jobs
    },
    staleTime: 30 * 1000, // Data is fresh for 30 seconds - won't refetch on navigation if data is fresh
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates (only when component is mounted)
  })
}

// Fetch single job - uses TanStack Query directly, no Zustand
export function useJob(id: string) {
  return useQuery<JobWithResult>({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      return await internalApiClient.getJob(id) as JobWithResult
    },
    enabled: !!id,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates (only when component is mounted)
  })
}

// Create job mutation
export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobData: {
      title: string
      brand_info: string
      sales_page_url?: string
      template_id?: string
      advertorial_type: string
      target_approach?: string
      avatars?: any[]
      product_image?: string
    }) => {
      const response = await internalApiClient.createJob(jobData) as { job?: JobWithTemplate } | JobWithTemplate
      return (response as any)?.job || response
    },
    onSuccess: () => {
      // Invalidate and refetch jobs list
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
    },
  })
}

// Update job mutation
export function useUpdateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string;[key: string]: any }) => {
      const response = await internalApiClient.updateJob(id, updates) as { job?: JobWithTemplate } | JobWithTemplate
      return (response as any)?.job || response
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
    },
  })
}

// Delete job mutation
export function useDeleteJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await internalApiClient.deleteJob(id)
    },
    onSuccess: () => {
      // Invalidate jobs list
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
