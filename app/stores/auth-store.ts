import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/lib/db/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isAdmin: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  refreshAdminStatus: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true, // Start as loading to prevent premature redirects
      error: null,
      isAdmin: false,

      setUser: (user, isAdmin = false) => set({ user, isAuthenticated: !!user, isAdmin }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Login failed')
          }

          const { user, isAdmin } = await response.json()
          set({ user, isAuthenticated: true, isLoading: false, isAdmin: isAdmin || false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false 
          })
          throw error
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null, isAdmin: false })
        // Clear from server
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        // Clear persisted storage
        localStorage.removeItem('auth-storage')
      },

      refreshAdminStatus: async () => {
        const state = get()
        if (!state.user?.email || !state.isAuthenticated) {
          return
        }

        try {
          const response = await fetch('/api/organizations/check-admin', {
            headers: {
              'Authorization': `Bearer ${state.user.email}`,
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({ isAdmin: data.isAdmin || false })
          }
        } catch (error) {
          // Silently fail - admin status remains unchanged
          console.error('Error refreshing admin status:', error)
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user ? {
          id: state.user.id,
          email: state.user.email,
          name: state.user.name,
          created_at: state.user.created_at,
          updated_at: state.user.updated_at,
          // Don't persist sensitive data
        } : null,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin
      }),
      onRehydrateStorage: () => (state) => {
        // Set loading to false after rehydration is complete
        if (state) {
          state.isLoading = false
        }
      },
    }
  )
)
