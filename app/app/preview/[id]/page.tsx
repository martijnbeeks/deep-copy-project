"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, Download, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"

export default function PreviewPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob } = useJobsStore()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }

    const loadJob = async () => {
      try {
        await fetchJob(params.id)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch job:', error)
        setIsLoading(false)
      }
    }

    loadJob()
  }, [isAuthenticated, user, router, params.id])

  const handleDownload = () => {
    if (currentJob?.result?.html_content) {
      const blob = new Blob([currentJob.result.html_content], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentJob.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleCopyHTML = async () => {
    if (currentJob?.result?.html_content) {
      try {
        await navigator.clipboard.writeText(currentJob.result.html_content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy HTML:', err)
      }
    }
  }

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!currentJob || !currentJob.result) {
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
          className="bg-white/90 backdrop-blur-sm shadow-lg"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyHTML}
          className="bg-white/90 backdrop-blur-sm shadow-lg"
        >
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy HTML'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="bg-white/90 backdrop-blur-sm shadow-lg"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      {/* Full Screen HTML Render */}
      <div className="w-full h-screen">
        <div 
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: currentJob.result.html_content }}
        />
      </div>
    </div>
  )
}
