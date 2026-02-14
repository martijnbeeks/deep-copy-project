"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { useNotificationsStore } from '@/stores/notifications-store'
import { NotificationItem } from './notification-item'

export function NotificationPopup() {
  const panelOpen = useNotificationsStore((s) => s.panelOpen)
  const notifications = useNotificationsStore((s) => s.notifications)
  const seenJobIds = useNotificationsStore((s) => s.seenJobIds)
  const closePanel = useNotificationsStore((s) => s.closePanel)
  const markAllAsSeen = useNotificationsStore((s) => s.markAllAsSeen)
  const clearAll = useNotificationsStore((s) => s.clearAll)
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  // Mark all as seen when panel opens
  useEffect(() => {
    if (panelOpen) {
      markAllAsSeen()
    }
  }, [panelOpen, markAllAsSeen])

  // Click-outside-to-close
  useEffect(() => {
    if (!panelOpen) return

    const handler = (e: MouseEvent) => {
      // Use setTimeout(0) to avoid the toggle click immediately closing
      setTimeout(() => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          closePanel()
        }
      }, 0)
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen, closePanel])

  if (!panelOpen) return null

  const seenSet = new Set(seenJobIds)

  return (
    <div
      ref={panelRef}
      className="fixed bottom-16 left-16 z-[60] w-80 bg-background border border-border rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={closePanel}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.jobId}
                notification={notification}
                isSeen={seenSet.has(notification.jobId)}
                onClick={() => {
                  closePanel()
                  router.push(notification.resultPath)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
