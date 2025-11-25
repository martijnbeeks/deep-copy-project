"use client"

import React, { createContext, useContext, useEffect } from 'react'
import { useGlobalJobPolling } from '@/hooks/use-global-job-polling'
import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@/lib/utils/logger'
import { jobKeys } from '@/lib/hooks/use-jobs'

interface GlobalPollingContextType {
  isPolling: boolean
  pollingJobsCount: number
  addJobToPolling: (jobId: string, status: string, progress?: number) => void
  removeJobFromPolling: (jobId: string) => void
}

const GlobalPollingContext = createContext<GlobalPollingContextType | undefined>(undefined)

export function GlobalPollingProvider({ children }: { children: React.ReactNode }) {
  logger.log('🔧 GlobalPollingProvider: Initializing...')
  try {
    const queryClient = useQueryClient()
    logger.log('🔧 GlobalPollingProvider: Context initialized successfully')

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
        logger.log(`🔄 Global polling: Job ${jobId} status updated to ${status}`)
        // Invalidate only the jobs list queries, not all job-related queries
        try {
          queryClient.invalidateQueries({ queryKey: jobKeys.lists(), exact: false })
          // Also invalidate the specific job detail if it exists
          queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId), exact: true })
          logger.log(`🔄 Invalidated TanStack Query cache for jobs list and job ${jobId}`)
        } catch (error) {
          logger.error('Error refreshing jobs:', error)
        }
      },
      onJobComplete: (jobId, result) => {
        logger.log(`✅ Global polling: Job ${jobId} completed`)
        // Invalidate only the jobs list queries, not all job-related queries
        try {
          queryClient.invalidateQueries({ queryKey: jobKeys.lists(), exact: false })
          // Also invalidate the specific job detail if it exists
          queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId), exact: true })
          logger.log(`✅ Invalidated TanStack Query cache for jobs list and job ${jobId}`)
        } catch (error) {
          logger.error('Error refreshing jobs:', error)
        }
      }
    })

    // Auto-start polling when there are jobs to poll
    useEffect(() => {
      logger.log(`🔧 GlobalPollingProvider: pollingJobsCount=${pollingJobsCount}, isPolling=${isPolling}`)
      if (pollingJobsCount > 0 && !isPolling) {
        logger.log('🚀 Starting global polling for', pollingJobsCount, 'jobs')
        startPolling()
      } else if (pollingJobsCount === 0 && isPolling) {
        logger.log('⏹️ Stopping global polling - no jobs to poll')
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
    logger.error('Error in GlobalPollingProvider:', error)
    // Fallback: render children without polling
    return <>{children}</>
  }
}

export function useGlobalPolling() {
  logger.log('🔧 useGlobalPolling: Called')
  const context = useContext(GlobalPollingContext)
  if (context === undefined) {
    logger.error('❌ useGlobalPolling: Context not available - not within GlobalPollingProvider')
    throw new Error('useGlobalPolling must be used within a GlobalPollingProvider')
  }
  logger.log('✅ useGlobalPolling: Context available')
  return context
}
