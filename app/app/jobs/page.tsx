"use client"

import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { Job } from "@/lib/db/types"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner, PageLoadingSpinner } from "@/components/ui/loading-spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Eye, Search, Filter, Plus, FileText, AlertCircle, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function JobsPage() {
  const { user } = useAuthStore()
  const { jobs, isLoading, error, fetchJobs } = useJobsStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [filteredJobs, setFilteredJobs] = useState(jobs)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    fetchJobs()
  }, [user, router, fetchJobs])

  useEffect(() => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.brand_info.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter)
    }

    setFilteredJobs(filtered)
  }, [jobs, searchTerm, statusFilter])

  if (!user) {
    return <PageLoadingSpinner text="Loading jobs..." />
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your jobs..." />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load jobs</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold">All Jobs</h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">Manage and monitor your AI content generation tasks</p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button className="text-sm md:text-base">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">New Job</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </Link>
                
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

            <Card className="mb-4 md:mb-6">
              <CardHeader>
                <CardTitle>Filter Jobs</CardTitle>
                <CardDescription>Search and filter your content generation jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
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
              </CardContent>
            </Card>

            {filteredJobs.length === 0 ? (
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
                  onClick: () => router.push("/dashboard"),
                }}
              />
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
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
                            {job.progress !== undefined && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <span>{job.progress}% complete</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/jobs/${job.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Eye className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">View Details</span>
                              <span className="sm:hidden">View</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

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
