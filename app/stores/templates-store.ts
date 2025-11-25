import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Templates UI State Store
 * Only holds UI state (selected template, filters, etc.)
 * Server data is managed by TanStack Query via use-templates.ts hooks
 */

interface TemplatesUIState {
  // UI-only state
  selectedTemplateId: string | null
  filters: {
    category?: string
    search?: string
  }
}

interface TemplatesUIActions {
  setSelectedTemplateId: (id: string | null) => void
  setFilters: (filters: Partial<TemplatesUIState['filters']>) => void
  clearFilters: () => void
}

export const useTemplatesStore = create<TemplatesUIState & TemplatesUIActions>()(
  persist(
    (set) => ({
      selectedTemplateId: null,
      filters: {},

      setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),

      clearFilters: () => set({ filters: {} }),
    }),
    {
      name: 'templates-ui-storage',
      partialize: (state) => ({
        filters: state.filters,
        // Don't persist selectedTemplateId
      }),
    }
  )
)
