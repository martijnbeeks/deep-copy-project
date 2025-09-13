"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient, type Job, isApiError, getApiData } from "@/lib/api-client"

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  totalWords: number
  avgQualityScore: number
  recentJobs: Job[]
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const response = await apiClient.getDashboardStats()

    if (isApiError(response)) {
      setError(response.error)
    } else {
      const data = getApiData(response)
      if (data) {
        setStats(data)
      }
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const refreshStats = useCallback(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    isLoading,
    error,
    refreshStats,
  }
}
