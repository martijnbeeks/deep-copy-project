"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Data is never stale - always refetch
        gcTime: 0, // Don't keep in cache
        retry: 1,
        refetchOnWindowFocus: true, // Always refetch on window focus
        refetchOnMount: true, // Always refetch on mount
        refetchOnReconnect: true, // Refetch when reconnected
        // Don't cache any queries
        meta: {
          persist: false
        }
      },
      mutations: {
        retry: 1,
        // Don't cache mutations
        meta: {
          persist: false
        }
      }
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
