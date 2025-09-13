"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { JobDetails } from "@/components/jobs/job-details"
import { JobProgress } from "@/components/jobs/job-progress"
import { JobLogs } from "@/components/jobs/job-logs"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, RefreshCw, Download, Eye } from "lucide-react"
import Link from "next/link"

interface JobData {
  id: string
  title: string
  description: string
  contentType: string
  tone: string
  targetAudience: string
  keywords: string[]
  additionalInstructions: string
  status: "pending" | "processing" | "completed" | "failed"
  createdAt: string
  updatedAt: string
  createdBy: string
  progress: number
  steps: Array<{
    id: string
    name: string
    status: "pending" | "processing" | "completed" | "failed"
    startTime?: string
    endTime?: string
    duration?: number
  }>
  logs: Array<{
    id: string
    timestamp: string
    level: "info" | "warning" | "success" | "error"
    message: string
    details?: string
  }>
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [job, setJob] = useState<JobData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    // Mock job data - replace with real API call
    const mockJob: JobData = {
      id: params.id,
      title: "Blog Post: AI in Marketing",
      description:
        "Create a comprehensive blog post about the impact of AI on modern marketing strategies, including practical examples and future predictions.",
      contentType: "blog-post",
      tone: "professional",
      targetAudience: "Marketing professionals and business owners",
      keywords: ["AI", "marketing", "automation", "strategy", "digital transformation"],
      additionalInstructions: "Include real-world case studies and actionable insights. Target 1500-2000 words.",
      status: "processing",
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-01-15T10:35:00Z",
      createdBy: user.id,
      progress: 65,
      steps: [
        {
          id: "1",
          name: "Content Analysis",
          status: "completed",
          startTime: "2024-01-15T10:30:00Z",
          endTime: "2024-01-15T10:31:30Z",
          duration: 90,
        },
        {
          id: "2",
          name: "Research & Data Gathering",
          status: "completed",
          startTime: "2024-01-15T10:31:30Z",
          endTime: "2024-01-15T10:33:45Z",
          duration: 135,
        },
        {
          id: "3",
          name: "Content Generation",
          status: "processing",
          startTime: "2024-01-15T10:33:45Z",
        },
        {
          id: "4",
          name: "Quality Review",
          status: "pending",
        },
        {
          id: "5",
          name: "Final Optimization",
          status: "pending",
        },
      ],
      logs: [
        {
          id: "1",
          timestamp: "2024-01-15T10:30:00Z",
          level: "info",
          message: "Pipeline started successfully",
          details: "Initializing AI content generation pipeline with provided parameters",
        },
        {
          id: "2",
          timestamp: "2024-01-15T10:31:30Z",
          level: "success",
          message: "Content analysis completed",
          details: "Successfully analyzed content requirements and target audience",
        },
        {
          id: "3",
          timestamp: "2024-01-15T10:33:45Z",
          level: "info",
          message: "Starting content generation phase",
          details: "Using GPT-4 model for high-quality content creation",
        },
        {
          id: "4",
          timestamp: "2024-01-15T10:35:00Z",
          level: "info",
          message: "Content generation in progress",
          details: "Generated 850 words so far, targeting 1500-2000 words total",
        },
      ],
    }

    setJob(mockJob)
    setIsLoading(false)

    // Start polling if job is processing
    if (mockJob.status === "processing") {
      setIsPolling(true)
      const interval = setInterval(() => {
        // Mock progress updates
        setJob((prev) => {
          if (!prev || prev.status !== "processing") return prev

          const newProgress = Math.min(prev.progress + Math.random() * 10, 100)
          const newStatus = newProgress >= 100 ? "completed" : "processing"

          return {
            ...prev,
            progress: newProgress,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          }
        })
      }, 3000)

      return () => {
        clearInterval(interval)
        setIsPolling(false)
      }
    }
  }, [user, router, params.id])

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested job could not be found.</p>
            <Link href="/dashboard">
              <Button>Return to Dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Job Details</h1>
                <p className="text-muted-foreground">Monitor your AI content generation progress</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Auto-refreshing
                </div>
              )}
              {job.status === "completed" && (
                <>
                  <Link href={`/results/${job.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <JobDetails job={job} />
              <JobLogs logs={job.logs} />
            </div>
            <div>
              <JobProgress
                steps={job.steps}
                overallProgress={job.progress}
                currentStep={job.steps.find((s) => s.status === "processing")?.id}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
