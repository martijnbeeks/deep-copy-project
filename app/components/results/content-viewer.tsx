"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Download, Edit, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface ContentSection {
  id: string
  title: string
  content: string
  type: "heading" | "paragraph" | "list" | "quote"
}

interface ContentViewerProps {
  content: {
    id: string
    title: string
    sections: ContentSection[]
    wordCount: number
    readingTime: number
    tone: string
    contentType: string
    generatedAt: string
  }
  onFeedback?: (rating: "positive" | "negative", feedback?: string) => void
  onRegenerate?: (sectionId?: string) => void
}

export function ContentViewer({ content, onFeedback, onRegenerate }: ContentViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState("")
  const [feedbackText, setFeedbackText] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    const fullContent = content.sections
      .map((section) => `${section.title ? section.title + "\n\n" : ""}${section.content}`)
      .join("\n\n")

    try {
      await navigator.clipboard.writeText(fullContent)
      toast({
        title: "Content copied",
        description: "The content has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy content to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    const fullContent = content.sections
      .map((section) => `${section.title ? section.title + "\n\n" : ""}${section.content}`)
      .join("\n\n")

    const blob = new Blob([fullContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${content.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFeedback = (rating: "positive" | "negative") => {
    if (rating === "negative") {
      setShowFeedback(true)
    } else {
      onFeedback?.(rating)
      toast({
        title: "Feedback submitted",
        description: "Thank you for your positive feedback!",
      })
    }
  }

  const submitFeedback = () => {
    onFeedback?.("negative", feedbackText)
    setShowFeedback(false)
    setFeedbackText("")
    toast({
      title: "Feedback submitted",
      description: "Thank you for your feedback. We'll use it to improve future generations.",
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{content.title}</CardTitle>
              <CardDescription className="mt-2">
                Generated on {new Date(content.generatedAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {content.contentType.replace("-", " ")}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {content.tone}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{content.wordCount} words</span>
              <span>•</span>
              <span>{content.readingTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Edit className="h-4 w-4 mr-2" />
                {isEditing ? "View" : "Edit"}
              </Button>
            </div>
          </div>

          <Separator className="mb-6" />

          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={
                  editedContent ||
                  content.sections.map((s) => `${s.title ? s.title + "\n\n" : ""}${s.content}`).join("\n\n")
                }
                onChange={(e) => setEditedContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Handle save logic here
                    setIsEditing(false)
                    toast({
                      title: "Content saved",
                      description: "Your edits have been saved.",
                    })
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-gray max-w-none">
              {content.sections.map((section, index) => (
                <div key={section.id} className="mb-6 group relative">
                  {section.title && <h3 className="text-lg font-semibold mb-3">{section.title}</h3>}
                  <div className="whitespace-pre-wrap leading-relaxed">{section.content}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRegenerate?.(section.id)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate This Content</CardTitle>
          <CardDescription>Help us improve by rating the generated content</CardDescription>
        </CardHeader>
        <CardContent>
          {!showFeedback ? (
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => handleFeedback("positive")} className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" />
                Good
              </Button>
              <Button variant="outline" onClick={() => handleFeedback("negative")} className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4" />
                Needs Improvement
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="What could be improved? Your feedback helps us generate better content."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFeedback(false)}>
                  Cancel
                </Button>
                <Button onClick={submitFeedback}>Submit Feedback</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
