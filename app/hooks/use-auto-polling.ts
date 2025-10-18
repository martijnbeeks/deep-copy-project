"use client"

import { useEffect } from 'react'
import { useGlobalPolling } from '@/contexts/global-polling-context'
import { useJobs } from '@/lib/hooks/use-jobs'

/**
 * Automatically adds processing jobs to global polling
 * This hook should be used on pages that display jobs to ensure
 * processing jobs are monitored globally
 */
export function useAutoPolling() {
  const { addJobToPolling, removeJobFromPolling } = useGlobalPolling()
  const { data: jobs = [] } = useJobs()

  useEffect(() => {
    // Add all processing jobs to global polling
    const processingJobs = jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    )

    console.log(`🔄 Auto-polling: Found ${processingJobs.length} processing jobs`)

    // Add each processing job to global polling
    processingJobs.forEach(job => {
      addJobToPolling(job.id, job.status, job.progress)
    })

    // Clean up: remove jobs that are no longer processing
    const completedJobs = jobs.filter(job => 
      job.status === 'completed' || job.status === 'failed'
    )

    completedJobs.forEach(job => {
      removeJobFromPolling(job.id)
    })

  }, [jobs, addJobToPolling, removeJobFromPolling])

  return {
    processingJobsCount: jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    ).length
  }
}
