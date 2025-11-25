import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Jobs UI State Store
 * Only holds UI state (filters, selected items, etc.)
 * Server data is managed by TanStack Query via use-jobs.ts hooks
 */

interface JobsUIState {
  // UI-only state
  filters: {
    status?: string
    search?: string
  }
  selectedJobId: string | null
}

interface JobsUIActions {
  setFilters: (filters: Partial<JobsUIState['filters']>) => void
  setSelectedJobId: (id: string | null) => void
  clearFilters: () => void
}

export const useJobsStore = create<JobsUIState & JobsUIActions>()(
  persist(
    (set) => ({
      filters: {},
      selectedJobId: null,

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),

      setSelectedJobId: (id) => set({ selectedJobId: id }),

      clearFilters: () => set({ filters: {} }),
    }),
    {
      name: 'jobs-ui-storage',
      partialize: (state) => ({
        filters: state.filters,
        // Don't persist selectedJobId
      }),
    }
  )
)
