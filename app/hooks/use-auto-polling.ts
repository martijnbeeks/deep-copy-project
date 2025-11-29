"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useGlobalPolling } from '@/contexts/global-polling-context'
import { useJobs } from '@/lib/hooks/use-jobs'
import { logger } from '@/lib/utils/logger'

/**
 * Automatically adds processing jobs to global polling
 * This hook should be used on pages that display jobs to ensure
 * processing jobs are monitored globally
 */
export function useAutoPolling() {
  const { data: jobs = [] } = useJobs()
  
  // Try to get global polling context, but don't fail if it's not available
  let addJobToPolling: (jobId: string, status: string, progress?: number) => void = () => {}
  let removeJobFromPolling: (jobId: string) => void = () => {}
  
  try {
    const globalPolling = useGlobalPolling()
    addJobToPolling = globalPolling.addJobToPolling
    removeJobFromPolling = globalPolling.removeJobFromPolling
    logger.log('✅ useAutoPolling: Global polling context available')
  } catch (error) {
    logger.log('⚠️ useAutoPolling: Global polling context not available, using fallback')
  }

  // Use refs to track current jobs to avoid stale closures
  const jobsRef = useRef(jobs)
  const addJobRef = useRef(addJobToPolling)
  const removeJobRef = useRef(removeJobFromPolling)

  // Update refs when values change
  useEffect(() => {
    jobsRef.current = jobs
    addJobRef.current = addJobToPolling
    removeJobRef.current = removeJobFromPolling
  }, [jobs, addJobToPolling, removeJobFromPolling])

  useEffect(() => {
    // Add all processing jobs to global polling
    const processingJobs = jobsRef.current.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    )

    logger.log(`🔄 Auto-polling: Found ${processingJobs.length} processing jobs:`, processingJobs.map(j => `${j.id}(${j.status})`))

    // Add each processing job to global polling
    processingJobs.forEach(job => {
      logger.log(`➕ Adding job ${job.id} to global polling (${job.status})`)
      addJobRef.current(job.id, job.status, job.progress)
    })

    // Clean up: remove jobs that are no longer processing
    const completedJobs = jobsRef.current.filter(job => 
      job.status === 'completed' || job.status === 'failed'
    )

    completedJobs.forEach(job => {
      logger.log(`➖ Removing completed job ${job.id} from global polling (${job.status})`)
      removeJobRef.current(job.id)
    })

    // Cleanup function: remove all jobs when component unmounts
    return () => {
      jobsRef.current.forEach(job => {
        removeJobRef.current(job.id)
      })
    }
  }, [jobs.length]) // Only depend on jobs.length to avoid excessive re-runs

  return {
    processingJobsCount: jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    ).length
  }
}
