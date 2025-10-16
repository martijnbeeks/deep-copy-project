import { useState, useEffect, useCallback, useRef } from 'react'

interface JobPollingOptions {
  jobId: string
  enabled?: boolean
  interval?: number
  maxAttempts?: number
  onStatusChange?: (status: string, progress?: number) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
}

interface JobStatus {
  status: string
  progress?: number
  result?: any
  error?: string
}

export function useJobPolling({
  jobId,
  enabled = true,
  interval = 5000, // Poll every 5 seconds
  maxAttempts = 120, // Max 10 minutes of polling
  onStatusChange,
  onComplete,
  onError
}: JobPollingOptions) {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    status: 'processing',
    progress: 0
  })
  const [isPolling, setIsPolling] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const checkJobStatus = useCallback(async () => {
    if (!jobId || !enabled || attempts >= maxAttempts) {
      return
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        if (response.status === 400) {
          
          setIsPolling(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      

      const newStatus = {
        status: data.status || 'processing',
        progress: data.progress || 0,
        result: data.result,
        error: data.error
      }

      setJobStatus(newStatus)
      setAttempts(prev => prev + 1)

      // Call status change callback
      if (onStatusChange) {
        onStatusChange(newStatus.status, newStatus.progress)
      }

      // Check if job is complete
      if (newStatus.status === 'completed') {
        
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        if (onComplete && newStatus.result) {
          onComplete(newStatus.result)
        }
      } else if (newStatus.status === 'failed') {
        
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        if (onError) {
          onError(new Error(newStatus.error || 'Job failed'))
        }
      }

    } catch (error) {
      console.error(`Error polling job ${jobId}:`, error)
      setAttempts(prev => prev + 1)
      
      if (onError) {
        onError(error as Error)
      }

      // If we've exceeded max attempts, stop polling
      if (attempts + 1 >= maxAttempts) {
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }
  }, [jobId, enabled, attempts, maxAttempts, onStatusChange, onComplete, onError])

  const startPolling = useCallback(() => {
    if (!jobId || !enabled || isPolling) {
      return
    }

    
    setIsPolling(true)
    setAttempts(0)

    // Initial check
    checkJobStatus()

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        checkJobStatus()
      }
    }, interval)
  }, [jobId, enabled, isPolling, interval, checkJobStatus])

  const stopPolling = useCallback(() => {
    
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [jobId])

  // Auto-start polling when enabled and job is processing
  useEffect(() => {
    if (enabled && jobId && !isPolling) {
      // Only start polling if we don't have job status yet or job is processing
      if (!jobStatus.status || jobStatus.status === 'processing' || jobStatus.status === 'pending') {
        startPolling()
      }
    }
  }, [enabled, jobId, isPolling, jobStatus.status, startPolling])

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

  // Stop polling if max attempts reached
  useEffect(() => {
    if (attempts >= maxAttempts && isPolling) {
      
      stopPolling()
    }
  }, [attempts, maxAttempts, isPolling, jobId, stopPolling])

  return {
    jobStatus,
    isPolling,
    attempts,
    maxAttempts,
    startPolling,
    stopPolling,
    checkJobStatus
  }
}
