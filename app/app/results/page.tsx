"use client"

import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ResultCardSkeleton } from "@/components/ui/skeleton-loaders"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Eye, Search, Filter, Download, BarChart3, FileText, Calendar, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function ResultsPage() {
  const { user } = useAuthStore()
  const { jobs, isLoading, error, fetchJobs } = useJobsStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [filteredResults, setFilteredResults] = useState(jobs.filter(job => job.status === 'completed'))
  const [searchTerm, setSearchTerm] = useState("")
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    fetchJobs()
  }, [user, router])

  useEffect(() => {
    const completedJobs = jobs.filter(job => job.status === 'completed')
    let filtered = completedJobs

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.brand_info.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (contentTypeFilter !== "all") {
      filtered = filtered.filter((job) => job.template?.category === contentTypeFilter)
    }

    setFilteredResults(filtered)
  }, [jobs, searchTerm, contentTypeFilter])

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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-6 border rounded-lg bg-card space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded" />
                      <div className="h-4 w-1/2 bg-muted animate-pulse-slow rounded" />
                    </div>
                    <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-5/6 bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
                      <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                    </div>
                    <div className="h-8 w-8 bg-muted animate-pulse-slow rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            {/* Header skeleton */}
            <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <div className="h-8 w-48 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mt-1" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-40 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
              </div>
            </div>

            {/* Stats overview skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-4 w-4 bg-muted animate-pulse-slow rounded-md" />
                  </div>
                  <div className="h-8 w-12 bg-muted animate-pulse-slow rounded-md mb-1" />
                  <div className="h-3 w-24 bg-muted animate-pulse-slow rounded-md" />
                </div>
              ))}
            </div>

            {/* Filter card skeleton */}
            <div className="mb-4 md:mb-6">
              <div className="border rounded-lg p-6">
                <div className="h-6 w-32 bg-muted animate-pulse-slow rounded-md mb-2" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mb-4" />
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="h-10 w-full bg-muted animate-pulse-slow rounded-md" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                    <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            {/* Results list skeleton */}
            <div className="grid gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-6 w-16 bg-muted animate-pulse-slow rounded-full" />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <div className="h-4 w-24 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-4 w-16 bg-muted animate-pulse-slow rounded-md" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-20 bg-muted animate-pulse-slow rounded-md" />
                      <div className="h-8 w-16 bg-muted animate-pulse-slow rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"} className="capitalize">
        {status}
      </Badge>
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
                <h1 className="text-2xl md:text-3xl font-bold">Content Results</h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">Browse and manage your generated content</p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button className="text-sm md:text-base">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Create New Content</span>
                    <span className="sm:hidden">Create</span>
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

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Results</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredResults.length}</div>
                  <p className="text-xs text-muted-foreground">Generated content pieces</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter(job => job.status === 'completed').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed jobs</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.length > 0 ? Math.round((jobs.filter(job => job.status === 'completed').length / jobs.length) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter((job) => new Date(job.created_at).getMonth() === new Date().getMonth()).length}
                  </div>
                  <p className="text-xs text-muted-foreground">New jobs this month</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-4 md:mb-6">
              <CardHeader>
                <CardTitle>Filter Results</CardTitle>
                <CardDescription>Search and filter your generated content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search results..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                    <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Content type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="blog-post">Blog Post</SelectItem>
                        <SelectItem value="social-media">Social Media</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="product-description">Product Description</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredResults.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No results found"
                description={
                  searchTerm || contentTypeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Generate your first content to see results here"
                }
                action={{
                  label: "Create Content",
                  onClick: () => router.push("/dashboard"),
                }}
              />
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filteredResults.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h3 className="text-base md:text-lg font-semibold break-words">{job.title}</h3>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm text-muted-foreground">
                            <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>Status: {job.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/results/${job.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Download className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Download</span>
                              <span className="sm:hidden">DL</span>
                            </Button>
                          </Link>
                          <Link href={`/results/${job.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Eye className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">View</span>
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
