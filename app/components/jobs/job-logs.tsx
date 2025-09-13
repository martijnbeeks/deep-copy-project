"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warning" | "success" | "error"
  message: string
  details?: string
}

interface JobLogsProps {
  logs: LogEntry[]
}

const getLogIcon = (level: LogEntry["level"]) => {
  switch (level) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

const getLogBadge = (level: LogEntry["level"]) => {
  const variants = {
    success: "default",
    error: "destructive",
    warning: "secondary",
    info: "outline",
  } as const

  return (
    <Badge variant={variants[level]} className="capitalize">
      {level}
    </Badge>
  )
}

export function JobLogs({ logs }: JobLogsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Logs</CardTitle>
        <CardDescription>Detailed pipeline execution information</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="flex-shrink-0 mt-0.5">{getLogIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {getLogBadge(log.level)}
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">{log.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
