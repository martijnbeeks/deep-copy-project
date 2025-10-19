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
  const { data: jobs = [] } = useJobs()
  
  // Try to get global polling context, but don't fail if it's not available
  let addJobToPolling: (jobId: string, status: string, progress?: number) => void = () => {}
  let removeJobFromPolling: (jobId: string) => void = () => {}
  
  try {
    const globalPolling = useGlobalPolling()
    addJobToPolling = globalPolling.addJobToPolling
    removeJobFromPolling = globalPolling.removeJobFromPolling
    console.log('✅ useAutoPolling: Global polling context available')
  } catch (error) {
    console.log('⚠️ useAutoPolling: Global polling context not available, using fallback')
  }

  useEffect(() => {
    // Add all processing jobs to global polling
    const processingJobs = jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    )

    console.log(`🔄 Auto-polling: Found ${processingJobs.length} processing jobs:`, processingJobs.map(j => `${j.id}(${j.status})`))

    // Add each processing job to global polling
    processingJobs.forEach(job => {
      console.log(`➕ Adding job ${job.id} to global polling (${job.status})`)
      addJobToPolling(job.id, job.status, job.progress)
    })

    // Clean up: remove jobs that are no longer processing
    const completedJobs = jobs.filter(job => 
      job.status === 'completed' || job.status === 'failed'
    )

    completedJobs.forEach(job => {
      console.log(`➖ Removing completed job ${job.id} from global polling (${job.status})`)
      removeJobFromPolling(job.id)
    })

  }, [jobs, addJobToPolling, removeJobFromPolling])

  return {
    processingJobsCount: jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    ).length
  }
}
