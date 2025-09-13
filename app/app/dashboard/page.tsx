"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { PipelineForm } from "@/components/dashboard/pipeline-form"
import { RecentJobs } from "@/components/dashboard/recent-jobs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageLoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BarChart3, FileText, Clock, TrendingUp, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  if (!user) {
    return <PageLoadingSpinner text="Loading dashboard..." />
  }

  const handlePipelineSubmit = async (data: any) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Mock API call - replace with real implementation
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate occasional failures for demo
          if (Math.random() > 0.8) {
            reject(new Error("Failed to create pipeline. Please try again."))
          } else {
            resolve(true)
          }
        }, 2000)
      })

      toast({
        title: "Pipeline created successfully",
        description: "Your AI content generation has started.",
      })

      // Simulate job creation and redirect to job detail
      const jobId = Math.random().toString(36).substr(2, 9)
      router.push(`/jobs/${jobId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create pipeline"
      setError(errorMessage)
      toast({
        title: "Error creating pipeline",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user.name}! Create amazing content with AI.</p>
            </div>

            {/* Stats Cards with Error Handling */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">+3 from last week</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">Currently processing</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">21</div>
                  <p className="text-xs text-muted-foreground">87.5% success rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Words Generated</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45.2K</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
            </div>

            {/* Error Display */}
            {error && (
              <Card className="mb-6 border-destructive">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <PipelineForm onSubmit={handlePipelineSubmit} isLoading={isSubmitting} />
              </ErrorBoundary>
              <ErrorBoundary>
                <RecentJobs />
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
