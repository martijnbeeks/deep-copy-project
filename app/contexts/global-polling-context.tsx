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
      fetchJobs()
    },
    onJobComplete: (jobId, result) => {
      console.log(`✅ Global polling completed job ${jobId}`)
      // Refresh jobs list to show completed status
      fetchJobs()
    }
  })

  // Auto-start polling when component mounts
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [startPolling, stopPolling])

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
}

export function useGlobalPolling() {
  const context = useContext(GlobalPollingContext)
  if (context === undefined) {
    throw new Error('useGlobalPolling must be used within a GlobalPollingProvider')
  }
  return context
}
