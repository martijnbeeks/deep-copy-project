"use client"

import { LoginForm } from "@/components/auth/login-form"
import { WaitlistForm } from "@/components/auth/waitlist-form"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

function LoginPageContent() {
  const { user, isAuthenticated, login, isLoading, error } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showWaitlist, setShowWaitlist] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, user, router])

  useEffect(() => {
    // Check if waitlist query parameter is present
    const waitlistParam = searchParams.get('waitlist')
    if (waitlistParam === 'true') {
      setShowWaitlist(true)
    }
  }, [searchParams])

  if (isAuthenticated && user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Main content container */}
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left side - Heading */}
            <div className="text-center lg:text-left space-y-6 lg:space-y-8">
              <div className="space-y-4 lg:space-y-6">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                  <span className="block">Turn</span>
                  <span className="block text-primary">Deep Research</span>
                  <span className="block">Into</span>
                  <span className="block">High-Converting</span>
                  <span className="block text-primary">Pre-Landers</span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Transform customer insights into conversion-optimized Pre-Landers with AI-powered deep research.
                </p>
              </div>
            </div>

            {/* Right side - Login Form or Waitlist Form */}
            <div className="flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-md">
                {showWaitlist ? (
                  <>
                    <WaitlistForm onSuccess={() => setShowWaitlist(false)} />
                    <div className="mt-4 text-center">
                      <Button 
                        variant="ghost" 
                        className="text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => setShowWaitlist(false)}
                      >
                        Already have an account? Sign in
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <LoginForm onLogin={login} isLoading={isLoading} error={error || undefined} />
                    <div className="mt-4 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Don't have an account?</p>
                      <Button 
                        variant="outline" 
                        className="w-full border-2 border-border bg-background hover:bg-muted hover:border-primary/50 text-foreground font-medium h-11"
                        onClick={() => setShowWaitlist(true)}
                      >
                        Join Waitlist
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mx-auto"></div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

