"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Data is immediately stale - always refetch
        gcTime: 30 * 1000, // Keep in cache for only 30 seconds
        retry: 1,
        refetchOnWindowFocus: true, // Refetch when window gains focus
        refetchOnMount: true, // Refetch when component mounts
        refetchOnReconnect: true, // Refetch when reconnected
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
