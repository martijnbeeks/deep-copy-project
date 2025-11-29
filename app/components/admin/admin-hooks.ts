"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import type { User, Template, InjectableTemplate, Job, DatabaseStats, InviteLink, JobStatus } from './admin-types'

// Helper function to get auth headers
export const getAuthHeaders = (): Record<string, string> => {
  const sessionToken = sessionStorage.getItem('adminSessionToken')
  const headers: Record<string, string> = {}
  if (sessionToken) {
    headers['x-admin-session'] = sessionToken
  }
  return headers
}

// Query keys
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  templates: () => [...adminKeys.all, 'templates'] as const,
  injectableTemplates: () => [...adminKeys.all, 'injectable-templates'] as const,
  jobs: () => [...adminKeys.all, 'jobs'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  inviteLinks: () => [...adminKeys.all, 'invite-links'] as const,
}

// Fetch admin users
export function useAdminUsers() {
  return useQuery<User[]>({
    queryKey: adminKeys.users(),
    queryFn: async () => {
      const response = await fetch('/api/admin/users', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      return data.users
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Fetch admin templates
export function useAdminTemplates() {
  return useQuery<Template[]>({
    queryKey: adminKeys.templates(),
    queryFn: async () => {
      const response = await fetch('/api/admin/templates', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      return data.templates
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Fetch injectable templates
export function useAdminInjectableTemplates() {
  return useQuery<InjectableTemplate[]>({
    queryKey: adminKeys.injectableTemplates(),
    queryFn: async () => {
      const response = await fetch('/api/admin/injectable-templates', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch injectable templates')
      return await response.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Fetch admin jobs
export function useAdminJobs() {
  return useQuery<Job[]>({
    queryKey: adminKeys.jobs(),
    queryFn: async () => {
      const response = await fetch('/api/admin/jobs', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch jobs')
      const data = await response.json()
      return data.jobs
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (jobs change more frequently)
    gcTime: 5 * 60 * 1000,
  })
}

// Fetch admin stats
export function useAdminStats() {
  return useQuery<{ stats: DatabaseStats; jobStatuses: JobStatus[] }>({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const response = await fetch('/api/admin/stats', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch stats')
      return await response.json()
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Fetch invite links
export function useAdminInviteLinks() {
  return useQuery<InviteLink[]>({
    queryKey: adminKeys.inviteLinks(),
    queryFn: async () => {
      const response = await fetch('/api/admin/invite-links', { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to fetch invite links')
      const data = await response.json()
      return data.invite_links || []
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Create user mutation
export function useCreateAdminUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userData: { email: string; password: string; name: string }) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(userData)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create user')
      }
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
      toast({
        title: "Success",
        description: "User created successfully"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })
}

// Delete user mutation
export function useDeleteAdminUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete user')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
      toast({
        title: "Success",
        description: "User deleted successfully"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })
}

