"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Clock, FileText, Hash, ChevronRight } from "lucide-react"
import { PromptWithVersions, PromptVersion } from "@/components/admin/admin-types"

interface PromptVersionHistoryProps {
  prompt: PromptWithVersions
  onRestore?: (content: string) => void
}

function highlightPlaceholders(content: string): React.ReactNode[] {
  const regex = /\{([^}]+)\}/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    parts.push(
      <span key={match.index} className="bg-yellow-200/40 dark:bg-yellow-500/20 rounded px-0.5">
        {match[0]}
      </span>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  return 'just now'
}

export function PromptVersionHistory({ prompt, onRestore }: PromptVersionHistoryProps) {
  const versions = [...prompt.versions].sort((a, b) => b.version_number - a.version_number)

  if (versions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-sm font-medium mb-2">No versions found</h3>
        <p className="text-xs text-muted-foreground">
          No versions found for this prompt
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {versions.map((version, index) => {
          const isLatest = index === 0

          return (
            <div key={version.id} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 ${
                isLatest
                  ? 'bg-primary border-primary'
                  : 'bg-background border-muted-foreground/40'
              }`} />

              <div className="rounded-lg border bg-card">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={isLatest ? "default" : "secondary"} className="text-xs font-normal">
                        v{version.version_number}
                      </Badge>
                      {isLatest && (
                        <Badge variant="outline" className="text-xs font-normal text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
                          Latest
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(version.created_at)}
                      </span>
                    </div>
                    {onRestore && !isLatest && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Restore version ${version.version_number}? This will copy the content to the editor.`)) {
                            onRestore(version.content)
                          }
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Restore
                      </Button>
                    )}
                  </div>

                  {/* Created by */}
                  <p className="text-xs text-muted-foreground mb-2">
                    Created by: {version.created_by}
                  </p>

                  {/* Notes */}
                  {version.notes && (
                    <p className="text-sm text-muted-foreground mb-3 italic">
                      {version.notes}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      <Hash className="h-3 w-3 mr-1" />
                      {version.placeholders?.length || 0} placeholders
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {version.content.length.toLocaleString()} characters
                    </span>
                  </div>

                  {/* Expandable content */}
                  <Accordion type="single" collapsible>
                    <AccordionItem value="content" className="border-0">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          View Content
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="rounded-md bg-muted/30 p-3 max-h-64 overflow-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                            {highlightPlaceholders(version.content)}
                          </pre>
                        </div>
                        {version.placeholders && version.placeholders.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {version.placeholders.map((p) => (
                              <Badge key={p} variant="secondary" className="text-xs font-normal font-mono">
                                {`{${p}}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
