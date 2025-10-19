"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { PipelineForm } from "@/components/dashboard/pipeline-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { BarChart3, FileText, Clock, TrendingUp, AlertCircle, Zap, Menu, ChevronLeft, ChevronRight, Eye, Search, Filter, Calendar, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useJobs, useCreateJob, useInvalidateJobs } from "@/lib/hooks/use-jobs"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { Job } from "@/lib/db/types"

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()

  // Use TanStack Query for data fetching
  const { data: jobs = [], isLoading, error: queryError, refetch } = useJobs()
  const createJobMutation = useCreateJob()
  const invalidateJobs = useInvalidateJobs()

  // Use simple polling for processing jobs (hits DeepCopy API directly)
  const { isPolling } = useSimplePolling(jobs)
  
  // Count processing jobs (handle both uppercase and lowercase)
  const processingJobsCount = jobs.filter(job => 
    job.status?.toLowerCase() === 'submitted' || 
    job.status?.toLowerCase() === 'processing' || 
    job.status?.toLowerCase() === 'pending'
  ).length
  
  // Log when jobs data changes
  useEffect(() => {
    const submittedJobs = jobs.filter(j => j.status?.toLowerCase() === 'submitted')
    const processingJobs = jobs.filter(j => j.status?.toLowerCase() === 'processing' || j.status?.toLowerCase() === 'pending')
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

  // Filter completed jobs for results
  const completedJobs = jobs.filter((job: any) => job.status === 'completed')

  const getStatusBadge = (status: Job["status"]) => {
    const variants = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    } as const

    return (
      <Badge variant={variants[status]} className="capitalize">
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
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
                  <p className="text-sm md:text-base text-muted-foreground mt-1">Welcome back, {user.name}! Create amazing content with AI.</p>
                </div>
                <div className="flex gap-2">
                  {/* Refresh button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="h-8 w-8 p-0"
                    title={isPolling ? "Polling active - jobs updating automatically" : "Refresh jobs"}
                  >
                    <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                  </Button>
                  
                  {/* Mobile menu button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 p-0 md:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  
                  {/* Desktop collapse button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 p-0 hidden md:flex"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{jobs.length}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {isPolling && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600">Polling</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter(job => job.status === 'pending' || job.status === 'processing').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPolling ? 'Auto-updating every 5s' : 'Currently processing'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter(job => job.status === 'completed').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {jobs.length > 0 ? Math.round((jobs.filter(job => job.status === 'completed').length / jobs.length) * 100) : 0}% success rate
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Templates</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">Available templates</p>
                </CardContent>
              </Card>
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

            {/* Quick Actions */}
            <Card className="mb-6">
                 <CardHeader>
                   <CardTitle>Quick Actions</CardTitle>
                   <CardDescription>Get started with creating new content</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="flex flex-col sm:flex-row gap-4">
                     <Link href="/create" className="flex-1">
                       <Button className="w-full h-16 text-lg">
                         <Zap className="h-5 w-5 mr-2" />
                         Create New Content
                       </Button>
                     </Link>
                </div>
              </CardContent>
            </Card>

            {/* Jobs List and Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Jobs List */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>All Jobs</CardTitle>
                  <CardDescription>Manage and monitor your AI content generation tasks</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search jobs..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="h-4 w-4 mr-2" />
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

                  {/* Jobs List */}
                  {filteredJobs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <EmptyState
                        icon={FileText}
                        title="No jobs found"
                        description={
                          searchTerm || statusFilter !== "all"
                            ? "Try adjusting your search or filter criteria"
                            : "Create your first AI content generation job to get started"
                        }
                        action={{
                          label: "Create New Job",
                          onClick: () => router.push("/create"),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30 max-h-96">
                      {filteredJobs.map((job: any) => (
                        <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/jobs/${job.id}`)}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                  <h3 className="text-base md:text-lg font-semibold truncate">{job.title}</h3>
                                  {getStatusBadge(job.status)}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm text-muted-foreground">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                  <Eye className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">View Details</span>
                                  <span className="sm:hidden">View</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results Grid */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Recent Results</CardTitle>
                  <CardDescription>View your completed AI-generated content</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {completedJobs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <EmptyState
                        icon={BarChart3}
                        title="No results yet"
                        description="Complete some jobs to see your AI-generated content here"
                        action={{
                          label: "Create New Job",
                          onClick: () => router.push("/create"),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30 max-h-96">
                      {completedJobs.slice(0, 6).map((job: any) => (
                        <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/results/${job.id}`)}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                  <h4 className="text-base md:text-lg font-semibold truncate">{job.title}</h4>
                                  <Badge variant="default" className="capitalize text-xs">
                                    completed
                                  </Badge>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm text-muted-foreground">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                  <Eye className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">View Results</span>
                                  <span className="sm:hidden">View</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
             </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
