"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, Download, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useJob } from "@/lib/hooks/use-jobs"

export default function PreviewPage({ params }: { params: { id: string } }) {
  const { user, isReady } = useRequireAuth()
  const { data: currentJob, isLoading } = useJob(params.id)
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  const handleDownload = () => {
    const htmlContent = currentJob?.result?.html_content || currentJob?.result?.metadata?.html_content
    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentJob?.title || 'preview').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleCopyHTML = async () => {
    const htmlContent = currentJob?.result?.html_content || currentJob?.result?.metadata?.html_content
    if (htmlContent) {
      try {
        await navigator.clipboard.writeText(htmlContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        // Silently handle copy errors
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const htmlContent = currentJob?.result?.html_content || currentJob?.result?.metadata?.html_content
  if (!currentJob || !htmlContent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Result Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested result could not be found or is not yet available.</p>
          <Button onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Action Bar */}
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard')}
          className="bg-white/90 backdrop-blur-sm shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyHTML}
          className="bg-white/90 backdrop-blur-sm shadow-sm"
        >
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy HTML'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="bg-white/90 backdrop-blur-sm shadow-sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      {/* Full Screen HTML Render */}
      <div className="w-full h-screen">
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  )
}
