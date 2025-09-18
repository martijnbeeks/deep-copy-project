"use client"

import { useAuthStore } from "@/stores/auth-store"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { InitialLoading } from "@/components/ui/initial-loading"

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    // Small delay to prevent flash of content
    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        setIsRedirecting(true)
        router.push("/dashboard")
      } else {
        setIsRedirecting(true)
        router.push("/login")
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isAuthenticated, user, router])

  // Show optimized loading page immediately instead of a spinner
  if (!isRedirecting) {
    return <InitialLoading />
  }

  return null
}
