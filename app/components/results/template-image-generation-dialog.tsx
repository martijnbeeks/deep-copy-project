"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon, AlertCircle, Upload, X, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/utils/logger";
import { getAuthorizationHeader } from "@/lib/utils/client-auth";
import { useAuthStore } from "@/stores/auth-store"
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits"

interface TemplateImageGenerationDialogProps {
  isOpen: boolean
  onClose: () => void
  templateId: string
  injectedTemplateId: string
  configData: any // The full config object with prompts
  onImagesGenerated?: (images: Array<{ role: string; index?: number; url: string }>) => void
}

// New template IDs that support this feature (base IDs without suffixes)
const NEW_TEMPLATE_IDS = ['AD0001', 'LD0001']

export function TemplateImageGenerationDialog({
  isOpen,
  onClose,
  templateId,
  injectedTemplateId,
  configData,
  onImagesGenerated,
}: TemplateImageGenerationDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isJobSubmitted, setIsJobSubmitted] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [jobStartTime, setJobStartTime] = useState<number | null>(null)
  const [allPrompts, setAllPrompts] = useState<Array<{ role: string; index?: number; prompt: string }>>([])
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [selectedImageType, setSelectedImageType] = useState<'realistic' | 'illustrative' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user } = useAuthStore()

  const [showOverageDialog, setShowOverageDialog] = useState(false)
  const [pendingOverage, setPendingOverage] = useState<{
    overageCredits: number
    overageCostPerCredit: number
    overageCostTotal: number
    currency: string
    requestBody: any
  } | null>(null)

  const processConfigData = (parsedConfigData: any) => {
    const prompts: Array<{ role: string; index?: number; prompt: string }> = []

    // FIRST: Extract section image prompts from CONFIG.SECTIONS (existing behavior)
    if (parsedConfigData?.SECTIONS && Array.isArray(parsedConfigData.SECTIONS)) {
      parsedConfigData.SECTIONS.forEach((section: any, index: number) => {
        if (section.imagePrompt) {
          let sectionPrompt = ''
          if (typeof section.imagePrompt === 'string') {
            sectionPrompt = section.imagePrompt
          } else if (Array.isArray(section.imagePrompt) && section.imagePrompt.length > 0) {
            sectionPrompt =
              typeof section.imagePrompt[0] === 'string'
                ? section.imagePrompt[0]
                : section.imagePrompt[0]?.prompt || ''
          } else if (typeof section.imagePrompt === 'object') {
            sectionPrompt = section.imagePrompt.prompt || ''
          }
          if (sectionPrompt && sectionPrompt.trim()) {
            prompts.push({ role: 'section', index, prompt: sectionPrompt })
          }
        }
      })
    }

    // SECOND: Also check for nested structure (article.sections) for backward compatibility
    if (parsedConfigData?.article?.sections && Array.isArray(parsedConfigData.article.sections)) {
      parsedConfigData.article.sections.forEach((section: any, index: number) => {
        if (section.imagePrompt) {
          let sectionPrompt = ''
          if (typeof section.imagePrompt === 'string') {
            sectionPrompt = section.imagePrompt
          } else if (Array.isArray(section.imagePrompt) && section.imagePrompt.length > 0) {
            sectionPrompt =
              typeof section.imagePrompt[0] === 'string'
                ? section.imagePrompt[0]
                : section.imagePrompt[0]?.prompt || ''
          } else if (typeof section.imagePrompt === 'object') {
            sectionPrompt = section.imagePrompt.prompt || ''
          }
          if (sectionPrompt && sectionPrompt.trim()) {
            prompts.push({ role: 'section', index, prompt: sectionPrompt })
          }
        }
      })
    }

    // THIRD: LD0001 listicle-style reasons (CONFIG.REASONS) – new, backwards-compatible
    if (parsedConfigData?.REASONS && Array.isArray(parsedConfigData.REASONS)) {
      parsedConfigData.REASONS.forEach((reason: any, index: number) => {
        if (reason?.imagePrompt) {
          let reasonPrompt = ''
          if (typeof reason.imagePrompt === 'string') {
            reasonPrompt = reason.imagePrompt
          } else if (Array.isArray(reason.imagePrompt) && reason.imagePrompt.length > 0) {
            reasonPrompt =
              typeof reason.imagePrompt[0] === 'string'
                ? reason.imagePrompt[0]
                : reason.imagePrompt[0]?.prompt || ''
          } else if (typeof reason.imagePrompt === 'object') {
            reasonPrompt = reason.imagePrompt.prompt || ''
          }
          if (reasonPrompt && reasonPrompt.trim()) {
            // Use role "reason" so we can differentiate later if needed
            prompts.push({ role: 'reason', index, prompt: reasonPrompt })
          }
        }
      })
    }

    // Extract hero image prompt (some templates might have this)
    // Check both nested (AD0001) and top-level (LD0001) structures
    let heroPrompt = ''
    if (parsedConfigData?.article?.heroImagePrompt) {
      // AD0001: nested under article
      if (typeof parsedConfigData.article.heroImagePrompt === 'string') {
        heroPrompt = parsedConfigData.article.heroImagePrompt
      } else if (
        Array.isArray(parsedConfigData.article.heroImagePrompt) &&
        parsedConfigData.article.heroImagePrompt.length > 0
      ) {
        heroPrompt =
          typeof parsedConfigData.article.heroImagePrompt[0] === 'string'
            ? parsedConfigData.article.heroImagePrompt[0]
            : parsedConfigData.article.heroImagePrompt[0]?.prompt || ''
      } else if (typeof parsedConfigData.article.heroImagePrompt === 'object') {
        heroPrompt = parsedConfigData.article.heroImagePrompt.prompt || ''
      }
    } else if (parsedConfigData?.heroImagePrompt) {
      // LD0001: top-level heroImagePrompt
      if (typeof parsedConfigData.heroImagePrompt === 'string') {
        heroPrompt = parsedConfigData.heroImagePrompt
      } else if (
        Array.isArray(parsedConfigData.heroImagePrompt) &&
        parsedConfigData.heroImagePrompt.length > 0
      ) {
        heroPrompt =
          typeof parsedConfigData.heroImagePrompt[0] === 'string'
            ? parsedConfigData.heroImagePrompt[0]
            : parsedConfigData.heroImagePrompt[0]?.prompt || ''
      } else if (typeof parsedConfigData.heroImagePrompt === 'object') {
        heroPrompt = parsedConfigData.heroImagePrompt.prompt || ''
      }
    }
    if (heroPrompt && heroPrompt.trim()) {
      prompts.push({ role: 'hero', prompt: heroPrompt })
    }

    // Extract product image prompt (if present)
    // Check both nested (AD0001) and top-level (LD0001) structures
    let productPrompt = ''
    if (parsedConfigData?.product?.imagePrompt) {
      // AD0001: nested under product
      if (typeof parsedConfigData.product.imagePrompt === 'string') {
        productPrompt = parsedConfigData.product.imagePrompt
      } else if (Array.isArray(parsedConfigData.product.imagePrompt) && parsedConfigData.product.imagePrompt.length > 0) {
        productPrompt =
          typeof parsedConfigData.product.imagePrompt[0] === 'string'
            ? parsedConfigData.product.imagePrompt[0]
            : parsedConfigData.product.imagePrompt[0]?.prompt || ''
      } else if (typeof parsedConfigData.product.imagePrompt === 'object') {
        productPrompt = parsedConfigData.product.imagePrompt.prompt || ''
      }
    } else if (parsedConfigData?.productImagePrompt) {
      // LD0001: top-level productImagePrompt
      if (typeof parsedConfigData.productImagePrompt === 'string') {
        productPrompt = parsedConfigData.productImagePrompt
      } else if (Array.isArray(parsedConfigData.productImagePrompt) && parsedConfigData.productImagePrompt.length > 0) {
        productPrompt =
          typeof parsedConfigData.productImagePrompt[0] === 'string'
            ? parsedConfigData.productImagePrompt[0]
            : parsedConfigData.productImagePrompt[0]?.prompt || ''
      } else if (typeof parsedConfigData.productImagePrompt === 'object') {
        productPrompt = parsedConfigData.productImagePrompt.prompt || ''
      }
    }
    if (productPrompt && productPrompt.trim()) {
      prompts.push({ role: 'product', prompt: productPrompt })
    }

    console.log('Extracted prompts:', prompts.length, prompts) // Debug log
    setAllPrompts(prompts)
  }

  const extractConfigFromHtml = (html: string): any | null => {
    if (!html) return null

    // IMPROVED: Match CONFIG with proper handling of nested objects
    // Look for the script tag containing CONFIG, then extract the object more carefully
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?const\s+CONFIG\s*=\s*{[\s\S]*?})\s*;?\s*<\/script>/i)
    if (!scriptMatch) return null

    const scriptContent = scriptMatch[1]
    
    // Extract just the CONFIG object part (everything after "const CONFIG = ")
    const configMatch = scriptContent.match(/const\s+CONFIG\s*=\s*({[\s\S]*)/i)
    if (!configMatch?.[1]) return null

    const objLiteral = configMatch[1]
    
    // Count braces to find the matching closing brace (handles nested objects)
    let braceCount = 0
    let endIndex = -1
    for (let i = 0; i < objLiteral.length; i++) {
      if (objLiteral[i] === '{') braceCount++
      if (objLiteral[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          endIndex = i + 1
          break
        }
      }
    }
    
    if (endIndex === -1) {
      console.error('Failed to find matching closing brace for CONFIG')
      return null
    }
    
    const completeConfig = objLiteral.substring(0, endIndex)
    
    try {
      // Evaluate object literal. This is required because CONFIG is JS (not strict JSON).
      // Wrap in parentheses so `return (...)` works reliably.
      // eslint-disable-next-line no-new-func
      return new Function(`return (${completeConfig});`)()
    } catch (e) {
      console.error('Failed to eval CONFIG object literal:', e)
      return null
    }
  }

  // Extract ALL prompts (not grouped by type)
  useEffect(() => {
    if (!isOpen) {
      setAllPrompts([])
      return
    }

    const isConfigEmpty =
      !configData ||
      (typeof configData === 'object' && !Array.isArray(configData) && Object.keys(configData).length === 0)

    const run = async () => {
      const authHeaders = getAuthorizationHeader()

      // Handle case where configData might be a JSON string
      let parsedConfigData: any = configData
      if (!isConfigEmpty && typeof configData === 'string') {
        try {
          parsedConfigData = JSON.parse(configData)
        } catch (e) {
          console.error('Failed to parse configData:', e)
          parsedConfigData = null
        }
      }

      // Fallback: if configData missing/empty, fetch injected template HTML and extract CONFIG
      if (isConfigEmpty) {
        try {
          const response = await fetch(`/api/templates/injected/${injectedTemplateId}`, {
            method: 'GET',
            headers: {
              ...authHeaders,
            },
          })
          if (response.ok) {
            const templateData = await response.json()
            const html = templateData.html || templateData.html_content || ''
            parsedConfigData = extractConfigFromHtml(html)
          } else {
            console.warn('Failed to fetch injected template for CONFIG extraction:', response.status)
          }
        } catch (err) {
          console.error('Failed to fetch injected template for CONFIG extraction:', err)
        }
      }

      if (!parsedConfigData) {
        setAllPrompts([])
        return
      }

      processConfigData(parsedConfigData)
    }

    run()
  }, [configData, isOpen, injectedTemplateId])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false)
      setIsJobSubmitted(false)
      setGenerationProgress(0)
      setJobStartTime(null)
      setProductImageFile(null)
      setProductImagePreview(null)
      setProductImageUrl(null)
      setSelectedImageType(null)

	  setShowOverageDialog(false)
	  setPendingOverage(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [isOpen])

  // Progress bar animation - progresses from 0 to 95% over 10 minutes
  useEffect(() => {
    if (!isJobSubmitted || !jobStartTime) {
      setGenerationProgress(0)
      return
    }

    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - jobStartTime) / 1000 // seconds
      const maxTime = 600 // 10 minutes in seconds
      
      if (elapsed < maxTime) {
        // Progress from 0 to 95% over 10 minutes
        const progress = Math.min(95, (elapsed / maxTime) * 95)
        setGenerationProgress(progress)
      } else {
        // After 10 minutes, stay at 97%
        setGenerationProgress(97)
      }
    }, 1000) // Update every second

    return () => clearInterval(progressInterval)
  }, [isJobSubmitted, jobStartTime])

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
    setProductImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // FIX: Ensure accurate prompt count - filter out empty prompts
  const imageCount = allPrompts.filter(p => p.prompt && p.prompt.trim()).length
  const templateImageCredit = JOB_CREDITS_BY_TYPE.templates_images // 1 credit per image
  const totalJobCreditsRequired = imageCount * templateImageCredit

  const handleGenerateImages = async (allowOverage: boolean = false) => {
    if (allPrompts.length === 0) {
      toast({
        title: "No prompts available",
        description: "No image prompts found in this template.",
        variant: "destructive",
      })
      return
    }

    // Check product image is required
    if (!productImageFile) {
      toast({
        title: "Product image required",
        description: "Please upload a product image to continue.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setIsJobSubmitted(false)
    setGenerationProgress(0)
    setJobStartTime(null)

    try {
      // Upload product image (required)
      let uploadedProductImageUrl: string | null = null
      try {
        const formData = new FormData()
        formData.append('file', productImageFile)
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`)
        }

        const uploadData = await uploadResponse.json()
        uploadedProductImageUrl = uploadData.url
        setProductImageUrl(uploadedProductImageUrl)
      } catch (uploadError: any) {
        toast({
          title: "Image upload failed",
          description: uploadError?.message || "Failed to upload product image. Please try again.",
          variant: "destructive",
        })
        setIsGenerating(false)
        setIsJobSubmitted(false)
        setGenerationProgress(0)
        setJobStartTime(null)
        return
      }

      // Prepare request body - use 'default' type and all prompts
      const requestBody: any = {
        templateId,
        type: 'default',
        prompts: allPrompts.map(p => ({
          role: p.role,
          ...(p.index !== undefined && { index: p.index }),
          prompt: p.prompt
        }))
      }

      // Add product image URL (required)
      requestBody.productImageUrl = uploadedProductImageUrl
      if (allowOverage) {
        requestBody.allowOverage = true
      }

      // Submit job to backend API
      const authHeaders = getAuthorizationHeader()
      const response = await fetch('/api/templates/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle intentional overage confirmation flow
        if (response.status === 402 && errorData.code === 'JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED') {
          setPendingOverage({
            overageCredits: errorData.overageCredits ?? 0,
            overageCostPerCredit: errorData.overageCostPerCredit ?? 0.5,
            overageCostTotal: errorData.overageCostTotal ?? 0,
            currency: errorData.currency ?? 'EUR',
            requestBody,
          })
          setShowOverageDialog(true)

          setIsGenerating(false)
          setIsJobSubmitted(false)
          setGenerationProgress(0)
          setJobStartTime(null)
          return
        }

        throw new Error(errorData.error || 'Failed to generate images')
      }

      const submitData = await response.json()
      const jobId = submitData.data?.jobId || submitData.jobId

      if (!jobId) {
        throw new Error("No job ID returned from server")
      }

      // Job is now submitted - switch to generation view
      setIsJobSubmitted(true)
      setJobStartTime(Date.now())
      setGenerationProgress(0)

      // Poll for status first, then get results
      const maxAttempts = 120 // 10 minutes max (2s * 120 = 4 minutes, but keep same max attempts)
      const pollInterval = 2000 // 2 seconds
      let attempts = 0

      // Step 1: Poll status endpoint until COMPLETED or FAILED
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        attempts++

        try {
          const statusResponse = await fetch(`/api/prelander-images/${jobId}`, {
            method: 'GET',
            headers: {
              ...authHeaders,
            },
          })

          if (!statusResponse.ok) {
            const error = await statusResponse.json().catch(() => ({ error: 'Failed to get status' }))
            throw new Error(error.error || 'Failed to get status')
          }

          const statusData = await statusResponse.json()

          // Check if job is completed
          if (statusData.status === 'COMPLETED_PRELANDER_IMAGE_GEN') {
            // Job completed - set progress to 100%
            setGenerationProgress(100)
            
            // Small delay to show 100% before processing results
            await new Promise(resolve => setTimeout(resolve, 500))

            // Step 2: Get results now that status is COMPLETED
            const resultResponse = await fetch(`/api/prelander-images/${jobId}/result?creditType=templates_images`, {
              method: 'GET',
              headers: {
                ...authHeaders,
              },
            })

            if (!resultResponse.ok) {
              const error = await resultResponse.json().catch(() => ({ error: 'Failed to get results' }))
              throw new Error(error.error || 'Failed to get results')
            }

            const resultData = await resultResponse.json()

            if (resultData.success && resultData.images && Array.isArray(resultData.images) && resultData.images.length > 0) {
              toast({
                title: "Images generated successfully",
                description: `Generated ${resultData.images.length} image${resultData.images.length !== 1 ? "s" : ""}.`,
              })

              if (onImagesGenerated) {
                onImagesGenerated(resultData.images)
              }

              // Close dialog after success
              onClose()
              return
            } else {
              throw new Error('No images returned from result endpoint')
            }
          } else if (statusData.status === 'FAILED_PRELANDER_IMAGE_GEN') {
            // Job failed, stop polling
            throw new Error(statusData.error || 'Image generation job failed')
          }
          // Otherwise status is RUNNING_PRELANDER_IMAGE_GEN or similar, continue polling
        } catch (pollError: any) {
          // If it's a failure status or explicit error, throw it
          if (pollError.message.includes('Failed to get status') || 
              pollError.message.includes('Image generation job failed') ||
              pollError.message.includes('No images returned') ||
              pollError.message.includes('Failed to get results')) {
            throw pollError
          }
          // Network error, continue polling
          continue
        }
      }

      throw new Error('Image generation timed out after 10 minutes')
    } catch (error) {
      console.error("Error generating images:", error)
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Failed to generate images. Please try again.",
        variant: "destructive",
      })
      setIsJobSubmitted(false)
      setGenerationProgress(0)
      setJobStartTime(null)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <Dialog open={showOverageDialog} onOpenChange={setShowOverageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Overage</DialogTitle>
            <DialogDescription>
              {pendingOverage
                ? `You don't have enough included credits for this job. The extra ${pendingOverage.overageCredits} credit${pendingOverage.overageCredits === 1 ? '' : 's'} will be charged as overage and added to your next invoice.`
                : "You don't have enough included credits for this job. The extra credits will be charged as overage and added to your next invoice."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowOverageDialog(false)
                setPendingOverage(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setShowOverageDialog(false)
                setPendingOverage(null)
                await handleGenerateImages(true)
              }}
            >
              Confirm & Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (showOverageDialog) return
          if (!isGenerating && !isJobSubmitted) onClose()
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Show generation view when job is submitted */}
        {isJobSubmitted ? (
          <div className="pt-8 pb-8">
            <div className="flex flex-col items-center justify-center space-y-6 py-12">
              {/* Animation/Spinner */}
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-primary/50" />
                </div>
              </div>

              {/* Message */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Generating Your Images</h3>
                <p className="text-muted-foreground">
                  Sit tight! We're creating {imageCount} amazing image{imageCount !== 1 ? 's' : ''} for your template.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(generationProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                {generationProgress >= 95 && generationProgress < 100 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Almost there! Finalizing your images...
                  </p>
                )}
                {generationProgress === 100 && (
                  <p className="text-xs text-center text-primary font-medium">
                    Complete! Processing your images...
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Credits in top corner - Positioned with proper spacing */}
            <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-md border text-sm bg-background shadow-sm">
                <div className="font-medium text-muted-foreground">
                  {imageCount} image{imageCount !== 1 ? 's' : ''} × {templateImageCredit} credit = <span className="text-foreground font-semibold">{totalJobCreditsRequired}</span> job credit{totalJobCreditsRequired !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Add top padding to prevent overlap with credits */}
            <div className="pt-16">
              <DialogHeader>
                <DialogTitle>Generate AI Images for Template</DialogTitle>
                <DialogDescription className="text-primary">
                  Upload a clear image of your product with a clean background
                </DialogDescription>
              </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Product Image Upload - REQUIRED */}
          <div className="space-y-2">
            <Label htmlFor="product-image-upload">
              Product Image <span className="text-destructive">*</span>
            </Label>
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
            {!productImageFile && (
              <p className="text-xs text-destructive">
                Product image is required to generate images.
              </p>
            )}
          </div>

          {/* NEW: Image Type Selection Step */}
          {productImageFile && (
            <div className="space-y-3 pt-4 border-t">
              <Label>Image Style <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-4">
                {/* Realistic Option */}
                <button
                  type="button"
                  onClick={() => setSelectedImageType('realistic')}
                  disabled={isGenerating}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    selectedImageType === 'realistic'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="aspect-video w-full mb-2 rounded overflow-hidden bg-muted">
                    <img
                      src="https://magicstudio.com/blog/content/images/2023/10/props-product-photography.webp"
                      alt="Realistic style example"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm font-medium text-center">Realistic</div>
                  {selectedImageType === 'realistic' && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>

                {/* Illustrative Option */}
                <button
                  type="button"
                  onClick={() => setSelectedImageType('illustrative')}
                  disabled={isGenerating}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    selectedImageType === 'illustrative'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="aspect-video w-full mb-2 rounded overflow-hidden bg-muted">
                    <img
                      src="https://res.cloudinary.com/dywojytq5/image/upload/v1770207554/Gemini_Generated_Image_irn6xirn6xirn6xi_a7lwcx.png"
                      alt="Illustrative style example"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm font-medium text-center">Illustrative</div>
                  {selectedImageType === 'illustrative' && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              </div>
              {!selectedImageType && (
                <p className="text-xs text-destructive">
                  Please select an image style to continue.
                </p>
              )}
            </div>
            )}
          </div>
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
                onClick={() => handleGenerateImages()}
                disabled={
                  isGenerating || 
                  !productImageFile || 
                  !selectedImageType || 
                  allPrompts.length === 0
                }
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    Generate Images
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
        </DialogContent>
      </Dialog>
    </>
  )
}
