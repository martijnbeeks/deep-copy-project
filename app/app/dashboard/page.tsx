"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, AlertCircle, Zap, Eye, Search, Filter, Calendar, ExternalLink, ArrowUp } from "lucide-react"
import { SalesPagePreview } from "@/components/sales-page-preview"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { useJobs, useCreateJob } from "@/lib/hooks/use-jobs"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { Job } from "@/lib/db/types"

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()

  // Use TanStack Query for data fetching
  const { data: jobs = [], isLoading, error: queryError, refetch } = useJobs()
  const createJobMutation = useCreateJob()

  // Use simple polling for processing jobs (hits DeepCopy API directly)
  const { isPolling } = useSimplePolling(jobs)

  // Count processing jobs (handle both uppercase and lowercase)
  const processingJobsCount = jobs.filter(job =>
    job.status?.toLowerCase() === 'submitted' ||
    job.status?.toLowerCase() === 'processing' ||
    job.status?.toLowerCase() === 'running' ||
    job.status?.toLowerCase() === 'pending'
  ).length

  // Log when jobs data changes
  useEffect(() => {
    const submittedJobs = jobs.filter(j => j.status?.toLowerCase() === 'submitted')
    const processingJobs = jobs.filter(j =>
      j.status?.toLowerCase() === 'processing' ||
      j.status?.toLowerCase() === 'running' ||
      j.status?.toLowerCase() === 'pending'
    )
    const completedJobs = jobs.filter(j => j.status?.toLowerCase() === 'completed')
    const failedJobs = jobs.filter(j => j.status?.toLowerCase() === 'failed')

    console.log(`📊 Dashboard: Jobs updated - ${jobs.length} total`)
    console.log(`  - Submitted: ${submittedJobs.length}`)
    console.log(`  - Processing: ${processingJobs.length}`)
    console.log(`  - Completed: ${completedJobs.length}`)
    console.log(`  - Failed: ${failedJobs.length}`)

    // Log ALL jobs with their statuses for debugging
    console.log(`📋 All jobs:`, jobs.map(j => ({ id: j.id, title: j.title, status: j.status })))

    if (submittedJobs.length > 0) {
      console.log(`📤 Submitted jobs:`, submittedJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }

    if (processingJobs.length > 0) {
      console.log(`🔄 Processing jobs:`, processingJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }

    if (failedJobs.length > 0) {
      console.log(`❌ Failed jobs:`, failedJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }
  }, [jobs])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace("/login")
    }
  }, [isAuthenticated, user, router])

  // Early return if not authenticated to prevent skeleton loader
  if (!isAuthenticated || !user) {
    return null
  }

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter((job: any) => {
    const matchesSearch = !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.brand_info.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || job.status === statusFilter

    return matchesSearch && matchesStatus
  })


  const getStatusBadge = (status: Job["status"]) => {
    const variants = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    } as const

    const statusColors = {
      completed: "bg-primary text-primary-foreground",
      processing: "bg-accent text-accent-foreground",
      pending: "bg-muted text-muted-foreground",
      failed: "bg-destructive text-destructive-foreground",
    }

    return (
      <Badge variant={variants[status]} className={`capitalize text-xs ${statusColors[status]}`}>
        {status}
      </Badge>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-64 border-r bg-card">
          <div className="p-6 space-y-4">
            <div className="h-8 w-32 bg-muted animate-pulse-slow rounded" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full bg-muted animate-pulse-slow rounded" />
              ))}
            </div>
          </div>
        </div>
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-48 bg-muted animate-pulse-slow rounded" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded" />
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse-slow rounded" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-6 border rounded-lg bg-card">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted animate-pulse-slow rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse-slow rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse-slow rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const handlePipelineSubmit = async (data: any) => {
    setError(null)

    try {
      const job = await createJobMutation.mutateAsync(data)

      toast({
        title: "Pipeline created successfully",
        description: "Your AI content generation has started.",
      })

      router.push(`/jobs/${job.job.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create pipeline"

      // Check if it's a duplicate job error
      if (errorMessage.includes('Duplicate job detected')) {
        setError('A job with this title was created recently. Please wait a moment or use a different title.')
        toast({
          title: "Duplicate job detected",
          description: "A job with this title was created recently. Please wait a moment or use a different title.",
          variant: "destructive",
        })
      } else {
        setError(errorMessage)
        toast({
          title: "Error creating pipeline",
          description: errorMessage,
          variant: "destructive",
        })
      }
    }
  }

  const scrollToTop = () => {
    const mainElement = document.querySelector('main')
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Welcome back, {user.name}!</p>
                </div>
              </div>
            </div>


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

            {/* All Jobs - Card Grid Layout */}
            <div className="space-y-6">
              {/* Search and Filter */}
              <Card className="bg-card/50 border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs by title or brand..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-background"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-10 bg-background">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Jobs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Create New Content Card - First Card */}
                <Link href="/create" className={filteredJobs.length === 0 ? "hidden" : "block"}>
                  <div className="relative cursor-pointer rounded-xl border-2 p-2 md:p-3 transition-all h-[280px] md:h-[320px] flex flex-col border-border bg-card hover:border-primary/50 hover:shadow-md">
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                        <Zap className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground mb-2">
                        Create New Content
                      </h3>
                      <p className="text-xs text-muted-foreground px-4">
                        Start generating AI-powered content in seconds
                      </p>
                    </div>
                  </div>
                </Link>

                {filteredJobs.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <Link href="/create" className="block">
                      <div className="relative cursor-pointer rounded-xl border-2 p-2 md:p-3 transition-all h-[280px] md:h-[320px] flex flex-col border-border bg-card hover:border-primary/50 hover:shadow-md">
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                            <Zap className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="font-semibold text-base text-foreground mb-2">
                            Create New Content
                          </h3>
                          <p className="text-xs text-muted-foreground px-4">
                            Start generating AI-powered content in seconds
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ) : (
                  filteredJobs.map((job: any) => (
                    <div
                      key={job.id}
                      className="relative cursor-pointer rounded-xl border-2 p-2 md:p-3 transition-all h-[280px] md:h-[320px] flex flex-col border-border bg-card hover:border-primary/50 hover:shadow-md"
                      onClick={() => router.push(`/avatars?jobId=${job.id}`)}
                    >
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-1.5 gap-1.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground break-words line-clamp-1">{job.title}</h3>
                          {job.template?.name && (
                            <p className="text-xs text-muted-foreground break-words line-clamp-1">
                              {job.template.name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {getStatusBadge(job.status)}
                        </div>
                      </div>

                      {/* Preview Area */}
                      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border">
                        {job.sales_page_url ? (
                          <div onClick={(e) => e.stopPropagation()} className="h-full">
                            <SalesPagePreview url={job.sales_page_url} jobId={job.id} className="w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center space-y-2 p-4">
                              <FileText className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                              <p className="text-xs text-muted-foreground">No preview available</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center justify-between mt-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/avatars?jobId=${job.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer with Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border ml-16">
            <div className="px-4 py-2 md:px-6 md:py-3">
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={() => router.push('/create')}
                  size="default"
                  className="flex-1 max-w-xs"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate New Content
                </Button>
                <Button
                  onClick={scrollToTop}
                  variant="outline"
                  size="default"
                  className="flex-shrink-0"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Go to Top
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
