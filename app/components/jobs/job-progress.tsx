"use client"

import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react"

interface JobStep {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "failed"
  startTime?: string
  endTime?: string
  duration?: number
}

interface JobProgressProps {
  steps: JobStep[]
  currentStep?: string
  overallProgress: number
}

const getStepIcon = (status: JobStep["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "processing":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

const getStepBadge = (status: JobStep["status"]) => {
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

export function JobProgress({ steps, currentStep, overallProgress }: JobProgressProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Progress</CardTitle>
        <CardDescription>Track your AI content generation process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-shrink-0">{getStepIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{step.name}</h4>
                  {getStepBadge(step.status)}
                </div>
                {step.duration && <p className="text-xs text-muted-foreground mt-1">Duration: {step.duration}s</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
