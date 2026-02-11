"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon, CheckCircle2, Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { replaceImagesInHTML } from "@/lib/utils/image-replacer"
import { getAuthorizationHeader } from "@/lib/utils/client-auth"

interface ImageGenerationButtonProps {
  jobId: string
  html: string
  angleIndex?: number
  onImagesGenerated?: (imageCount: number, updatedHtml: string) => void
}

export function ImageGenerationButton({
  jobId,
  html,
  angleIndex,
  onImagesGenerated,
}: ImageGenerationButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [productImage, setProductImage] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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
      setProductImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveProductImage = () => {
    setProductImage(null)
    setProductImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenDialog = () => {
    // Reset product image when opening dialog fresh (optional - allows reusing)
    if (!isGenerating) {
      setIsDialogOpen(true)
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!isGenerating) {
      setIsDialogOpen(open)
    }
  }

  const handleGenerateImages = async () => {
    // Close dialog before starting generation
    setIsDialogOpen(false)
    setIsGenerating(true)
    setGeneratedCount(0)

    try {
      const authHeaders = getAuthorizationHeader()
      const formData = new FormData()
      formData.append('html', html)
      if (angleIndex !== undefined) {
        formData.append('angleIndex', angleIndex.toString())
      }
      if (productImage) {
        formData.append('productImage', productImage)
      }

      const response = await fetch(`/api/jobs/${jobId}/generate-images`, {
        method: "POST",
        headers: {
          ...authHeaders,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate images")
      }

      const data = await response.json()

      if (!data.success || !data.images || data.images.length === 0) {
        throw new Error("No images were generated")
      }

      // Replace images in the HTML string directly
      const replacements: Array<{ tag: string; url: string }> = data.images.map((img: any) => ({
        tag: String(img.tag),
        url: String(img.url),
      }))

      const updatedHtml = replaceImagesInHTML(html, replacements)

      // Update all iframes that contain this HTML
      // We need to find iframes that display this template and update their srcDoc
      const iframes = document.querySelectorAll('iframe')
      let iframesUpdated = 0
      iframes.forEach((iframe) => {
        try {
          const el = iframe as HTMLIFrameElement
          const currentSrcDoc = el.srcdoc || el.getAttribute('srcdoc') || ''
          // Check if this iframe contains our HTML by looking for unique markers
          // Check for data-image-role attributes that should be in our template
          const hasOurImages = replacements.some(({ tag }) => 
            currentSrcDoc.includes(`data-image-role="${tag}"`) || 
            currentSrcDoc.includes(`data-image-role='${tag}'`)
          )
          
          if (hasOurImages) {
            // Replace images in the iframe's HTML
            const updatedSrcDoc = replaceImagesInHTML(currentSrcDoc, replacements)
            el.srcdoc = updatedSrcDoc
            iframesUpdated++
            console.log(`✅ Updated iframe with ${replacements.length} image replacements`)
          }
        } catch (e) {
          // Silently handle iframe access issues (CORS, etc.)
          console.debug('Could not update iframe:', e)
        }
      })

      // Update UI immediately - don't wait for database save
      setGeneratedCount(replacements.length)
      setIsGenerating(false) // Set to false immediately after images are generated
      
      toast({
        title: "Images generated successfully",
        description: `Generated and replaced ${replacements.length} image${replacements.length !== 1 ? "s" : ""}. ${iframesUpdated > 0 ? `Updated ${iframesUpdated} preview${iframesUpdated !== 1 ? "s" : ""}.` : ''}`,
      })

      if (onImagesGenerated) {
        onImagesGenerated(replacements.length, updatedHtml)
      }

      // Save to database asynchronously (non-blocking) with timeout
      // Use AbortController for timeout
      const saveController = new AbortController()
      const saveTimeout = setTimeout(() => {
        saveController.abort()
        console.warn('⚠️ Save operation timed out after 30 seconds')
      }, 30000) // 30 second timeout

      // Run save in background without blocking
      ;(async () => {
        try {
          // Get the injected template ID for this job and angle (without HTML to make it faster)
          const templateUrl = `/api/jobs/${jobId}/injected-templates${angleIndex !== undefined ? `?angleIndex=${angleIndex}` : ''}`
          const templateResponse = await fetch(templateUrl, {
            headers: {
              ...authHeaders,
            },
            signal: saveController.signal,
          })
          
          clearTimeout(saveTimeout)
          
          if (templateResponse.ok) {
            const templateData = await templateResponse.json()
            const templates = templateData.data?.templates || templateData.templates || []
            
            // Find the matching template (by angle index if provided)
            const templateToUpdate = angleIndex !== undefined 
              ? templates.find((t: any) => t.angle_index === angleIndex + 1)
              : templates[0]
            
            if (templateToUpdate?.id) {
              // Update the template in database
              const saveController2 = new AbortController()
              const saveTimeout2 = setTimeout(() => saveController2.abort(), 30000)
              
              const saveResponse = await fetch(`/api/templates/injected/${templateToUpdate.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...authHeaders,
                },
                body: JSON.stringify({ html: updatedHtml }),
                signal: saveController2.signal,
              })
              
              clearTimeout(saveTimeout2)
              
              if (saveResponse.ok) {
                console.log('✅ Template saved to database')
                toast({
                  title: "Saved to database",
                  description: "Template has been saved successfully.",
                })
              } else {
                const errorData = await saveResponse.json().catch(() => ({}))
                console.warn('⚠️ Failed to save template to database:', errorData)
              }
            } else {
              console.warn('⚠️ No matching template found to save')
            }
          } else {
            console.warn('⚠️ Failed to fetch templates for saving')
          }
        } catch (saveError: any) {
          clearTimeout(saveTimeout)
          if (saveError.name === 'AbortError') {
            console.warn('⚠️ Save operation timed out after 30 seconds')
          } else {
            console.error('Error saving template to database:', saveError)
          }
          // Don't show error toast - save is optional, images are already generated
        }
      })()
    } catch (error) {
      console.error("Error generating images:", error)
      setIsGenerating(false) // Make sure to reset on error
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Failed to generate images. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
    <Button
        onClick={handleOpenDialog}
      disabled={isGenerating}
      variant="outline"
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating Images...
        </>
      ) : generatedCount > 0 ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          {generatedCount} Image{generatedCount !== 1 ? "s" : ""} Generated
        </>
      ) : (
        <>
          <ImageIcon className="h-4 w-4" />
          Generate AI Images
        </>
      )}
    </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => handleDialogClose(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate AI Images</DialogTitle>
            <DialogDescription>
              Upload a product image to include in the generated images, or skip to generate without a product image.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`product-image-upload-${jobId}`}>Product Image (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id={`product-image-upload-${jobId}`}
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
                  {productImage ? 'Change Image' : 'Select Image'}
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
              {productImage && (
                <p className="text-xs text-muted-foreground">
                  Selected: {productImage.name} ({(productImage.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateImages}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
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
    </>
  )
}


