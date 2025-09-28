"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface UseSimplePollingProps {
  enabled: boolean
  interval?: number
}

export function useSimplePolling({ enabled, interval = 10000 }: UseSimplePollingProps) {
  const queryClient = useQueryClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    console.log('🔄 Starting simple global polling...')
    
    intervalRef.current = setInterval(async () => {
      try {
        // Invalidate all job-related queries to trigger refetch
        await queryClient.invalidateQueries({ queryKey: ['jobs'] })
        console.log('🔄 Global polling: Refreshed jobs data')
      } catch (error) {
        console.error('❌ Global polling error:', error)
      }
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        console.log('🛑 Stopped simple global polling')
      }
    }
  }, [enabled, interval, queryClient])

  return {
    isPolling: enabled && intervalRef.current !== null
  }
}
