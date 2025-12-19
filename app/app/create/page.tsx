"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Info, Zap, CheckCircle, Globe } from "lucide-react"
import { SiAmazon, SiReddit } from "react-icons/si"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useCreateMarketingAngle, useUpdateMarketingAngle } from "@/lib/hooks/use-jobs"
import { useRouter } from "next/navigation"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AvatarExtractionDialog } from "@/components/avatar-extraction-dialog"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { useToast } from "@/hooks/use-toast"
import { isValidUrl } from "@/lib/utils/validation"
import { logger } from "@/lib/utils/logger"
import { INITIAL_SOURCE_STATUS, COMPLETED_SOURCE_STATUS, resetSourceStatus, completeSourceStatus, type SourceStatus } from "@/lib/constants/research-sources"
import { UsageLimitDialog } from "@/components/ui/usage-limit-dialog"

interface CustomerAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
  pain_point?: string
  emotion?: string
  desire?: string
  characteristics?: string[]
  objections?: string[]
  failed_alternatives?: string[]
  is_broad_avatar?: boolean
  is_researched?: boolean  // Mark if user selected this avatar
}

interface PipelineFormData {
  title: string
  brand_info: string
  sales_page_url: string
  target_approach?: string
  avatars?: CustomerAvatar[]  // Single source of truth - all avatars with is_researched flag
  product_image?: string  // Base64 screenshot from avatar extraction
}

// Helper to get selected avatars
const getSelectedAvatars = (avatars?: CustomerAvatar[]): CustomerAvatar[] => {
  return avatars?.filter(a => a.is_researched === true) || []
}

// Helper to get first selected avatar (for display)
const getFirstSelectedAvatar = (avatars?: CustomerAvatar[]): CustomerAvatar | undefined => {
  return getSelectedAvatars(avatars)[0]
}

// Helper to get selected avatar index (1-based) in the original array
const getSelectedAvatarIndex = (avatars?: CustomerAvatar[]): number => {
  const selectedAvatars = getSelectedAvatars(avatars)
  if (selectedAvatars.length === 0) return 1

  const firstSelected = selectedAvatars[0]
  const index = avatars?.findIndex(a => a.persona_name === firstSelected.persona_name) ?? -1
  return index >= 0 ? index + 1 : 1 // 1-based index
}

export default function CreatePage() {
  const { user, isAuthenticated, isReady } = useRequireAuth()
  const createMarketingAngleMutation = useCreateMarketingAngle()
  const updateMarketingAngleMutation = useUpdateMarketingAngle()
  const router = useRouter()

  // Use auto-polling for processing marketing angles (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()
  const { toast } = useToast()

  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    brand_info: "",
    sales_page_url: "",
    target_approach: "explore",
    avatars: [],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [avatarExtractionJobId, setAvatarExtractionJobId] = useState<string | null>(null)
  // Use ref to avoid async state timing issues when submitting immediately after avatar extraction
  const avatarExtractionJobIdRef = useRef<string | null>(null)

  // Avatar extraction dialog state
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)

  // URL popup state
  const [showUrlPopup, setShowUrlPopup] = useState(false)
  const [hasSeenUrlPopup, setHasSeenUrlPopup] = useState(false)

  // Research generation loading state
  const [showResearchLoading, setShowResearchLoading] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [researchStage, setResearchStage] = useState(0)
  const [currentMarketingAngleId, setCurrentMarketingAngleId] = useState<string | null>(null)

  // Individual source completion status
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(INITIAL_SOURCE_STATUS)

  // Usage limit dialog state
  const [showUsageLimitDialog, setShowUsageLimitDialog] = useState(false)
  const [usageLimitData, setUsageLimitData] = useState<{
    usageType: 'deep_research' | 'pre_lander'
    currentUsage: number
    limit: number
  } | null>(null)

  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  // Check if form is valid (all required fields are filled)
  // Returns true if form is invalid/empty (button should be disabled)
  const isFormEmpty = (): boolean => {
    // Title is required
    if (!formData.title.trim()) {
      return true
    }

    // Sales page URL is required
    if (!formData.sales_page_url.trim()) {
      return true
    }

    // Check if target_approach is set (it has a default, but check anyway)
    if (!formData.target_approach) {
      return true
    }

    // For "known" approach, check if customer avatar fields are complete
    if (formData.target_approach === 'known') {
      const avatar = getFirstSelectedAvatar(formData.avatars)
      if (!avatar) {
        return true
      }
      // All required avatar fields must be filled
      if (!avatar.persona_name?.trim() ||
        !avatar.description?.trim() ||
        !avatar.age_range?.trim() ||
        !avatar.gender?.trim() ||
        !avatar.key_buying_motivation?.trim()) {
        return true
      }
    }

    // For "explore" approach, avatars are optional initially (will be generated)
    // So we don't need to check for avatars here

    return false // Form is valid, button should be enabled
  }

  const validateForm = (dataToValidate?: PipelineFormData): boolean => {
    const data = dataToValidate || formData
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    // Validate Project Details
    if (!data.title.trim()) {
      newErrors.title = "Project title is required"
    }
    // Brand info is optional - no validation needed
    if (!data.sales_page_url.trim()) {
      newErrors.sales_page_url = "Sales page URL is required"
    } else if (!isValidUrl(data.sales_page_url)) {
      newErrors.sales_page_url = "Please enter a valid URL"
    }
    if (!data.target_approach) {
      newErrors.target_approach = "Please select an approach"
    }
    // Note: For "explore" approach, avatars will be generated when button is clicked
    // For "known" approach, avatars should already be provided
    if (data.target_approach === 'known' && getSelectedAvatars(data.avatars).length === 0) {
      newErrors.avatars = "Please provide customer avatar information"
    }
    // For "explore" approach, ensure avatars were generated and selected
    if (data.target_approach === 'explore' && getSelectedAvatars(data.avatars).length === 0) {
      newErrors.avatars = "Please generate and select avatars before proceeding"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const submitForm = async (skipAvatarCheck: boolean = false, updatedFormData?: PipelineFormData) => {
    // Use updated form data if provided, otherwise use current state
    const dataToSubmit = updatedFormData || formData

    // If user selected "explore new avatars" but hasn't selected any yet, show the extraction dialog
    if (!skipAvatarCheck && dataToSubmit.target_approach === 'explore' && getSelectedAvatars(dataToSubmit.avatars).length === 0) {
      setShowAvatarDialog(true)
      return
    }

    // Validate form before submitting (using provided data or current formData state)
    if (!validateForm(dataToSubmit)) return

    // Prevent duplicate submissions
    if (isLoading) return

    // For "known" approach, proceed with normal submission
    try {
      setIsLoading(true)

      let createdMarketingAngle: any

      // If we have an avatar extraction job ID, UPDATE it instead of creating new
      // The API will automatically detect if execution_id is missing and submit to DeepCopy
      // Use ref to avoid async state timing issues when submitting immediately after avatar extraction
      const jobIdToUse = avatarExtractionJobIdRef.current || avatarExtractionJobId
      if (jobIdToUse) {
        createdMarketingAngle = await updateMarketingAngleMutation.mutateAsync({
          id: jobIdToUse,
          title: dataToSubmit.title,
          brand_info: dataToSubmit.brand_info || '',
          sales_page_url: dataToSubmit.sales_page_url,
          target_approach: dataToSubmit.target_approach || 'explore',
          avatars: dataToSubmit.avatars || [],
          product_image: dataToSubmit.product_image
        })
      } else {
        // Normal create flow
        createdMarketingAngle = await createMarketingAngleMutation.mutateAsync({
          ...dataToSubmit,
          brand_info: dataToSubmit.brand_info || '', // Ensure brand_info is always a string
          advertorial_type: 'Advertorial', // Default value since it's required by the API
          target_approach: dataToSubmit.target_approach || 'explore',
          avatars: dataToSubmit.avatars || [],
          product_image: dataToSubmit.product_image, // Pass product_image from avatar extraction
        })
      }

      // Set marketing angle ID for polling
      setCurrentMarketingAngleId(createdMarketingAngle.id)

      // Clear avatar extraction job ID after successful update
      if (jobIdToUse) {
        avatarExtractionJobIdRef.current = null
        setAvatarExtractionJobId(null)
      }

      // Show research generation loading dialog
      setShowResearchLoading(true)
      setResearchProgress(0)
      setResearchStage(0)

      // Reset source status
      setSourceStatus(resetSourceStatus())

      // Start slow progress animation that accommodates variable processing times (5-8+ minutes)
      // Progress increases slowly to reach ~85% over 8 minutes, then waits for completion
      const startTime = Date.now()
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000 // seconds
        const estimatedMaxTime = 480 // 8 minutes in seconds
        const baseProgress = Math.min(85, (elapsed / estimatedMaxTime) * 85)

        setResearchProgress(prev => {
          // Only update if calculated progress is higher than current
          // This prevents going backwards when status updates come in
          return Math.max(prev, Math.floor(baseProgress))
        })

        // Update source status based on elapsed time (in seconds) - 45 second intervals
        const elapsedSeconds = elapsed
        if (elapsedSeconds >= 45) setSourceStatus(prev => ({ ...prev, webSearch: true }))
        if (elapsedSeconds >= 90) setSourceStatus(prev => ({ ...prev, amazonReviews: true }))
        if (elapsedSeconds >= 135) setSourceStatus(prev => ({ ...prev, redditDiscussions: true }))
        if (elapsedSeconds >= 180) setSourceStatus(prev => ({ ...prev, industryBlogs: true }))
        if (elapsedSeconds >= 225) setSourceStatus(prev => ({ ...prev, competitorAnalysis: true }))
        // Market Trends remains in progress until actual completion (not time-based)
      }, 1000) // Update every second for smoother progress

      // Update stages based on elapsed time (more spread out for longer processing)
      setTimeout(() => setResearchStage(1), 30000)   // Stage 1 at 30s
      setTimeout(() => setResearchStage(2), 90000)   // Stage 2 at 1.5min
      setTimeout(() => setResearchStage(3), 180000)  // Stage 3 at 3min
      setTimeout(() => setResearchStage(4), 300000)  // Stage 4 at 5min

      // Poll for marketing angle status
      const pollMarketingAngleStatus = async () => {
        const maxAttempts = 180 // Max 15 minutes (180 * 5s) to accommodate longer processing
        const pollInterval = 5000 // Poll every 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const response = await fetch(`/api/marketing-angles/${createdMarketingAngle.id}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            })

            if (!response.ok) {
              throw new Error(`Status check failed: ${response.status}`)
            }

            const data = await response.json()
            const status = data.status?.toLowerCase()

            // Update progress and stage based on status
            if (status === 'submitted') {
              setResearchStage(1)
              setResearchProgress(prev => Math.max(prev, 15))
            } else if (status === 'running' || status === 'processing') {
              // Gradually increase stage as processing continues based on elapsed time
              const elapsed = (Date.now() - startTime) / 1000
              if (elapsed > 180) {
                setResearchStage(3) // Move to Reddit & Forums stage after 3 min
              } else if (elapsed > 90) {
                setResearchStage(2) // Move to Competitors stage after 1.5 min
              }
              // Progress increases gradually, capped at 85% until completion
              const progressFromTime = Math.min(85, 20 + (elapsed / 480) * 65)
              setResearchProgress(prev => Math.max(prev, Math.floor(progressFromTime)))
            } else if (status === 'completed' || status === 'succeeded') {
              clearInterval(progressInterval)
              setResearchStage(4)
              setResearchProgress(100)

              // Mark all sources as complete
              setSourceStatus(completeSourceStatus())

              // Wait a moment then redirect to results
              setTimeout(() => {
                setShowResearchLoading(false)
                setResearchProgress(0)
                setResearchStage(0)
                setCurrentMarketingAngleId(null)

                // Reset source status
                setSourceStatus(resetSourceStatus())

                // Reset form
                setFormData({
                  title: "",
                  brand_info: "",
                  sales_page_url: "",
                  target_approach: "explore",
                  avatars: [],
                })
                setErrors({})
                setGeneralError(null)
                avatarExtractionJobIdRef.current = null
                setAvatarExtractionJobId(null) // Clear avatar extraction job ID

                // Redirect to results page
                router.push(`/results/${createdMarketingAngle.id}`)
              }, 1000)
              return
            } else if (status === 'failed' || status === 'failure') {
              clearInterval(progressInterval)
              setShowResearchLoading(false)
              setResearchProgress(0)
              setResearchStage(0)
              setCurrentMarketingAngleId(null)

              // Reset source status
              setSourceStatus(resetSourceStatus())

              toast({
                title: "Error",
                description: "Marketing angle processing failed. Please try again.",
                variant: "destructive",
              })
              return
            }

            // If still processing, wait and try again
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval))
            }

          } catch (err) {
            if (attempt === maxAttempts) {
              clearInterval(progressInterval)
              setShowResearchLoading(false)
              setResearchProgress(0)
              setResearchStage(0)
              setCurrentMarketingAngleId(null)

              // Reset source status
              setSourceStatus(resetSourceStatus())

              toast({
                title: "Error",
                description: "Failed to check marketing angle status. Please check your marketing angles page.",
                variant: "destructive",
              })
              return
            }
            // Continue polling on intermediate errors
            await new Promise(resolve => setTimeout(resolve, pollInterval))
          }
        }

        // Timeout reached
        clearInterval(progressInterval)
        setShowResearchLoading(false)
        setResearchProgress(0)
        setResearchStage(0)
        setCurrentMarketingAngleId(null)

        // Reset source status
        setSourceStatus({
          webSearch: false,
          amazonReviews: false,
          redditDiscussions: false,
          industryBlogs: false,
          competitorAnalysis: false,
          marketTrends: false,
        })

        toast({
          title: "Processing Taking Longer",
          description: "Your marketing angle is still processing. This can take 5-8 minutes or more. Please check your marketing angles page for updates.",
          variant: "default",
        })
      }

      // Start polling
      pollMarketingAngleStatus()

      // Reset loading state (polling happens in background)
      setIsLoading(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create marketing angle'
      const errorWithStatus = error as Error & { status?: number; currentUsage?: number; limit?: number }

      // Check if it's a usage limit error (429)
      if (errorWithStatus.status === 429) {
        setUsageLimitData({
          usageType: 'deep_research',
          currentUsage: errorWithStatus.currentUsage || 0,
          limit: errorWithStatus.limit || 0
        })
        setShowUsageLimitDialog(true)
        setIsLoading(false)
        return
      }

      // Show error toast for other errors
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })

      // Check if it's a duplicate marketing angle error
      if (errorMessage.includes('Duplicate job detected') || errorMessage.includes('Duplicate marketing angle')) {
        setErrors({
          title: 'A marketing angle with this title was created recently. Please wait a moment or use a different title.'
        })
        setGeneralError(errorMessage)
      } else {
        setGeneralError(errorMessage)
      }

      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitForm(false)
  }

  const handleAvatarsSelected = async (selectedAvatars: any[], allAvatars: any[], shouldClose: boolean = true, autoSubmit: boolean = false, productImage?: string, extractionJobId?: string) => {
    try {
      // Store the avatar extraction job ID if provided (from initial extraction)
      // Set both ref (immediate) and state (for UI) to avoid async timing issues
      if (extractionJobId) {
        avatarExtractionJobIdRef.current = extractionJobId
        setAvatarExtractionJobId(extractionJobId)
      }

      // Mark selected avatars as researched
      const avatarsWithResearch = allAvatars.map(avatar => ({
        ...avatar,
        is_researched: selectedAvatars.some(selected =>
          selected.persona_name === avatar.persona_name
        ) ? true : (avatar.is_researched || false)
      }))

      const updatedFormData: PipelineFormData = {
        ...formData,
        avatars: avatarsWithResearch,  // Single array with all avatars
        product_image: productImage || formData.product_image  // Store product_image from avatar extraction
      }

      setFormData(updatedFormData)

      // Close the dialog only if shouldClose is true
      if (shouldClose) {
        setShowAvatarDialog(false)
      }

      // If autoSubmit is true, trigger form submission automatically with updated data
      if (autoSubmit) {
        // Use setTimeout to ensure state is set, then submit with the updated data
        setTimeout(() => {
          submitForm(true, updatedFormData)
        }, 50)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update avatar selection. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }


  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6 overflow-y-auto h-full">
            <div className="mb-4 md:mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create New Content</h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">Generate AI-powered marketing content from your sales page</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-foreground">Project Details</h2>
                  <p className="text-muted-foreground text-lg">Fill in your project information to generate AI-powered content</p>
                </div>

                {/* Main Form */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                      {/* Project Title Section */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="title" className="text-base font-semibold text-foreground">
                            Project Title <span className="text-destructive">*</span>
                          </Label>
                          <p className="text-sm text-muted-foreground">Give your project a descriptive name</p>
                        </div>
                        <Input
                          id="title"
                          placeholder="e.g., Product Launch Pre-Lander"
                          value={formData.title}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, title: e.target.value }))
                            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                          }}
                          disabled={isLoading}
                          className={`h-12 text-base ${errors.title ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                        />
                        {errors.title && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {errors.title}
                          </p>
                        )}
                      </div>

                      {/* Sales Page URL Section */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="sales_page_url" className="text-base font-semibold text-foreground">
                            Current Sales Page URL <span className="text-destructive">*</span>
                          </Label>
                          <p className="text-sm text-muted-foreground">Provide the URL of your existing sales page</p>
                        </div>
                        <Input
                          id="sales_page_url"
                          placeholder="https://example.com/current-page"
                          value={formData.sales_page_url}
                          onChange={(e) => {
                            const newUrl = e.target.value
                            setFormData((prev) => ({ ...prev, sales_page_url: newUrl }))

                            // Show popup when valid URL is entered (only once)
                            if (!hasSeenUrlPopup && isValidUrl(newUrl)) {
                              setShowUrlPopup(true)
                              setHasSeenUrlPopup(true)
                            }
                          }}
                          disabled={isLoading}
                          className={`h-12 text-base ${errors.sales_page_url ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                        />
                        {errors.sales_page_url && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {errors.sales_page_url}
                          </p>
                        )}
                      </div>

                      {/* Target Audience Section */}
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">Target Audience</h3>
                          <p className="text-sm text-muted-foreground">Select which target audience you want to research</p>
                        </div>

                        {/* Choose Your Approach */}
                        <div className="space-y-4">

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                              className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${formData.target_approach === 'explore'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                              onClick={() => setFormData(prev => ({ ...prev, target_approach: 'explore', avatars: [] }))}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.target_approach === 'explore' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                  }`}>
                                  {formData.target_approach === 'explore' && (
                                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-base text-foreground mb-2">I want to explore new avatars</h4>
                                  <p className="text-sm text-muted-foreground mb-3">that I can do research on</p>
                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    <p>• Discover new customer segments</p>
                                    <p>• Research market opportunities</p>
                                    <p>• Test different audience approaches</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div
                              className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${formData.target_approach === 'known'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                              onClick={() => setFormData(prev => ({ ...prev, target_approach: 'known', avatars: [] }))}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.target_approach === 'known' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                  }`}>
                                  {formData.target_approach === 'known' && (
                                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-base text-foreground mb-2">I know exactly who my customer is</h4>
                                  <p className="text-sm text-muted-foreground mb-3">and want to target them specifically</p>
                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    <p>• Define specific demographics</p>
                                    <p>• Target existing customer base</p>
                                    <p>• Optimize for known preferences</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Conditional Content Based on Approach */}
                        {formData.target_approach === 'explore' && (
                          <div className="space-y-4">
                            <div
                              className="p-4 rounded-lg border"
                              style={{
                                backgroundColor: 'rgba(93, 113, 242, 0.1)',
                                borderColor: 'rgba(93, 113, 242, 0.3)'
                              }}
                            >
                              <h4
                                className="font-medium text-sm mb-3"
                                style={{ color: '#5d71f2' }}
                              >
                                AI Avatar Discovery
                              </h4>
                              <p
                                className="text-sm mb-4"
                                style={{ color: 'rgba(93, 113, 242, 0.9)' }}
                              >
                                Our AI will analyze your sales page to discover and extract customer personas automatically.
                                No manual selection needed - just provide your sales page URL and we'll do the research for you.
                              </p>
                              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(93, 113, 242, 0.85)' }}>
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: '#5d71f2' }}
                                ></div>
                                <span>Avatars will be extracted after you submit the form</span>
                              </div>
                            </div>

                            {getSelectedAvatars(formData.avatars).length > 0 && (
                              <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="text-sm text-muted-foreground">
                                  {getSelectedAvatars(formData.avatars).length} avatar{getSelectedAvatars(formData.avatars).length > 1 ? 's' : ''} selected
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowAvatarDialog(true)}
                                  className="h-9"
                                >
                                  Update Avatars
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {formData.target_approach === 'known' && (
                          <div className="space-y-4">
                            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                              <h4 className="font-medium text-sm mb-3 text-primary">
                                Define Your Target Persona
                              </h4>
                              <p className="text-sm text-primary/90 mb-4">
                                Describe your specific target customer persona with all required details:
                              </p>

                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-foreground">
                                    Persona Name <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    placeholder="e.g., Health-conscious professionals, Tech-savvy millennials, Busy parents..."
                                    value={getFirstSelectedAvatar(formData.avatars)?.persona_name || ''}
                                    onChange={(e) => {
                                      const currentAvatars = formData.avatars || []
                                      const firstAvatar = getFirstSelectedAvatar(formData.avatars)
                                      const updatedAvatars = firstAvatar
                                        ? currentAvatars.map(a =>
                                          a.is_researched ? { ...a, persona_name: e.target.value } : a
                                        )
                                        : [{
                                          persona_name: e.target.value,
                                          description: '',
                                          age_range: '',
                                          gender: '',
                                          key_buying_motivation: '',
                                          is_researched: true
                                        }, ...currentAvatars]

                                      setFormData((prev) => ({ ...prev, avatars: updatedAvatars }))
                                    }}
                                    disabled={isLoading}
                                    className="h-11 text-sm border-primary/20 focus-visible:ring-primary"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-foreground">
                                    Description <span className="text-destructive">*</span>
                                  </Label>
                                  <Textarea
                                    placeholder="Describe their lifestyle, motivations, and key challenges in 1-2 sentences..."
                                    value={getFirstSelectedAvatar(formData.avatars)?.description || ''}
                                    onChange={(e) => {
                                      const currentAvatars = formData.avatars || []
                                      const firstAvatar = getFirstSelectedAvatar(formData.avatars)
                                      const updatedAvatars = firstAvatar
                                        ? currentAvatars.map(a =>
                                          a.is_researched ? { ...a, description: e.target.value } : a
                                        )
                                        : [{
                                          persona_name: '',
                                          description: e.target.value,
                                          age_range: '',
                                          gender: '',
                                          key_buying_motivation: '',
                                          is_researched: true
                                        }, ...currentAvatars]

                                      setFormData((prev) => ({ ...prev, avatars: updatedAvatars }))
                                    }}
                                    rows={3}
                                    disabled={isLoading}
                                    className="text-sm border-primary/20 focus-visible:ring-primary"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-foreground">
                                      Age Range <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                      value={getFirstSelectedAvatar(formData.avatars)?.age_range || ''}
                                      onValueChange={(value) => {
                                        const currentAvatars = formData.avatars || []
                                        const firstAvatar = getFirstSelectedAvatar(formData.avatars)
                                        const updatedAvatars = firstAvatar
                                          ? currentAvatars.map(a =>
                                            a.is_researched ? { ...a, age_range: value } : a
                                          )
                                          : [{
                                            persona_name: '',
                                            description: '',
                                            age_range: value,
                                            gender: '',
                                            key_buying_motivation: '',
                                            is_researched: true
                                          }, ...currentAvatars]

                                        setFormData((prev) => ({ ...prev, avatars: updatedAvatars }))
                                      }}
                                      disabled={isLoading}
                                    >
                                      <SelectTrigger className="h-11 text-sm border-primary/20 focus-visible:ring-primary">
                                        <SelectValue placeholder="Select age range" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="18-24" className="text-sm py-2">18-24 (Gen Z)</SelectItem>
                                        <SelectItem value="25-34" className="text-sm py-2">25-34 (Millennials)</SelectItem>
                                        <SelectItem value="35-44" className="text-sm py-2">35-44 (Millennials)</SelectItem>
                                        <SelectItem value="45-54" className="text-sm py-2">45-54 (Gen X)</SelectItem>
                                        <SelectItem value="55-64" className="text-sm py-2">55-64 (Gen X)</SelectItem>
                                        <SelectItem value="65+" className="text-sm py-2">65+ (Boomers)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-foreground">
                                      Gender <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                      value={getFirstSelectedAvatar(formData.avatars)?.gender || ''}
                                      onValueChange={(value) => {
                                        const currentAvatars = formData.avatars || []
                                        const firstAvatar = getFirstSelectedAvatar(formData.avatars)
                                        const updatedAvatars = firstAvatar
                                          ? currentAvatars.map(a =>
                                            a.is_researched ? { ...a, gender: value } : a
                                          )
                                          : [{
                                            persona_name: '',
                                            description: '',
                                            age_range: '',
                                            gender: value,
                                            key_buying_motivation: '',
                                            is_researched: true
                                          }, ...currentAvatars]

                                        setFormData((prev) => ({ ...prev, avatars: updatedAvatars }))
                                      }}
                                      disabled={isLoading}
                                    >
                                      <SelectTrigger className="h-11 text-sm border-primary/20 focus-visible:ring-primary">
                                        <SelectValue placeholder="Select gender" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="male" className="text-sm py-2">Male</SelectItem>
                                        <SelectItem value="female" className="text-sm py-2">Female</SelectItem>
                                        <SelectItem value="both" className="text-sm py-2">Both</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-foreground">
                                    Key Buying Motivation <span className="text-destructive">*</span>
                                  </Label>
                                  <Textarea
                                    placeholder="What drives them to purchase this product? What problem does it solve for them?"
                                    value={getFirstSelectedAvatar(formData.avatars)?.key_buying_motivation || ''}
                                    onChange={(e) => {
                                      const currentAvatars = formData.avatars || []
                                      const firstAvatar = getFirstSelectedAvatar(formData.avatars)
                                      const updatedAvatars = firstAvatar
                                        ? currentAvatars.map(a =>
                                          a.is_researched ? { ...a, key_buying_motivation: e.target.value } : a
                                        )
                                        : [{
                                          persona_name: '',
                                          description: '',
                                          age_range: '',
                                          gender: '',
                                          key_buying_motivation: e.target.value,
                                          is_researched: true
                                        }, ...currentAvatars]

                                      setFormData((prev) => ({ ...prev, avatars: updatedAvatars }))
                                    }}
                                    rows={2}
                                    disabled={isLoading}
                                    className="text-sm border-primary/20 focus-visible:ring-primary"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error display for avatars */}
                        {errors.avatars && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {errors.avatars}
                          </p>
                        )}
                      </div>

                      {/* Error Summary */}
                      {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="border-destructive/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">Please fix the errors above before submitting.</AlertDescription>
                        </Alert>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-4 pt-4">
                        <Button
                          type="submit"
                          className="flex-1 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                          disabled={isLoading || isFormEmpty()}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Content...
                            </>
                          ) : (
                            "Generate AI Content"
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Avatar Extraction Dialog */}
      <AvatarExtractionDialog
        isOpen={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
        onAvatarsSelected={handleAvatarsSelected}
        salesPageUrl={formData.sales_page_url}
        formData={formData}
        isLoading={isLoading}
      />

      {/* Research Generation Loading Dialog */}
      <Dialog open={showResearchLoading} onOpenChange={(open) => {
        if (!open) {
          setShowResearchLoading(false)
        }
      }}>
        <DialogContent className="max-w-2xl border-border">
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-semibold text-primary text-center">
              Yes, our research takes a while… that's
              why it will convert!
            </p>
          </div>
          <div className="flex flex-col py-6 space-y-6">
            {/* Selected Avatar */}
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Selected Avatar</p>
                <p className="text-base font-semibold text-foreground">
                  {getFirstSelectedAvatar(formData.avatars)?.persona_name
                    ? `Avatar ${getSelectedAvatarIndex(formData.avatars)}: ${getFirstSelectedAvatar(formData.avatars)!.persona_name}`
                    : `Avatar ${getSelectedAvatarIndex(formData.avatars)}: Evidence-seeking fitness enthusiasts`}
                </p>
              </div>
            </div>

            {/* Analyzing Sources */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Analyzing Sources:</h3>
              <div className="space-y-2">
                {/* Web Search */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5" style={{ color: '#3B82F6' }} />
                    <span className="text-sm font-medium text-foreground">Web Search</span>
                  </div>
                  {sourceStatus.webSearch ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Amazon Reviews */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <SiAmazon className="w-5 h-5" style={{ color: '#FF9900' }} />
                    <span className="text-sm font-medium text-foreground">Amazon Reviews</span>
                  </div>
                  {sourceStatus.amazonReviews ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Reddit Discussions */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <SiReddit className="w-5 h-5" style={{ color: '#FF4500' }} />
                    <span className="text-sm font-medium text-foreground">Reddit Discussions</span>
                  </div>
                  {sourceStatus.redditDiscussions ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Industry Blogs */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📝</span>
                    <span className="text-sm font-medium text-foreground">Industry Blogs</span>
                  </div>
                  {sourceStatus.industryBlogs ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Competitor Analysis */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔍</span>
                    <span className="text-sm font-medium text-foreground">Competitor Analysis</span>
                  </div>
                  {sourceStatus.competitorAnalysis ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Market Trends */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <span className="text-sm font-medium text-foreground">Market Trends</span>
                  </div>
                  {sourceStatus.marketTrends ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>
              </div>
            </div>

            {/* Compiling Message - Show when all sources are complete but marketing angle is still processing */}
            {sourceStatus.webSearch &&
              sourceStatus.amazonReviews &&
              sourceStatus.redditDiscussions &&
              sourceStatus.industryBlogs &&
              sourceStatus.competitorAnalysis &&
              sourceStatus.marketTrends &&
              researchProgress < 100 && (
                <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Compiling Your Results</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All research sources have been analyzed. We're now generating your high-converting Pre-Landers...
                    </p>
                  </div>
                </div>
              )}

            {/* Information Message */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">You can close this window</p>
                  <p className="text-sm text-muted-foreground">
                    We'll send you an email notification when your Pre-Landers are ready. Feel free to continue working on other things.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Popup Dialog */}
      <Dialog open={showUrlPopup} onOpenChange={setShowUrlPopup}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-left text-base font-semibold text-foreground">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Info className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="flex-1">
                Important: <span className="font-normal text-foreground">Product URL</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-foreground text-sm leading-relaxed">
              Make sure to enter the URL of the product, service or offer you want to sell - not your general business URL.
            </p>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setShowUrlPopup(false)}
              className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700 text-white px-6 font-normal"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Limit Dialog */}
      {usageLimitData && (
        <UsageLimitDialog
          open={showUsageLimitDialog}
          onOpenChange={setShowUsageLimitDialog}
          usageType={usageLimitData.usageType}
          currentUsage={usageLimitData.currentUsage}
          limit={usageLimitData.limit}
        />
      )}
    </ErrorBoundary>
  )
}
