import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  jobId: string
  title: string
  jobType: string
  completedAt: string
  resultPath: string
}

interface NotificationsState {
  notifications: Notification[]
  seenJobIds: string[]
  shownToastJobIds: string[]
  panelOpen: boolean
  ownerUserId: string | null
}

interface NotificationsActions {
  addNotification: (notification: Notification) => void
  markAllAsSeen: () => void
  markToastShown: (jobId: string) => void
  clearAll: () => void
  togglePanel: () => void
  closePanel: () => void
  syncUserContext: (userId: string | null) => void
}

export const useNotificationsStore = create<NotificationsState & NotificationsActions>()(
  persist(
    (set, get) => ({
      notifications: [],
      seenJobIds: [],
      shownToastJobIds: [],
      panelOpen: false,
      ownerUserId: null,

      addNotification: (notification) => {
        const state = get()
        // Dedup by jobId
        if (state.notifications.some((n) => n.jobId === notification.jobId)) return

        const updated = [notification, ...state.notifications]
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 50)

        set({ notifications: updated })
      },

      markAllAsSeen: () => {
        const state = get()
        const allJobIds = state.notifications.map((n) => n.jobId)
        set({ seenJobIds: allJobIds })
      },

      markToastShown: (jobId) => {
        const state = get()
        if (state.shownToastJobIds.includes(jobId)) return
        set({ shownToastJobIds: [...state.shownToastJobIds, jobId] })
      },

      clearAll: () => {
        set({
          notifications: [],
          seenJobIds: [],
          shownToastJobIds: [],
        })
      },

      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
      closePanel: () => set({ panelOpen: false }),

      syncUserContext: (userId) => {
        const state = get()
        if (state.ownerUserId !== userId) {
          set({
            notifications: [],
            seenJobIds: [],
            shownToastJobIds: [],
            panelOpen: false,
            ownerUserId: userId,
          })
        }
      },
    }),
    {
      name: 'notifications-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        seenJobIds: state.seenJobIds,
        shownToastJobIds: state.shownToastJobIds,
        ownerUserId: state.ownerUserId,
      }),
    }
  )
)

export function selectUnseenCount(state: NotificationsState): number {
  const seenSet = new Set(state.seenJobIds)
  return state.notifications.filter((n) => !seenSet.has(n.jobId)).length
}
