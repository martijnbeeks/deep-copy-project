"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNotificationDetector } from '@/hooks/use-notification-detector'
import { useNotificationsStore } from '@/stores/notifications-store'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

export function NotificationBell() {
  const { newlyCompleted } = useNotificationDetector()
  const shownToastJobIds = useNotificationsStore((s) => s.shownToastJobIds)
  const markToastShown = useNotificationsStore((s) => s.markToastShown)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (newlyCompleted.length === 0) return

    for (const notification of newlyCompleted) {
      if (shownToastJobIds.includes(notification.jobId)) continue

      markToastShown(notification.jobId)

      toast({
        title: 'Job completed',
        description: notification.title,
        action: (
          <ToastAction
            altText="View results"
            onClick={() => router.push(notification.resultPath)}
          >
            View results
          </ToastAction>
        ),
      })
    }
  }, [newlyCompleted, shownToastJobIds, markToastShown, toast, router])

  return null
}
