import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/lib/db/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
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

          const { user } = await response.json()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false 
          })
          throw error
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null })
        // Clear from server
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        // Clear persisted storage
        localStorage.removeItem('auth-storage')
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
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)
