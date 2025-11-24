"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Globe, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SalesPagePreviewProps {
  url: string
  jobId?: string
  className?: string
}

export function SalesPagePreview({ url, jobId, className = "" }: SalesPagePreviewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [faviconError, setFaviconError] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(true)

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

  // Create proxy URL for iframe
  const proxyUrl = `/api/proxy/page?url=${encodeURIComponent(url)}`

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIframeError(false)
    setIframeLoading(true)
    setIsModalOpen(true)
  }

  // Reset iframe loading state when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setIframeError(false)
      setIframeLoading(true)
    }
  }, [isModalOpen])

  // Timeout fallback - if iframe doesn't load within 3 seconds, check for blocking
  useEffect(() => {
    if (isModalOpen && !iframeError && iframeLoading) {
      const timeout = setTimeout(() => {
        // If still loading after 3 seconds, likely blocked
        const iframe = document.querySelector(`iframe[title*="Sales page"]`) as HTMLIFrameElement
        if (iframe && iframeLoading) {
          try {
            // Try to detect if iframe is blocked
            const test = iframe.contentWindow
            if (!test) {
              setIframeError(true)
              setIframeLoading(false)
              return
            }
            // Try accessing location - will throw if blocked
            try {
              iframe.contentWindow.location.href
            } catch (e: any) {
              // If we get here, it's likely blocked
              setIframeError(true)
              setIframeLoading(false)
            }
          } catch (e: any) {
            // Any error accessing iframe content suggests blocking
            setIframeError(true)
            setIframeLoading(false)
          }
        }
      }, 3000)

      return () => clearTimeout(timeout)
    }
  }, [isModalOpen, iframeError, iframeLoading])

  return (
    <>
      <div
        onClick={handleClick}
        className={`group relative block w-full h-full min-h-[120px] rounded-lg overflow-hidden bg-white dark:bg-gray-900 transition-all cursor-pointer ${className}`}
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
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[95vh] !max-h-[95vh] !p-0 !flex !flex-col !gap-0 sm:!max-w-[95vw]">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{domain}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6 relative" style={{ minHeight: 0, height: 'calc(95vh - 100px)' }}>
            {iframeError ? (
              <div className="w-full h-full flex flex-col items-center justify-center border rounded-lg bg-muted/50 p-6">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2 text-center font-medium">
                  This page cannot be displayed in an iframe
                </p>
                <p className="text-xs text-muted-foreground mb-4 text-center">
                  The website has security restrictions that prevent embedding.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                >
                  Open in new tab
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <>
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg border">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading page...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={proxyUrl}
                  className="w-full h-full border rounded-lg"
                  title={`Sales page: ${domain}`}
                  allow="fullscreen"
                  style={{ height: '100%', minHeight: 0 }}
                  onError={() => {
                    setIframeError(true)
                    setIframeLoading(false)
                  }}
                  onLoad={(e) => {
                    const iframe = e.target as HTMLIFrameElement
                    setIframeLoading(false)

                    // With proxy, we should be able to access the content
                    // But still check for any errors after a short delay
                    setTimeout(() => {
                      try {
                        const contentWindow = iframe.contentWindow
                        if (!contentWindow) {
                          setIframeError(true)
                        }
                        // If we can access contentWindow, the proxy is working
                      } catch (e: any) {
                        // If there's still an error, show fallback
                        console.error('Iframe load error:', e)
                        setIframeError(true)
                      }
                    }, 1000)
                  }}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

