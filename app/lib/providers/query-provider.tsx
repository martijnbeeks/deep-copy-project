"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import devtools only in development
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools), {
    ssr: false,
  })
  : () => null

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // Data is fresh for 30 seconds - won't refetch if data is less than 30s old
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (was cacheTime in v4)
        retry: 1,
        refetchOnWindowFocus: false, // Don't refetch on window focus (you have polling for real-time updates)
        refetchOnMount: false, // Only refetch if data is stale (respects staleTime)
        refetchOnReconnect: true, // Refetch when reconnected
        meta: {
          persist: false
        }
      },
      mutations: {
        retry: 1,
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
