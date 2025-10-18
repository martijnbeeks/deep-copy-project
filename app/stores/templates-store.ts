import { create } from 'zustand'
import { Template } from '@/lib/db/types'

interface TemplatesState {
  templates: Template[]
  selectedTemplate: Template | null
  isLoading: boolean
  error: string | null
  filters: {
    category?: string
    search?: string
  }
}

interface TemplatesActions {
  setTemplates: (templates: Template[]) => void
  setSelectedTemplate: (template: Template | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFilters: (filters: Partial<TemplatesState['filters']>) => void
  fetchTemplates: () => Promise<void>
  preloadTemplates: () => Promise<void>
  getTemplateById: (id: string) => Template | undefined
}

export const useTemplatesStore = create<TemplatesState & TemplatesActions>((set, get) => ({
  templates: [],
  selectedTemplate: null,
  isLoading: false,
  error: null,
  filters: {},

  setTemplates: (templates) => set({ templates }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (filters) => set((state) => ({ 
    filters: { ...state.filters, ...filters } 
  })),

  fetchTemplates: async () => {
    const { templates, isLoading } = get()
    
    // Don't fetch if already loading or if templates are already loaded
    if (isLoading || templates.length > 0) {
      return
    }
    
    set({ isLoading: true, error: null })
    try {
      const { filters } = get()
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      
      const { templates } = await response.json()
      set({ templates, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
        isLoading: false 
      })
    }
  },

  preloadTemplates: async () => {
    const { templates, isLoading } = get()
    
    // Don't preload if already loading or if templates are already loaded
    if (isLoading || templates.length > 0) {
      return
    }
    
    // Start loading in background without blocking UI
    try {
      const response = await fetch('/api/templates')
      if (response.ok) {
        const { templates } = await response.json()
        set({ templates })
      }
    } catch (error) {
      // Silently fail for preload - will be handled by regular fetchTemplates
    }
  },

  getTemplateById: (id: string) => {
    return get().templates.find(template => template.id === id)
  },
}))
