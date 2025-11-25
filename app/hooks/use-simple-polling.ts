"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { internalApiClient } from '@/lib/clients/internal-client'
import { isProcessingStatus } from '@/lib/utils/job-status'
import { logger } from '@/lib/utils/logger'
import { jobKeys } from '@/lib/hooks/use-jobs'

/**
 * Simple polling hook that polls processing jobs via server-side endpoint
 * This avoids CORS issues by making requests to our own API instead of DeepCopy directly
 */
export function useSimplePolling(jobs: any[]) {
  const queryClient = useQueryClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  logger.log(`🔧 useSimplePolling: Called with ${jobs.length} jobs`)

  useEffect(() => {
    // Don't start polling if jobs data is not loaded yet
    if (!jobs || jobs.length === 0) {
      logger.log('⏳ Simple polling: Waiting for jobs data to load...')
      return
    }

    // Find jobs that need polling using utility
    const processingJobs = jobs.filter(job => isProcessingStatus(job.status))

    logger.log(`🔄 Simple polling: Found ${processingJobs.length} processing jobs out of ${jobs.length} total`)

    if (processingJobs.length === 0) {
      // No processing jobs, clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        logger.log('⏹️ Simple polling: Stopped - no processing jobs')
      }
      return
    }

    // Start polling every 5 seconds
    logger.log('🚀 Simple polling: Starting for', processingJobs.length, 'jobs')
    
    const pollJobs = async () => {
      logger.log('🔍 Simple polling: Checking server-side polling endpoint for', processingJobs.length, 'jobs')
      
      try {
        // Call server-side polling endpoint
        const result = await internalApiClient.pollJobs() as { updated?: number; total?: number }
        logger.log(`📊 Server polling result: ${result.updated || 0}/${result.total || 0} jobs updated`)
        
        // If any jobs were updated, force refresh the jobs list
        if (result.updated && result.updated > 0) {
          logger.log(`🔄 Jobs updated, refreshing dashboard...`)
          // Invalidate and refetch jobs immediately
          await queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
          await queryClient.refetchQueries({ queryKey: jobKeys.lists() })
        }
      } catch (error) {
        logger.error('❌ Error calling server polling:', error)
      }
    }

    // Poll immediately
    pollJobs()

    // Set up interval
    intervalRef.current = setInterval(pollJobs, 5000)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        logger.log('⏹️ Simple polling: Cleaned up')
      }
    }
  }, [jobs, queryClient])

  return {
    isPolling: jobs.some(job => isProcessingStatus(job.status))
  }
}