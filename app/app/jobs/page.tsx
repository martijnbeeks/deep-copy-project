"use client"

import { useRequireAuth } from "@/hooks/use-require-auth"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useMarketingAngles, useInvalidateMarketingAngles } from "@/lib/hooks/use-jobs"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { Job } from "@/lib/db/types"
import { isProcessingStatus } from "@/lib/utils/job-status"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { JobCardSkeleton } from "@/components/ui/skeleton-loaders"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Eye, Search, Filter, Plus, FileText, AlertCircle, Menu, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function MarketingAnglesPage() {
  const { user, isReady } = useRequireAuth()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Get filters from UI store
  const { filters, setFilters } = useJobsStore()

  // Use TanStack Query for data fetching with filters
  const { data: marketingAngles = [], isLoading, error, refetch } = useMarketingAngles({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchTerm || undefined
  })
  const invalidateMarketingAngles = useInvalidateMarketingAngles()

  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()

  // Use simple polling for processing marketing angles (hits DeepCopy API directly)
  const { isPolling } = useSimplePolling(marketingAngles)

  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  // Filter marketing angles based on search and status
  const filteredMarketingAngles = marketingAngles.filter((marketingAngle: any) => {
    const matchesSearch = !searchTerm ||
      marketingAngle.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      marketingAngle.brand_info.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || marketingAngle.status === statusFilter

    return matchesSearch && matchesStatus
  })

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
                    <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-2/3 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                      <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
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
                <div className="h-10 w-32 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
              </div>
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
                  <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                </div>
              </div>
            </div>

            {/* Jobs list skeleton */}
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
                      <div className="h-8 w-24 bg-muted animate-pulse-slow rounded-md" />
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

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load marketing angles</h3>
              <p className="text-muted-foreground mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold">All Marketing Angles</h1>
                </div>
                <p className="text-sm md:text-base text-muted-foreground mt-1">Manage and monitor your AI marketing angle generation tasks</p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button className="text-sm md:text-base">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">New Marketing Angle</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </Link>

                <SidebarTrigger />
              </div>
            </div>

            <Card className="mb-4 md:mb-6">
              <CardHeader>
                <CardTitle>Filter Marketing Angles</CardTitle>
                <CardDescription>Search and filter your marketing angle generation tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search marketing angles..."
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

            {filteredMarketingAngles.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No marketing angles found"
                description={
                  searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Create your first AI marketing angle to get started"
                }
                action={{
                  label: "Create New Marketing Angle",
                  onClick: () => router.push("/dashboard"),
                }}
              />
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filteredMarketingAngles.map((marketingAngle: any) => (
                  <Card key={marketingAngle.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h3 className="text-base md:text-lg font-semibold break-words">{marketingAngle.title}</h3>
                            {getStatusBadge(marketingAngle.status)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm text-muted-foreground">
                            <span className="capitalize">{marketingAngle.template?.name || 'AI Generated'}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{new Date(marketingAngle.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/jobs/${marketingAngle.id}`}>
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
  const normalizedStatus = status?.toLowerCase()

  const variants = {
    completed: "default",
    processing: "secondary",
    running: "secondary",
    pending: "outline",
    submitted: "outline",
    failed: "destructive",
  } as const

  const variant = variants[normalizedStatus as keyof typeof variants] || "outline"

  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  )
}
