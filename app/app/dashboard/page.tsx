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
import { FileText, AlertCircle, Zap, Eye, Search, Filter, Calendar, ExternalLink } from "lucide-react"
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
      router.push("/login")
    }
  }, [isAuthenticated, user, router])

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
                  <Card className="bg-card border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col items-center justify-center text-center py-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                          <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-lg font-bold text-foreground mb-2">
                          Create New Content
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                          Start generating AI-powered content in seconds
                        </p>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>

                {filteredJobs.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <Link href="/create" className="block">
                      <Card className="bg-card border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col items-center justify-center text-center py-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                              <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle className="text-lg font-bold text-foreground mb-2">
                              Create New Content
                            </CardTitle>
                            <p className="text-muted-foreground text-sm">
                              Start generating AI-powered content in seconds
                            </p>
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  </div>
                ) : (
                  filteredJobs.map((job: any) => (
                    <Card
                      key={job.id}
                      className="bg-card/80 border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-primary/50"
                      onClick={() => router.push(`/results/${job.id}`)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base font-semibold text-foreground line-clamp-2 mb-2">
                              {job.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusBadge(job.status)}
                            </div>
                          </div>
                          <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center group-hover:bg-accent/30 transition-colors flex-shrink-0">
                            <Eye className="h-4 w-4 text-accent" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-3 w-3 flex-shrink-0" />
                            <span className="capitalize truncate">{job.template?.name || 'AI Generated'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          </div>
                          {job.sales_page_url && (
                            <a
                              href={job.sales_page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-2 px-2 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-md text-xs font-medium text-primary hover:text-primary/90 transition-colors group/link w-full"
                              title={job.sales_page_url}
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                              <span className="truncate flex-1">{job.sales_page_url}</span>
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
