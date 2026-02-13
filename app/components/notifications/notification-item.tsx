"use client"

import { Search, FileText, Image, Layout } from 'lucide-react'
import { getRelativeTime } from '@/lib/utils/notification-helpers'
import { FEATURE_DISPLAY_INFO } from '@/lib/constants/job-credits'
import type { Notification } from '@/stores/notifications-store'
import type { UsageType } from '@/lib/db/types'

const JOB_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  deep_research: Search,
  pre_lander: FileText,
  static_ads: Image,
  templates_images: Layout,
}

interface NotificationItemProps {
  notification: Notification
  isSeen: boolean
  onClick: () => void
}

export function NotificationItem({ notification, isSeen, onClick }: NotificationItemProps) {
  const Icon = JOB_TYPE_ICONS[notification.jobType] ?? Search
  const displayInfo = FEATURE_DISPLAY_INFO[notification.jobType as UsageType]
  const typeLabel = displayInfo?.name ?? notification.jobType

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{typeLabel}</span>
          {!isSeen && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground">{getRelativeTime(notification.completedAt)}</p>
      </div>
    </button>
  )
}
