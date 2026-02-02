import { useState, useEffect, useCallback, useRef } from 'react'

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

  // Note: Client-side polling is disabled. Use server-side polling via /api/poll-jobs instead.
  // This hook now only manages the polling job list, actual polling happens server-side.

  // Start global polling (now just manages state, actual polling happens server-side)
  const startPolling = useCallback(() => {
    if (isPolling) return
    setIsPolling(true)
    // Note: Actual polling is handled server-side via /api/poll-jobs
    // This hook now only manages the job list state
  }, [isPolling])

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
