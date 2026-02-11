"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon, Upload, X, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { replaceImagesInHTML } from "@/lib/utils/image-replacer"
import { useAuthStore } from "@/stores/auth-store"
import { extractTaggedImages } from "@/lib/utils/image-tag-extractor"
import { getAuthorizationHeader } from "@/lib/utils/client-auth"

interface PrelanderImageGenerationDialogProps {
  isOpen: boolean
  onClose: () => void
  html: string
  jobId?: string
  onImagesGenerated?: (imageCount: number, updatedHtml: string) => void
  // Optional context data - if not provided, will be fetched from job
  deepResearch?: string
  angle?: string
  productName?: string
  avatar?: string
  productImage?: string // base64 data URL or HTTP URL
  language?: string
  targetAge?: string
}

export function PrelanderImageGenerationDialog({
  isOpen,
  onClose,
  html,
  jobId,
  onImagesGenerated,
  deepResearch,
  angle,
  productName,
  avatar,
  productImage,
  language = "English",
  targetAge,
}: PrelanderImageGenerationDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(productImage || null)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)
  const [credits, setCredits] = useState<{ currentUsage: number; limit: number; allowed: boolean } | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Count tagged images in HTML
  const taggedImagesCount = extractTaggedImages(html).length

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false)
      setGeneratedCount(0)
      setPollingJobId(null)
      if (!productImage) {
        setProductImageFile(null)
        setProductImagePreview(null)
      }
    }
  }, [isOpen, productImage])

  // Fetch credits when dialog opens
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user || !isOpen) return

      setIsLoadingCredits(true)
      try {
        const authHeaders = getAuthorizationHeader()
        const response = await fetch(`/api/usage/check?type=static_ads`, {
          method: 'GET',
          headers: {
            ...authHeaders
          }
        })

        if (response.ok) {
          const data = await response.json()
          setCredits({
            currentUsage: data.data?.currentUsage || data.currentUsage || 0,
            limit: data.data?.limit || data.limit || 0,
            allowed: data.data?.allowed !== false && data.allowed !== false
          })
        } else {
          setCredits({
            currentUsage: 0,
            limit: Infinity,
            allowed: true
          })
        }
      } catch (error) {
        console.error("Error fetching credits:", error)
        setCredits({
          currentUsage: 0,
          limit: Infinity,
          allowed: true
        })
      } finally {
        setIsLoadingCredits(false)
      }
    }

    fetchCredits()
  }, [user, isOpen])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        })
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB",
          variant: "destructive",
        })
        return
      }
      setProductImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveProductImage = () => {
    setProductImageFile(null)
    setProductImagePreview(null)
  }

  // Poll for status first, then get results
  const pollForResult = async (imageJobId: string): Promise<any> => {
    const maxAttempts = 120 // 10 minutes max (2s * 120 = 4 minutes, but keep same max attempts)
    const pollInterval = 2000 // 2 seconds
    let attempts = 0

    // Step 1: Poll status endpoint until COMPLETED or FAILED
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++

      try {
        const authHeaders = getAuthorizationHeader()
        const statusResponse = await fetch(`/api/prelander-images/${imageJobId}`, {
          method: 'GET',
          headers: {
            ...authHeaders,
          },
        })

        if (!statusResponse.ok) {
          const errorData = await statusResponse.json().catch(() => ({ error: 'Failed to get status' }))
          throw new Error(errorData.error || `Failed to get status: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        // Check if job is completed
        if (statusData.status === 'COMPLETED_PRELANDER_IMAGE_GEN') {
          // Step 2: Get results now that status is COMPLETED
          const resultResponse = await fetch(`/api/prelander-images/${imageJobId}/result`, {
            method: 'GET',
            headers: {
              ...authHeaders,
            },
          })

          if (!resultResponse.ok) {
            const errorData = await resultResponse.json().catch(() => ({ error: 'Failed to get result' }))
            throw new Error(errorData.error || `Failed to get result: ${resultResponse.status}`)
          }

          const resultData = await resultResponse.json()
          return resultData
        } else if (statusData.status === 'FAILED_PRELANDER_IMAGE_GEN') {
          // Job failed, stop polling
          throw new Error(statusData.error || 'Image generation job failed')
        }
        // Otherwise status is RUNNING_PRELANDER_IMAGE_GEN or similar, continue polling
      } catch (error) {
        if (error instanceof Error && (
          error.message.includes('Failed to get status') || 
          error.message.includes('Image generation job failed') ||
          error.message.includes('Failed to get result')
        )) {
          throw error
        }
        // Network error, retry
        continue
      }
    }

    throw new Error('Image generation timed out after 10 minutes')
  }

  // Fetch job context if not provided
  const fetchJobContext = async (): Promise<{
    deepResearch?: string
    angle?: string
    productName?: string
    avatar?: string
    language?: string
    targetAge?: string
  }> => {
    if (deepResearch || angle || productName || avatar) {
      // Context already provided
      return { deepResearch, angle, productName, avatar, language, targetAge }
    }

    if (!jobId) {
      return {}
    }

    try {
      // Fetch job result to get context
      const authHeaders = getAuthorizationHeader()
      const response = await fetch(`/api/jobs/${jobId}/result`, {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      })
      if (!response.ok) {
        console.warn('Failed to fetch job context, proceeding without it')
        return {}
      }

      const jobData = await response.json()
      const results = jobData.results || jobData.data?.results || {}

      return {
        deepResearch: results.deep_research_output,
        angle: results.swipe_results?.[0]?.angle,
        productName: jobData.project_name,
        avatar: results.marketing_avatars?.[0]?.avatar ? JSON.stringify(results.marketing_avatars[0].avatar) : undefined,
        language: language,
        targetAge: results.marketing_avatars?.[0]?.avatar?.demographics?.age_range,
      }
    } catch (error) {
      console.warn('Error fetching job context:', error)
      return {}
    }
  }

  const handleGenerateImages = async () => {
    // Check credits before generating
    if (credits && !credits.allowed) {
      toast({
        title: "Usage limit exceeded",
        description: `You've reached your weekly limit of ${credits.limit} Static Ad images. Your limit resets automatically based on a rolling 7-day window.`,
        variant: "destructive",
      })
      return
    }

    if (credits && credits.limit !== Infinity && (credits.currentUsage + taggedImagesCount) > credits.limit) {
      toast({
        title: "Insufficient credits",
        description: `This will generate ${taggedImagesCount} images, but you only have ${credits.limit - credits.currentUsage} credits remaining.`,
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGeneratedCount(0)

    try {
      // Fetch context if needed
      const context = await fetchJobContext()

      // Prepare product image (use file if selected, otherwise use provided productImage)
      let productImageData: string | undefined = productImagePreview || undefined

      // Prepare request body
      const requestBody: any = {
        html,
        ...(context.deepResearch && { deepResearch: context.deepResearch }),
        ...(context.angle && { angle: context.angle }),
        ...(context.productName && { productName: context.productName }),
        ...(context.avatar && { avatar: context.avatar }),
        ...(productImageData && { productImage: productImageData }),
        ...(context.language && { language: context.language }),
        ...(context.targetAge && { targetAge: context.targetAge }),
      }

      // Submit job to backend via our API route
      const submitResponse = await fetch('/api/prelander-images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizationHeader(),
        },
        body: JSON.stringify(requestBody),
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json().catch(() => ({ error: 'Failed to submit image generation job' }))
        throw new Error(error.error || 'Failed to submit image generation job')
      }

      const submitData = await submitResponse.json()
      const imageJobId = submitData.data?.jobId || submitData.jobId

      if (!imageJobId) {
        throw new Error('No job ID returned from backend')
      }

      setPollingJobId(imageJobId)

      toast({
        title: "Image generation started",
        description: "Generating images... This may take a few minutes.",
      })

      // Poll for result
      const result = await pollForResult(imageJobId)

      if (!result.success || !result.images || result.images.length === 0) {
        throw new Error("No images were generated")
      }

      // Replace images in HTML
      const replacements: Array<{ tag: string; url: string }> = result.images.map((img: any) => ({
        tag: String(img.tag),
        url: String(img.url),
      }))

      const updatedHtml = replaceImagesInHTML(html, replacements)

      // Update all iframes
      const iframes = document.querySelectorAll('iframe')
      let iframesUpdated = 0
      iframes.forEach((iframe) => {
        try {
          const el = iframe as HTMLIFrameElement
          const currentSrcDoc = el.srcdoc || el.getAttribute('srcdoc') || ''
          const hasOurImages = replacements.some((r) =>
            currentSrcDoc.includes(`data-image-role="${r.tag}"`) ||
            currentSrcDoc.includes(`data-image-role='${r.tag}'`)
          )
          
          if (hasOurImages) {
            const updatedSrcDoc = replaceImagesInHTML(currentSrcDoc, replacements)
            el.srcdoc = updatedSrcDoc
            iframesUpdated++
          }
        } catch (e) {
          console.debug('Could not update iframe:', e)
        }
      })

      setGeneratedCount(replacements.length)
      setIsGenerating(false)
      setPollingJobId(null)

      toast({
        title: "Images generated successfully",
        description: `Generated and replaced ${replacements.length} image${replacements.length !== 1 ? "s" : ""}. ${iframesUpdated > 0 ? `Updated ${iframesUpdated} preview${iframesUpdated !== 1 ? "s" : ""}.` : ''}`,
      })

      if (onImagesGenerated) {
        onImagesGenerated(replacements.length, updatedHtml)
      }

      // Save to database asynchronously (same logic as before)
      if (jobId) {
        ;(async () => {
          try {
            const templateUrl = `/api/jobs/${jobId}/injected-templates`
            const authHeaders = getAuthorizationHeader()
            const templateResponse = await fetch(templateUrl, {
              method: 'GET',
              headers: {
                ...authHeaders,
              },
            })
            
            if (templateResponse.ok) {
              const templateData = await templateResponse.json()
              const templates = templateData.data?.templates || templateData.templates || []
              const templateToUpdate = templates[0]
              
              if (templateToUpdate?.id) {
                await fetch(`/api/templates/injected/${templateToUpdate.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({ html: updatedHtml }),
                })
                console.log('✅ Template saved to database')
              }
            }
          } catch (error) {
            console.warn('⚠️ Failed to save template:', error)
          }
        })()
      }

      // Refresh credits after successful generation
      if (user) {
        try {
          const authHeaders = getAuthorizationHeader()
          const response = await fetch(`/api/usage/check?type=static_ads`, {
            method: 'GET',
            headers: {
              ...authHeaders
            }
          })
          if (response.ok) {
            const data = await response.json()
            setCredits({
              currentUsage: data.data?.currentUsage || data.currentUsage || 0,
              limit: data.data?.limit || data.limit || 0,
              allowed: data.data?.allowed !== false && data.allowed !== false
            })
          }
        } catch (error) {
          console.warn('Failed to refresh credits:', error)
        }
      }

      // Close dialog after success
      onClose()
    } catch (error) {
      console.error("Error generating images:", error)
      setIsGenerating(false)
      setPollingJobId(null)
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Failed to generate images. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isGenerating && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate AI Images for Prelander</DialogTitle>
          <DialogDescription>
            Generate AI images for all image placeholders in this prelander. Upload a product image to include in the generated images, or skip to generate without a product image.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Credits Information */}
          {!isLoadingCredits && credits && (
            <div className={`p-3 rounded-md border ${taggedImagesCount > (credits.limit - credits.currentUsage) ? 'bg-destructive/10 border-destructive' : 'bg-muted/50'}`}>
              <div className="flex items-start gap-2">
                {taggedImagesCount > (credits.limit - credits.currentUsage) && <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    Image Credits
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This will generate <span className="font-semibold">{taggedImagesCount} image{taggedImagesCount !== 1 ? 's' : ''}</span>
                    {credits.limit !== Infinity && (
                      <>
                        {' '}• You have <span className="font-semibold">{credits.limit - credits.currentUsage} credit{(credits.limit - credits.currentUsage) !== 1 ? 's' : ''}</span> remaining
                        {' '}• Limit: {credits.limit}
                      </>
                    )}
                  </p>
                  {taggedImagesCount > (credits.limit - credits.currentUsage) && credits.limit !== Infinity && (
                    <p className="text-xs text-destructive font-medium">
                      Insufficient credits. You need {taggedImagesCount - (credits.limit - credits.currentUsage)} more credit{taggedImagesCount - (credits.limit - credits.currentUsage) !== 1 ? 's' : ''}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="product-image-upload">Product Image (Optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="product-image-upload"
              disabled={isGenerating}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
                disabled={isGenerating}
              >
                <Upload className="h-4 w-4" />
                {productImagePreview ? 'Change Image' : 'Select Image'}
              </Button>
              {productImagePreview && (
                <div className="relative group">
                  <img
                    src={productImagePreview}
                    alt="Product preview"
                    className="h-16 w-16 object-cover rounded border"
                  />
                  <button
                    onClick={handleRemoveProductImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                    disabled={isGenerating}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {productImageFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {productImageFile.name} ({(productImageFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {pollingJobId && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Generating images... This may take a few minutes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateImages}
            disabled={isGenerating || (credits && credits.limit !== Infinity && taggedImagesCount > (credits.limit - credits.currentUsage)) || !credits?.allowed}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {pollingJobId ? 'Generating...' : 'Starting...'}
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Generate Images
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




