"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Globe, Loader2 } from "lucide-react"

interface SalesPagePreviewProps {
  url: string
  jobId?: string
  className?: string
}

export function SalesPagePreview({ url, jobId, className = "" }: SalesPagePreviewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [faviconError, setFaviconError] = useState(false)

  const getDomain = (urlString: string) => {
    try {
      const urlObj = new URL(urlString)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return urlString
    }
  }

  const domain = getDomain(url)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  useEffect(() => {
    if (!jobId) {
      setIsLoading(false)
      return
    }

    const fetchScreenshot = async () => {
      try {
        const response = await fetch(`/api/screenshot?jobId=${jobId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.screenshot) {
            setScreenshot(`data:image/png;base64,${data.screenshot}`)
          }
        }
      } catch (error) {
        console.error('Failed to fetch screenshot:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchScreenshot()
  }, [jobId])

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`group relative block w-full h-full rounded-lg overflow-hidden bg-white dark:bg-gray-900 transition-all ${className}`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {screenshot ? (
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={screenshot}
            alt={`Preview of ${domain}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

          {/* URL Badge - Bottom Right Corner */}
          <div className="absolute bottom-2 right-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-xs opacity-80 group-hover:opacity-100 transition-opacity">
              <span className="truncate max-w-[120px]">{domain}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 border border-border/50">
            {!faviconError ? (
              <img src={faviconUrl} alt="" className="w-8 h-8" onError={() => setFaviconError(true)} />
            ) : (
              <Globe className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5 w-full">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              <span className="truncate max-w-[200px]">{domain}</span>
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-xs text-muted-foreground">Click to view page</span>
          </div>
        </div>
      )}
    </a>
  )
}

