"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useJobsStore } from "@/stores/jobs-store"
import { JobWithTemplate } from "@/lib/db/types"

const getStatusIcon = (status: JobWithTemplate["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "processing":
      return <Clock className="h-4 w-4 text-blue-500" />
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

const getStatusBadge = (status: JobWithTemplate["status"]) => {
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

export function RecentJobs() {
  const { jobs } = useJobsStore()
  const recentJobs = jobs.slice(0, 5) // Show only the 5 most recent jobs

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Jobs</CardTitle>
        <CardDescription>Your latest AI content generation tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No jobs yet. Create your first AI content!</p>
            </div>
          ) : (
            recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <h4 className="font-medium">{job.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()} • {job.template?.name || 'Template'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(job.status)}
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
        {recentJobs.length > 0 && (
          <div className="mt-4 text-center">
            <Link href="/jobs">
              <Button variant="outline">View All Jobs</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
