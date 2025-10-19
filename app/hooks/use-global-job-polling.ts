import { useState, useEffect, useCallback, useRef } from 'react'
import { deepCopyClient } from '@/lib/api/deepcopy-client'

interface GlobalJobPollingOptions {
  interval?: number
  onJobUpdate?: (jobId: string, status: string, progress?: number) => void
  onJobComplete?: (jobId: string, result: any) => void
}

interface PollingJob {
  id: string
  status: string
  progress?: number
  lastChecked: number
}

export function useGlobalJobPolling({
  interval = 10000, // Poll every 10 seconds
  onJobUpdate,
  onJobComplete
}: GlobalJobPollingOptions = {}) {
  const [pollingJobs, setPollingJobs] = useState<Map<string, PollingJob>>(new Map())
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Add a job to polling list
  const addJobToPolling = useCallback((jobId: string, status: string, progress?: number) => {
    if (status === 'processing' || status === 'pending') {
      setPollingJobs(prev => new Map(prev.set(jobId, {
        id: jobId,
        status,
        progress,
        lastChecked: Date.now()
      })))
    }
  }, [])

  // Remove a job from polling list
  const removeJobFromPolling = useCallback((jobId: string) => {
    setPollingJobs(prev => {
      const newMap = new Map(prev)
      newMap.delete(jobId)
      return newMap
    })
  }, [])

  // Check a single job status - DISABLED: Now using server-side polling to avoid CORS
  const checkJobStatus = useCallback(async (job: PollingJob) => {
    console.log('⚠️ Client-side polling is disabled. Use server-side polling instead.')
    return
    try {
      console.log(`🔍 Global polling: Checking DeepCopy API for job ${job.id}`)
      
      // Hit DeepCopy API directly for status
      const data = await deepCopyClient.getJobStatus(job.id)
      
      console.log(`📊 DeepCopy API response for job ${job.id}:`, data.status, data.progress ? `(${data.progress}%)` : '')

      // Update job in polling list
      setPollingJobs(prev => {
        const newMap = new Map(prev)
        const existingJob = newMap.get(job.id)
        if (existingJob) {
          newMap.set(job.id, {
            ...existingJob,
            status: data.status,
            progress: data.progress || 0,
            lastChecked: Date.now()
          })
        }
        return newMap
      })

      // Call callbacks
      if (onJobUpdate) {
        onJobUpdate(job.id, data.status, data.progress)
      }

      // If job completed, remove from polling and call completion callback
      if (data.status === 'completed') {
        console.log(`✅ Global polling: Job ${job.id} completed via DeepCopy API`)
        removeJobFromPolling(job.id)
        if (onJobComplete) {
          onJobComplete(job.id, data)
        }
      } else if (data.status === 'failed') {
        console.log(`❌ Global polling: Job ${job.id} failed via DeepCopy API`)
        removeJobFromPolling(job.id)
      }
      
    } catch (error) {
      console.error(`❌ Global polling error for job ${job.id}:`, error)
      // Don't remove job from polling on error, just log it
    }
  }, [onJobUpdate, onJobComplete, removeJobFromPolling])

  // Start global polling
  const startPolling = useCallback(() => {
    if (isPolling) return

    
    setIsPolling(true)

    intervalRef.current = setInterval(() => {
      if (isMountedRef.current && pollingJobs.size > 0) {
        
        
        // Check all jobs in parallel (but limit concurrency)
        const jobs = Array.from(pollingJobs.values())
        const batchSize = 3
        
        for (let i = 0; i < jobs.length; i += batchSize) {
          const batch = jobs.slice(i, i + batchSize)
          batch.forEach(job => {
            // Only check jobs that haven't been checked recently
            if (Date.now() - job.lastChecked > 5000) { // 5 second minimum between checks
              checkJobStatus(job)
            }
          })
        }
      }
    }, interval)

  }, [isPolling, pollingJobs, interval, checkJobStatus])

  // Stop global polling
  const stopPolling = useCallback(() => {
    
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Auto-start polling when there are jobs to poll
  useEffect(() => {
    if (pollingJobs.size > 0 && !isPolling) {
      startPolling()
    } else if (pollingJobs.size === 0 && isPolling) {
      stopPolling()
    }
  }, [pollingJobs.size, isPolling, startPolling, stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return {
    isPolling,
    pollingJobsCount: pollingJobs.size,
    addJobToPolling,
    removeJobFromPolling,
    startPolling,
    stopPolling
  }
}
