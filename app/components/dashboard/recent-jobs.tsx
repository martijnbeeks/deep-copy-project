"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Job {
  id: string
  title: string
  contentType: string
  status: "pending" | "processing" | "completed" | "failed"
  createdAt: string
  progress?: number
}

const mockJobs: Job[] = [
  {
    id: "1",
    title: "Blog Post: AI in Marketing",
    contentType: "blog-post",
    status: "completed",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    title: "Social Media Campaign",
    contentType: "social-media",
    status: "processing",
    createdAt: "2024-01-15T09:15:00Z",
    progress: 65,
  },
  {
    id: "3",
    title: "Product Description: Smart Watch",
    contentType: "product-description",
    status: "pending",
    createdAt: "2024-01-15T08:45:00Z",
  },
]

const getStatusIcon = (status: Job["status"]) => {
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

export function RecentJobs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Jobs</CardTitle>
        <CardDescription>Your latest AI content generation tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockJobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(job.status)}
                <div>
                  <h4 className="font-medium">{job.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString()} • {job.contentType.replace("-", " ")}
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
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link href="/jobs">
            <Button variant="outline">View All Jobs</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
