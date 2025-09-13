"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient, type ContentResult, type Analytics, isApiError, getApiData } from "@/lib/api-client"

export function useResults(filters?: {
  contentType?: string
  status?: string
  search?: string
}) {
  const [results, setResults] = useState<Array<ContentResult & { qualityScore: number }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchResults = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const response = await apiClient.getResults(filters)

    if (isApiError(response)) {
      setError(response.error)
      setResults([])
      setTotal(0)
    } else {
      const data = getApiData(response)
      if (data) {
        setResults(data.results)
        setTotal(data.total)
      }
    }

    setIsLoading(false)
  }, [filters])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const refreshResults = useCallback(() => {
    fetchResults()
  }, [fetchResults])

  return {
    results,
    total,
    isLoading,
    error,
    refreshResults,
  }
}

export function useResult(resultId: string | null) {
  const [content, setContent] = useState<ContentResult | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResult = useCallback(async () => {
    if (!resultId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const response = await apiClient.getResult(resultId)

    if (isApiError(response)) {
      setError(response.error)
    } else {
      const data = getApiData(response)
      if (data) {
        setContent(data.content)
        setAnalytics(data.analytics)
      }
    }

    setIsLoading(false)
  }, [resultId])

  useEffect(() => {
    fetchResult()
  }, [fetchResult])

  const submitFeedback = useCallback(
    async (rating: "positive" | "negative", feedback?: string) => {
      if (!resultId) return

      const response = await apiClient.submitFeedback(resultId, rating, feedback)

      if (isApiError(response)) {
        throw new Error(response.error)
      }
    },
    [resultId],
  )

  const regenerateContent = useCallback(
    async (sectionId?: string) => {
      if (!resultId) return

      const response = await apiClient.regenerateContent(resultId, sectionId)

      if (isApiError(response)) {
        throw new Error(response.error)
      }

      const newJob = getApiData(response)
      return newJob
    },
    [resultId],
  )

  return {
    content,
    analytics,
    isLoading,
    error,
    submitFeedback,
    regenerateContent,
    refreshResult: fetchResult,
  }
}
