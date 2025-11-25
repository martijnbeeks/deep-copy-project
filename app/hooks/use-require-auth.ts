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
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  
  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace("/login")
    }
  }, [isAuthenticated, user, router])
  
  return { 
    user, 
    isAuthenticated, 
    isReady: isAuthenticated && !!user 
  }
}

