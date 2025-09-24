"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, User, FileText, Target, Hash, MessageSquare } from "lucide-react"
import { JobWithResult } from "@/lib/db/types"

interface JobDetailsProps {
  job: JobWithResult
}

export function JobDetails({ job }: JobDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{job.title}</CardTitle>
            <CardDescription className="mt-2">{job.brand_info}</CardDescription>
          </div>
          <Badge className={`capitalize ${getStatusColor(job.status)}`}>{job.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Template:</span>
            <Badge variant="outline" className="capitalize">
              {job.template?.name || 'AI Generated'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Progress:</span>
            <span className="text-sm text-muted-foreground capitalize">{job.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Status:</span>
            <span className="text-sm text-muted-foreground capitalize">{job.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Created:</span>
            <span className="text-sm text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {job.sales_page_url && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sales Page URL:</span>
              </div>
              <a 
                href={job.sales_page_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {job.sales_page_url}
              </a>
            </div>
          </>
        )}

        <Separator />

        <div className="text-xs text-muted-foreground">
          <p>Job ID: {job.id}</p>
          <p>Last updated: {new Date(job.updated_at).toLocaleString()}</p>
          {job.completed_at && (
            <p>Completed: {new Date(job.completed_at).toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}