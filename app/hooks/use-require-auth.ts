"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Hook to require authentication for a page
 * Redirects to login if user is not authenticated
 * Returns auth state and a ready flag
 */
export function useRequireAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()
  
  useEffect(() => {
    // Don't redirect if we're still loading the auth state (during hydration)
    if (isLoading) return
    
    if (!isAuthenticated || !user) {
      router.replace("/login")
    }
  }, [isAuthenticated, user, router, isLoading])
  
  return { 
    user, 
    isAuthenticated, 
    isReady: !isLoading && isAuthenticated && !!user 
  }
}

