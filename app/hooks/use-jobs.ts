"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient, type Job, type JobStep, type LogEntry, isApiError, getApiData } from "@/lib/api-client"

export function useJobs(filters?: {
  status?: string
  contentType?: string
  search?: string
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const response = await apiClient.getJobs(filters)

    if (isApiError(response)) {
      setError(response.error)
      setJobs([])
      setTotal(0)
    } else {
      const data = getApiData(response)
      if (data) {
        setJobs(data.jobs)
        setTotal(data.total)
      }
    }

    setIsLoading(false)
  }, [filters])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const createJob = useCallback(async (jobData: Parameters<typeof apiClient.createJob>[0]) => {
    const response = await apiClient.createJob(jobData)

    if (isApiError(response)) {
      throw new Error(response.error)
    }

    const newJob = getApiData(response)
    if (newJob) {
      setJobs((prev) => [newJob, ...prev])
      setTotal((prev) => prev + 1)
    }

    return newJob
  }, [])

  const refreshJobs = useCallback(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    total,
    isLoading,
    error,
    createJob,
    refreshJobs,
  }
}

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [steps, setSteps] = useState<JobStep[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobData = useCallback(async () => {
    if (!jobId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [jobResponse, stepsResponse, logsResponse] = await Promise.all([
        apiClient.getJob(jobId),
        apiClient.getJobSteps(jobId),
        apiClient.getJobLogs(jobId),
      ])

      if (isApiError(jobResponse)) {
        setError(jobResponse.error)
        return
      }

      const jobData = getApiData(jobResponse)
      const stepsData = getApiData(stepsResponse) || []
      const logsData = getApiData(logsResponse) || []

      if (jobData) {
        setJob(jobData)
        setSteps(stepsData)
        setLogs(logsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job data")
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJobData()
  }, [fetchJobData])

  // Auto-refresh for processing jobs
  useEffect(() => {
    if (!job || job.status !== "processing") return

    const interval = setInterval(fetchJobData, 3000)
    return () => clearInterval(interval)
  }, [job, fetchJobData])

  const cancelJob = useCallback(async () => {
    if (!jobId) return

    const response = await apiClient.cancelJob(jobId)

    if (isApiError(response)) {
      throw new Error(response.error)
    }

    // Refresh job data after cancellation
    fetchJobData()
  }, [jobId, fetchJobData])

  return {
    job,
    steps,
    logs,
    isLoading,
    error,
    cancelJob,
    refreshJob: fetchJobData,
  }
}
