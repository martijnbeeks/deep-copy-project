"use client"

import React, { createContext, useContext, useEffect } from 'react'
import { useGlobalJobPolling } from '@/hooks/use-global-job-polling'
import { useJobsStore } from '@/stores/jobs-store'

interface GlobalPollingContextType {
  isPolling: boolean
  pollingJobsCount: number
  addJobToPolling: (jobId: string, status: string, progress?: number) => void
  removeJobFromPolling: (jobId: string) => void
}

const GlobalPollingContext = createContext<GlobalPollingContextType | undefined>(undefined)

export function GlobalPollingProvider({ children }: { children: React.ReactNode }) {
  try {
    const { fetchJobs } = useJobsStore()
    
    const {
      isPolling,
      pollingJobsCount,
      addJobToPolling,
      removeJobFromPolling,
      startPolling,
      stopPolling
    } = useGlobalJobPolling({
      interval: 10000, // Poll every 10 seconds
      onJobUpdate: (jobId, status, progress) => {
        console.log(`🔄 Global polling updated job ${jobId}: ${status} (${progress}%)`)
        // Refresh jobs list to show updated status
        try {
          fetchJobs()
        } catch (error) {
          console.error('Error refreshing jobs:', error)
        }
      },
      onJobComplete: (jobId, result) => {
        console.log(`✅ Global polling completed job ${jobId}`)
        // Refresh jobs list to show completed status
        try {
          fetchJobs()
        } catch (error) {
          console.error('Error refreshing jobs:', error)
        }
      }
    })

    // Don't auto-start polling to avoid issues
    // Polling will start when jobs are added via addJobToPolling

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
  const context = useContext(GlobalPollingContext)
  if (context === undefined) {
    throw new Error('useGlobalPolling must be used within a GlobalPollingProvider')
  }
  return context
}
