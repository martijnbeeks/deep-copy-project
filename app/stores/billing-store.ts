import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BillingState {
  organizationId: string | null
  currentUsage: number
  creditLimit: number
  planId: string | null
  isLoading: boolean
  error: string | null
  lastFetched: number | null
}

interface BillingActions {
  setOrganizationId: (id: string | null) => void
  fetchBillingStatus: (userEmail: string, force?: boolean) => Promise<void>
  updateUsage: (usage: number) => void
  reset: () => void
}

export const useBillingStore = create<BillingState & BillingActions>()(
  persist(
    (set, get) => ({
      organizationId: null,
      currentUsage: 0,
      creditLimit: 0,
      planId: null,
      isLoading: false,
      error: null,
      lastFetched: null,

      setOrganizationId: (id) => set({ organizationId: id }),

      fetchBillingStatus: async (userEmail, force = false) => {
        const state = get()
        
        // Only fetch if forced or if it's been more than 5 minutes since last fetch
        const now = Date.now()
        if (!force && state.lastFetched && now - state.lastFetched < 5 * 60 * 1000) {
          return
        }

        set({ isLoading: true, error: null })

        try {
          // 1. Fetch organizations if we don't have an ID
          let orgId = state.organizationId
          if (!orgId) {
            const orgsResponse = await fetch('/api/organizations/my-organizations', {
              headers: { 'Authorization': `Bearer ${userEmail}` }
            })
            
            if (!orgsResponse.ok) throw new Error('Failed to fetch organizations')
            
            const { organizations } = await orgsResponse.json()
            if (organizations && organizations.length > 0) {
              orgId = organizations[0].id
              set({ organizationId: orgId })
            } else {
              set({ isLoading: false, lastFetched: now })
              return
            }
          }

          // 2. Fetch billing status
          const statusResponse = await fetch(`/api/billing/status?organizationId=${orgId}`, {
            headers: { 'Authorization': `Bearer ${userEmail}` }
          })
          
          if (statusResponse.ok) {
            const data = await statusResponse.json()
            set({ 
              currentUsage: data.currentUsage || 0,
              creditLimit: data.creditLimit || 0,
              planId: data.planId || 'free',
              isLoading: false,
              lastFetched: now,
              error: null
            })
          } else {
            throw new Error('Failed to fetch billing status')
          }
        } catch (err: any) {
          console.error('Error in fetchBillingStatus:', err)
          set({ 
            error: err.message, 
            isLoading: false,
            lastFetched: now 
          })
        }
      },

      updateUsage: (usage) => set({ currentUsage: usage }),

      reset: () => set({
        organizationId: null,
        currentUsage: 0,
        creditLimit: 0,
        planId: null,
        isLoading: false,
        error: null,
        lastFetched: null
      })
    }),
    {
      name: 'billing-storage',
      partialize: (state) => ({
        organizationId: state.organizationId,
        currentUsage: state.currentUsage,
        creditLimit: state.creditLimit,
        planId: state.planId,
        lastFetched: state.lastFetched
      })
    }
  )
)
