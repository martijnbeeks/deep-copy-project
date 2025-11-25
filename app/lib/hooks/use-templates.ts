import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Template } from '@/lib/db/types'
import { internalApiClient } from '@/lib/clients/internal-client'
import { useTemplatesStore } from '@/stores/templates-store'

// Query keys
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters?: { category?: string; search?: string }) => [...templateKeys.lists(), { filters }] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
}

// Fetch all templates - uses TanStack Query directly
export function useTemplates(filters?: { category?: string; search?: string }) {
  return useQuery<Template[]>({
    queryKey: templateKeys.list(filters),
    queryFn: async () => {
      // Build query params if filters provided
      const params = new URLSearchParams()
      if (filters?.category) params.append('category', filters.category)
      if (filters?.search) params.append('search', filters.search)
      const query = params.toString() ? `?${params}` : ''
      
      // Call API with query params
      const response = await fetch(`/api/templates${query}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json() as { templates: Template[] }
      return data.templates || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Invalidate templates cache
export function useInvalidateTemplates() {
  const queryClient = useQueryClient()
  
  return () => {
    queryClient.invalidateQueries({ queryKey: templateKeys.all })
  }
}

