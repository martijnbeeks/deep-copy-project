"use client"

import React, { createContext, useContext, useEffect } from 'react'
import { useGlobalJobPolling } from '@/hooks/use-global-job-polling'
import { useJobsStore } from '@/stores/jobs-store'
import { useQueryClient } from '@tanstack/react-query'

interface GlobalPollingContextType {
  isPolling: boolean
  pollingJobsCount: number
  addJobToPolling: (jobId: string, status: string, progress?: number) => void
  removeJobFromPolling: (jobId: string) => void
}

const GlobalPollingContext = createContext<GlobalPollingContextType | undefined>(undefined)

export function GlobalPollingProvider({ children }: { children: React.ReactNode }) {
  console.log('🔧 GlobalPollingProvider: Initializing...')
  try {
    const { fetchJobs } = useJobsStore()
    const queryClient = useQueryClient()
    console.log('🔧 GlobalPollingProvider: Context initialized successfully')
    
    const {
      isPolling,
      pollingJobsCount,
      addJobToPolling,
      removeJobFromPolling,
      startPolling,
      stopPolling
    } = useGlobalJobPolling({
      interval: 5000, // Poll every 5 seconds for better responsiveness
      onJobUpdate: (jobId, status, progress) => {
        console.log(`🔄 Global polling: Job ${jobId} status updated to ${status}`)
        // Refresh both Zustand store and TanStack Query cache
        try {
          fetchJobs()
          // Invalidate TanStack Query cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['jobs'] })
          console.log(`🔄 Invalidated TanStack Query cache for jobs`)
        } catch (error) {
          console.error('Error refreshing jobs:', error)
        }
      },
      onJobComplete: (jobId, result) => {
        console.log(`✅ Global polling: Job ${jobId} completed`)
        // Refresh both Zustand store and TanStack Query cache
        try {
          fetchJobs()
          // Invalidate TanStack Query cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['jobs'] })
          console.log(`✅ Invalidated TanStack Query cache for jobs`)
        } catch (error) {
          console.error('Error refreshing jobs:', error)
        }
      }
    })

    // Auto-start polling when there are jobs to poll
    useEffect(() => {
      console.log(`🔧 GlobalPollingProvider: pollingJobsCount=${pollingJobsCount}, isPolling=${isPolling}`)
      if (pollingJobsCount > 0 && !isPolling) {
        console.log('🚀 Starting global polling for', pollingJobsCount, 'jobs')
        startPolling()
      } else if (pollingJobsCount === 0 && isPolling) {
        console.log('⏹️ Stopping global polling - no jobs to poll')
        stopPolling()
      }
    }, [pollingJobsCount, isPolling, startPolling, stopPolling])

    return (
      <GlobalPollingContext.Provider value={{
        isPolling,
        pollingJobsCount,
        addJobToPolling,
        removeJobFromPolling
      }}>
        {children}
      </GlobalPollingContext.Provider>
    )
  } catch (error) {
    console.error('Error in GlobalPollingProvider:', error)
    // Fallback: render children without polling
    return <>{children}</>
  }
}

export function useGlobalPolling() {
  console.log('🔧 useGlobalPolling: Called')
  const context = useContext(GlobalPollingContext)
  if (context === undefined) {
    console.error('❌ useGlobalPolling: Context not available - not within GlobalPollingProvider')
    throw new Error('useGlobalPolling must be used within a GlobalPollingProvider')
  }
  console.log('✅ useGlobalPolling: Context available')
  return context
}
