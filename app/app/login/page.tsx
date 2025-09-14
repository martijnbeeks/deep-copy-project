"use client"

import { LoginForm } from "@/components/auth/login-form"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth-store"

export default function LoginPage() {
  const { user, isAuthenticated, login, isLoading, error } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, user, router])

  if (isAuthenticated && user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">AI Copywriting</h1>
          <p className="text-muted-foreground">Professional content creation platform</p>
        </div>
        <LoginForm onLogin={login} isLoading={isLoading} error={error || undefined} />
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Demo credentials: demo@example.com / password
        </div>
      </div>
    </div>
  )
}
