"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Simple polling hook that polls processing jobs via server-side endpoint
 * This avoids CORS issues by making requests to our own API instead of DeepCopy directly
 */
export function useSimplePolling(jobs: any[]) {
  const queryClient = useQueryClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  console.log(`🔧 useSimplePolling: Called with ${jobs.length} jobs`)

  useEffect(() => {
    // Don't start polling if jobs data is not loaded yet
    if (!jobs || jobs.length === 0) {
      console.log('⏳ Simple polling: Waiting for jobs data to load...')
      return
    }

    // Find processing jobs
    const processingJobs = jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending'
    )

    console.log(`🔄 Simple polling: Found ${processingJobs.length} processing jobs out of ${jobs.length} total`)

    if (processingJobs.length === 0) {
      // No processing jobs, clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        console.log('⏹️ Simple polling: Stopped - no processing jobs')
      }
      return
    }

    // Start polling every 5 seconds
    console.log('🚀 Simple polling: Starting for', processingJobs.length, 'jobs')
    
    const pollJobs = async () => {
      console.log('🔍 Simple polling: Checking server-side polling endpoint for', processingJobs.length, 'jobs')
      
      try {
        // Call server-side polling endpoint
        const response = await fetch('/api/poll-jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo@example.com'}`
          }
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log(`📊 Server polling result: ${result.updated}/${result.total} jobs updated`)
          
          // If any jobs were updated, force refresh the jobs list
          if (result.updated > 0) {
            console.log(`🔄 Jobs updated, refreshing dashboard...`)
            // Invalidate and refetch jobs immediately
            await queryClient.invalidateQueries({ queryKey: ['jobs'] })
            await queryClient.refetchQueries({ queryKey: ['jobs'] })
          }
        } else {
          console.error('❌ Server polling failed:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('❌ Error calling server polling:', error)
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
        console.log('⏹️ Simple polling: Cleaned up')
      }
    }
  }, [jobs, queryClient])

  return {
    isPolling: jobs.some(job => job.status === 'processing' || job.status === 'pending')
  }
}