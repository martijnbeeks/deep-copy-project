import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { JobWithTemplate, JobWithResult } from '@/lib/db/types'
import { internalApiClient } from '@/lib/clients/internal-client'
import { useJobsStore } from '@/stores/jobs-store'

// Query keys
export const marketingAngleKeys = {
  all: ['marketing-angles'] as const,
  lists: () => [...marketingAngleKeys.all, 'list'] as const,
  list: (filters?: { status?: string; search?: string }) => [...marketingAngleKeys.lists(), { filters }] as const,
  details: () => [...marketingAngleKeys.all, 'detail'] as const,
  detail: (id: string) => [...marketingAngleKeys.details(), id] as const,
}

// Fetch all marketing angles - uses TanStack Query directly, no Zustand
export function useMarketingAngles(filters?: { status?: string; search?: string }) {
  return useQuery<JobWithTemplate[]>({
    queryKey: marketingAngleKeys.list(filters),
    queryFn: async () => {
      const response = await internalApiClient.getMarketingAngles(filters) as { jobs: JobWithTemplate[] }
      return response.jobs
    },
    staleTime: 30 * 1000, // Data is fresh for 30 seconds - won't refetch on navigation if data is fresh
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates (only when component is mounted)
  })
}

// Fetch single marketing angle - uses TanStack Query directly, no Zustand
export function useMarketingAngle(id: string) {
  return useQuery<JobWithResult>({
    queryKey: marketingAngleKeys.detail(id),
    queryFn: async () => {
      return await internalApiClient.getMarketingAngle(id) as JobWithResult
    },
    enabled: !!id,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates (only when component is mounted)
  })
}

// Create marketing angle mutation
export function useCreateMarketingAngle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (marketingAngleData: {
      title: string
      brand_info: string
      sales_page_url?: string
      template_id?: string
      advertorial_type: string
      target_approach?: string
      avatars?: any[]
      product_image?: string
    }) => {
      const response = await internalApiClient.createMarketingAngle(marketingAngleData) as { job?: JobWithTemplate } | JobWithTemplate
      return (response as any)?.job || response
    },
    onSuccess: () => {
      // Invalidate and refetch marketing angles list
      queryClient.invalidateQueries({ queryKey: marketingAngleKeys.lists() })
    },
  })
}

// Update marketing angle mutation
export function useUpdateMarketingAngle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string;[key: string]: any }) => {
      const response = await internalApiClient.updateMarketingAngle(id, updates) as { job?: JobWithTemplate } | JobWithTemplate
      return (response as any)?.job || response
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: marketingAngleKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: marketingAngleKeys.lists() })
    },
  })
}

// Delete marketing angle mutation
export function useDeleteMarketingAngle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await internalApiClient.deleteMarketingAngle(id)
    },
    onSuccess: () => {
      // Invalidate marketing angles list
      queryClient.invalidateQueries({ queryKey: marketingAngleKeys.lists() })
    },
  })
}

// Invalidate marketing angles cache
export function useInvalidateMarketingAngles() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: marketingAngleKeys.all })
  }
}

// Legacy exports for backward compatibility during transition
export const useJobs = useMarketingAngles
export const useJob = useMarketingAngle
export const useCreateJob = useCreateMarketingAngle
export const useUpdateJob = useUpdateMarketingAngle
export const useDeleteJob = useDeleteMarketingAngle
export const useInvalidateJobs = useInvalidateMarketingAngles
export const jobKeys = marketingAngleKeys

