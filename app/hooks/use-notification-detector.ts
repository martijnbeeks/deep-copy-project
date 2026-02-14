"use client"

import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuthorizationHeader } from '@/lib/utils/client-auth'
import { useNotificationsStore, type Notification } from '@/stores/notifications-store'
import { getResultPath } from '@/lib/utils/notification-helpers'
import { FEATURE_DISPLAY_INFO } from '@/lib/constants/job-credits'
import type { JobWithTemplate } from '@/lib/db/types'
import type { UsageType } from '@/lib/db/types'

export function useNotificationDetector(): { newlyCompleted: Notification[] } {
  const previousStatuses = useRef<Map<string, string> | null>(null)
  const newlyCompletedRef = useRef<Notification[]>([])
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const markAllAsSeen = useNotificationsStore((s) => s.markAllAsSeen)

  const { data: jobs } = useQuery<JobWithTemplate[]>({
    queryKey: ['notification-detector'],
    queryFn: async () => {
      const response = await fetch('/api/marketing-angles', {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizationHeader(),
        },
        cache: 'no-store',
      })
      if (!response.ok) return []
      const data = await response.json()
      return data.jobs ?? []
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  useEffect(() => {
    if (!jobs || jobs.length === 0) return

    const currentMap = new Map<string, string>()
    for (const job of jobs) {
      currentMap.set(job.id, job.status)
    }

    // First load: seed all completed jobs, no toasts
    if (previousStatuses.current === null) {
      previousStatuses.current = currentMap
      newlyCompletedRef.current = []

      for (const job of jobs) {
        if (job.status === 'completed') {
          const jobType = (job.target_approach ?? 'deep_research') as UsageType
          const displayInfo = FEATURE_DISPLAY_INFO[jobType]
          addNotification({
            jobId: job.id,
            title: job.title || displayInfo?.name || 'Job',
            jobType,
            completedAt: job.completed_at || job.updated_at,
            resultPath: getResultPath(job),
          })
        }
      }
      // Mark all seeded jobs as seen so only future completions show in the badge
      markAllAsSeen()
      return
    }

    // Subsequent polls: detect transitions
    const newly: Notification[] = []
    for (const job of jobs) {
      const prevStatus = previousStatuses.current.get(job.id)
      if (
        job.status === 'completed' &&
        prevStatus !== undefined &&
        prevStatus !== 'completed'
      ) {
        const jobType = (job.target_approach ?? 'deep_research') as UsageType
        const displayInfo = FEATURE_DISPLAY_INFO[jobType]
        const notification: Notification = {
          jobId: job.id,
          title: job.title || displayInfo?.name || 'Job',
          jobType,
          completedAt: job.completed_at || job.updated_at,
          resultPath: getResultPath(job),
        }
        addNotification(notification)
        newly.push(notification)
      }
    }

    previousStatuses.current = currentMap
    newlyCompletedRef.current = newly
  }, [jobs, addNotification])

  return { newlyCompleted: newlyCompletedRef.current }
}
