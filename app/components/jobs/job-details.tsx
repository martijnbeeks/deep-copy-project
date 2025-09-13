"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, User, FileText, Target, Hash, MessageSquare } from "lucide-react"

interface JobDetailsProps {
  job: {
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
  }
}

export function JobDetails({ job }: JobDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200"
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
            <CardDescription className="mt-2">{job.description}</CardDescription>
          </div>
          <Badge className={`capitalize ${getStatusColor(job.status)}`}>{job.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Content Type:</span>
            <Badge variant="outline" className="capitalize">
              {job.contentType.replace("-", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tone:</span>
            <Badge variant="outline" className="capitalize">
              {job.tone}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Target Audience:</span>
            <span className="text-sm text-muted-foreground">{job.targetAudience}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Created:</span>
            <span className="text-sm text-muted-foreground">{new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <Separator />

        {job.keywords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Keywords:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {job.additionalInstructions && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Additional Instructions:</span>
            </div>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{job.additionalInstructions}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
