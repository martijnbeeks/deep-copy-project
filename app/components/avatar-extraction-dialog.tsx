"use client"

import { useState, useEffect, memo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, CheckCircle, AlertCircle, Users, User, Brain, FileText, Target, Edit3 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ExtractedAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
  pain_point?: string
  emotion?: string
  desire?: string
  hook_line?: string
  is_broad_avatar?: boolean
  is_researched?: boolean  // Mark if user selected this avatar
  characteristics?: string[]
  objections?: string[]
  failed_alternatives?: string[]
}

interface AvatarExtractionDialogProps {
  isOpen: boolean
  onClose: () => void
  onAvatarsSelected: (selected: ExtractedAvatar[], all: ExtractedAvatar[], shouldClose?: boolean, autoSubmit?: boolean, productImage?: string) => void
  salesPageUrl: string
  formData: any
  isLoading?: boolean
}

function AvatarExtractionDialogComponent({
  isOpen,
  onClose,
  onAvatarsSelected,
  salesPageUrl,
  formData,
  isLoading = false
}: AvatarExtractionDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [avatars, setAvatars] = useState<ExtractedAvatar[]>([])
  const [selectedAvatars, setSelectedAvatars] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0)
  const [openItem, setOpenItem] = useState<string | undefined>(undefined)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState(0)
  const [showVerification, setShowVerification] = useState(false)
  const [verificationFormData, setVerificationFormData] = useState({
    companyType: "",
    productDescription: ""
  })

  // Sync verification form data with formData prop
  useEffect(() => {
    if (formData) {
      setVerificationFormData({
        companyType: formData.companyType || "",
        productDescription: formData.productDescription || ""
      })
    }
  }, [formData])

  useEffect(() => {
    if (isOpen && salesPageUrl) {
      setError(null)

      // If avatars were previously extracted, reuse them instead of calling the API again
      if (Array.isArray(formData?.avatars) && formData.avatars.length > 0) {
        setIsAnalyzing(false)
        // Mark the first avatar as broad persona when target_approach is "explore"
        const extracted = formData.avatars.map((avatar: ExtractedAvatar, index: number) => ({
          ...avatar,
          // Mark first avatar as broad persona if target_approach is "explore"
          is_broad_avatar: index === 0 && formData?.target_approach === 'explore' ? true : avatar.is_broad_avatar
        }))
        setAvatars(extracted)

        // Preselect researched avatars
        const researchedIndices = extracted
          .map((avatar: ExtractedAvatar, index: number) => avatar.is_researched ? index : -1)
          .filter((index: number) => index >= 0)
        setSelectedAvatars(new Set(researchedIndices))
      } else {
        // Fresh extraction flow
        setAvatars([])
        setSelectedAvatars(new Set())
        extractAvatars()
      }
    }
  }, [isOpen, salesPageUrl])

  const ensureToken = async () => {
    const now = Date.now()
    if (accessToken && tokenExpiresAt && now < tokenExpiresAt) {
      return accessToken
    }
    const { internalApiClient } = await import('@/lib/clients/internal-client')
    const data = await internalApiClient.getAvatarToken() as { access_token: string; expires_in: number }
    const expiresAt = Date.now() + Math.max(0, (data.expires_in - 30)) * 1000
    setAccessToken(data.access_token)
    setTokenExpiresAt(expiresAt)
    return data.access_token as string
  }

  const fetchWithAuth = async (url: string, init: RequestInit = {}, retryOnAuthError = true) => {
    const token = await ensureToken()
    const headers = {
      ...(init.headers || {}),
      'Authorization': `Bearer ${token}`
    } as Record<string, string>
    const resp = await fetch(url, { ...init, headers, cache: 'no-store' })
    if ((resp.status === 401 || resp.status === 403) && retryOnAuthError) {
      setAccessToken(null)
      setTokenExpiresAt(0)
      const fresh = await ensureToken()
      const retryHeaders = { ...(init.headers || {}), 'Authorization': `Bearer ${fresh}` } as Record<string, string>
      return fetch(url, { ...init, headers: retryHeaders, cache: 'no-store' })
    }
    return resp
  }

  const extractAvatars = async () => {
    setIsAnalyzing(true)
    setError(null)
    setLoadingProgress(0)
    setLoadingStage(0)

    // Start progress animation - slower to accommodate 90+ seconds
    // Updates every 500ms, increments by 0.5% to reach 90% in ~90 seconds
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          return 90 // Keep at 90% until completion
        }
        return prev + 0.5
      })
    }, 500)

    // Update stages based on progress - spread over 90+ seconds
    setTimeout(() => setLoadingStage(1), 15000)   // Stage 1 at 15s
    setTimeout(() => setLoadingStage(2), 30000)   // Stage 2 at 30s
    setTimeout(() => setLoadingStage(3), 45000)   // Stage 3 at 45s
    setTimeout(() => setLoadingStage(4), 60000)   // Stage 4 at 60s

    try {
      // Step 1: Submit avatar extraction job via internal API
      setLoadingStage(1)
      const { internalApiClient } = await import('@/lib/clients/internal-client')
      const data = await internalApiClient.extractAvatars(salesPageUrl) as { jobId?: string; job_id?: string }

      const jobId = data.jobId || data.job_id
      if (!jobId) {
        throw new Error('No job ID received from avatar extraction service')
      }

      setLoadingStage(2)

      // Step 2: Poll for status and results
      await pollAvatarExtractionStatus(jobId, progressInterval)

    } catch (err) {
      clearInterval(progressInterval)
      console.error('Avatar extraction error:', err)
      setError('Failed to extract avatars from the sales page. This could be due to:\n\n• The URL is not accessible or requires authentication\n• The page doesn\'t contain enough customer information\n• The service is temporarily unavailable\n\nPlease try again or use the "I know exactly who my customer is" option instead.')
      setIsAnalyzing(false)
      setLoadingProgress(0)
      setLoadingStage(0)
    }
  }

  const pollAvatarExtractionStatus = async (jobId: string, progressInterval: NodeJS.Timeout) => {
    const maxAttempts = 120 // ~20 minutes max (120 * 10s) to accommodate longer processing times
    const pollInterval = 10000 // Poll every 10 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check status via internal API
        const { internalApiClient } = await import('@/lib/clients/internal-client')
        const statusData = await internalApiClient.getAvatarStatus(jobId) as { status: string }

        if (statusData.status === 'SUCCEEDED') {
          setLoadingStage(4)
          setLoadingProgress(95)

          // Only fetch results after SUCCEEDED
          const resultData = await internalApiClient.getAvatarResult(jobId) as { success?: boolean; avatars?: any[]; product_image?: string }

          if (resultData.success && resultData.avatars && resultData.avatars.length > 0) {
            clearInterval(progressInterval)
            setLoadingProgress(100)
            setTimeout(() => {
              // Mark the first avatar as broad persona when target_approach is "explore"
              const processedAvatars = (resultData.avatars || []).map((avatar: ExtractedAvatar, index: number) => ({
                ...avatar,
                // Mark first avatar as broad persona if target_approach is "explore"
                is_broad_avatar: index === 0 && formData?.target_approach === 'explore' ? true : avatar.is_broad_avatar,
                is_researched: false  // Initialize as not researched
              }))
              setAvatars(processedAvatars)
              setIsAnalyzing(false)
              setLoadingProgress(0)
              setLoadingStage(0)

              // Extract product_image (Base64 screenshot) from avatar extraction result
              const productImage = resultData.product_image || undefined

              // Save extracted avatars to parent immediately so they persist even if modal is closed
              // Pass empty array for selected avatars since user hasn't selected yet
              // Pass false for shouldClose to keep the modal open for user to select avatars
              // Pass product_image so it can be stored when job is created
              onAvatarsSelected([], processedAvatars, false, false, productImage)

              // Show verification dialog after extraction
              setShowVerification(true)
            }, 500)
            return // Success!
          } else {
            throw new Error('No avatars found in results')
          }
        } else if ((statusData as { status: string }).status === 'FAILED') {
          throw new Error('Avatar extraction job failed')
        } else {
          // Still processing - update stage based on attempt
          if (attempt > 3) setLoadingStage(3)
        }

        // If still processing, wait and try again
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }

      } catch (err) {
        if (attempt === maxAttempts) {
          clearInterval(progressInterval)
          throw err // Re-throw on final attempt
        }
        // Continue polling on intermediate errors
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    clearInterval(progressInterval)
    throw new Error('Avatar extraction timed out after 20 minutes. The service may be experiencing delays. Please try again or use the "I know exactly who my customer is" option instead.')
  }

  const handleAvatarToggle = (index: number) => {
    if (selectedAvatars.has(index)) {
      setSelectedAvatars(new Set())
    } else {
      setSelectedAvatars(new Set([index]))
    }
  }

  const handleSubmit = async () => {
    if (selectedAvatars.size === 0) {
      setError('Please select a persona to continue')
      return
    }

    setIsSubmitting(true)

    try {
      const selectedAvatarData = Array.from(selectedAvatars).map(index => avatars[index])
      // Mark selected avatars as researched
      const avatarsWithResearch = avatars.map((avatar, index) => ({
        ...avatar,
        is_researched: selectedAvatars.has(index) ? true : (avatar.is_researched || false)
      }))
      // Trigger automatic form submission when proceeding
      onAvatarsSelected(selectedAvatarData, avatarsWithResearch, true, true)
    } catch (err) {
      console.error('Submit error:', err)
      setError('Failed to create job. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getGenderIcon = (gender: string) => {
    switch (gender.toLowerCase()) {
      case 'male': return '👨'
      case 'female': return '👩'
      case 'both': return '👥'
      default: return '👤'
    }
  }

  const formatGender = (gender: string) => {
    const lowerGender = gender.toLowerCase()
    if (lowerGender === 'both') {
      return 'Male & Female'
    }
    return gender.toUpperCase()
  }

  const getAgeBadgeColor = (ageRange: string) => {
    if (ageRange.includes('25-34') || ageRange.includes('30-50')) return 'bg-blue-100 text-blue-800'
    if (ageRange.includes('35-44') || ageRange.includes('40-60')) return 'bg-green-100 text-green-800'
    if (ageRange.includes('45-54') || ageRange.includes('55-75')) return 'bg-cyan-100 text-cyan-800'
    if (ageRange.includes('60-75') || ageRange.includes('65+')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // When closing, preserve extracted avatars if they exist but weren't confirmed
      if (avatars.length > 0) {
        // Save extracted avatars to parent so they don't get lost
        // Preserve any previously selected avatars, or use empty array if none selected
        const currentSelected = selectedAvatars.size > 0
          ? Array.from(selectedAvatars).map(index => avatars[index])
          : (formData?.avatars?.filter((a: any) => a.is_researched) || [])

        // Mark selected avatars as researched
        const avatarsWithResearch = avatars.map((avatar, index) => ({
          ...avatar,
          is_researched: selectedAvatars.has(index) ? true : (avatar.is_researched || false)
        }))

        // Pass false for shouldClose since dialog is already closing via onClose()
        onAvatarsSelected(currentSelected, avatarsWithResearch, false)
      }
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="!max-w-[80vw] !w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AI Avatar Discovery
          </DialogTitle>
          <DialogDescription>
            Analyzing your sales page to discover customer personas...
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <Brain className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
            </div>

            {/* Title - Changes based on stage */}
            <h3 className="text-2xl font-bold text-foreground text-center animate-fade-in">
              {loadingStage === 0 && "Analyzing Your Sales Page"}
              {loadingStage === 1 && "Submitting Extraction Job"}
              {loadingStage === 2 && "Processing Customer Data"}
              {loadingStage === 3 && "Identifying Customer Avatars"}
              {loadingStage === 4 && "Finalizing Results"}
            </h3>

            {/* Progress Bar */}
            <div className="w-full max-w-md space-y-2">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {Math.round(loadingProgress)}% Complete
              </p>
            </div>

            {/* Stage-specific messages */}
            <div className="space-y-3 w-full animate-fade-in">
              {loadingStage === 0 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Crawling your sales page and analyzing content structure...
                  </p>
                </div>
              )}

              {loadingStage === 1 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Submitting avatar extraction job to processing queue...
                  </p>
                </div>
              )}

              {loadingStage === 2 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing customer data and extracting key insights...
                  </p>
                </div>
              )}

              {loadingStage === 3 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Identifying potential customer personas and their characteristics...
                  </p>
                </div>
              )}

              {loadingStage === 4 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Compiling customer avatars for your review...
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              This process typically takes 1-2 minutes. Please be patient while we analyze your sales page and generate customer personas.
            </p>

            <Button
              variant="outline"
              onClick={onClose}
              className="mt-4"
            >
              Cancel
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Verification Dialog */}
        {showVerification && avatars.length > 0 && (
          <div className="space-y-6 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold mb-2">
                <CheckCircle className="w-6 h-6 text-primary" />
                Verify Your Research Parameters
              </h2>
              <p className="text-sm text-muted-foreground">
                Please review the information below to ensure our AI research will be conducted for the correct product and audience.
              </p>
            </div>

            <div className="space-y-6">
              {/* Product Page URL */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Product Page URL
                </h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-all">
                  {salesPageUrl}
                </p>
              </div>

              {/* Product Analysis */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Product Analysis
                </h3>
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-type" className="text-sm font-medium flex items-center gap-2">
                      Company Type
                      <Edit3 className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="edit-company-type"
                      value={verificationFormData.companyType}
                      onChange={(e) => setVerificationFormData(prev => ({ ...prev, companyType: e.target.value }))}
                      className="bg-background"
                      placeholder="e.g., SaaS, eCommerce, D2C"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-product-description" className="text-sm font-medium flex items-center gap-2">
                      Product Description
                      <Edit3 className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="edit-product-description"
                      value={verificationFormData.productDescription}
                      onChange={(e) => setVerificationFormData(prev => ({ ...prev, productDescription: e.target.value }))}
                      className="bg-background"
                      placeholder="e.g., project management software, foot pain relief device"
                    />
                  </div>
                </div>
              </div>

              {/* Product Summary */}
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Your Product Summary
                </h3>
                <p className="text-base">
                  We are a <span className="font-semibold text-primary">{verificationFormData.companyType || "company"}</span> selling <span className="font-semibold text-primary">{verificationFormData.productDescription || "products"}</span> to{" "}
                  <span className="font-semibold text-primary">
                    {selectedAvatars.size > 0
                      ? avatars[Array.from(selectedAvatars)[0]]?.persona_name || "customers"
                      : "customers"}
                  </span>
                </p>

                {/* AI-Generated Target Avatars */}
                <div className="space-y-4 mt-4 p-5 bg-primary/5 border-2 border-primary/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <h4 className="text-base font-semibold text-foreground">
                      🎯 AI-Generated Target Avatars
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Our AI analyzed your product and identified these high-converting customer profiles. Select one for more targeted research:
                  </p>

                  {/* Avatar Cards */}
                  <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
                    <div className="space-y-3">
                      {avatars.map((avatar, index) => {
                        const isSelected = selectedAvatars.has(index)
                        const itemValue = `avatar-${index}`

                        return (
                          <Card
                            key={index}
                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                              ? "border-2 border-primary bg-primary/10"
                              : "border border-border hover:border-primary/50"
                              }`}
                            onClick={() => {
                              handleAvatarToggle(index)
                              setOpenItem(prev => (prev === itemValue ? undefined : itemValue))
                            }}
                          >
                            <AccordionItem value={itemValue} className="border-none">
                              <div className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-2xl">{getGenderIcon(avatar.gender)}</span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border">
                                          #{index + 1}
                                        </Badge>
                                        <div className="font-semibold text-base">{avatar.persona_name}</div>
                                        {avatar.is_broad_avatar && (
                                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                            Broad Persona
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap mt-1">
                                        <span className="text-xs text-muted-foreground">{avatar.age_range}</span>
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <span className="text-xs text-muted-foreground">{formatGender(avatar.gender)}</span>
                                        {avatar.characteristics && avatar.characteristics.length > 0 && (
                                          <>
                                            <span className="text-xs text-muted-foreground">•</span>
                                            <div className="flex flex-wrap gap-1">
                                              {avatar.characteristics.slice(0, 3).map((char, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                                  {char}
                                                </Badge>
                                              ))}
                                              {avatar.characteristics.length > 3 && (
                                                <span className="text-xs text-muted-foreground">+{avatar.characteristics.length - 3}</span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <CheckCircle className="w-5 h-5 text-primary" />
                                    )}
                                    <AccordionTrigger />
                                  </div>
                                </div>
                              </div>
                              <AccordionContent className="px-4 pb-4">
                                <div className="space-y-3 text-sm">
                                  <div>
                                    <span className="font-medium">Age Range:</span>
                                    <p className="text-muted-foreground">{avatar.age_range}</p>
                                  </div>
                                  <div>
                                    <span className="font-medium">Gender:</span>
                                    <p className="text-muted-foreground">{formatGender(avatar.gender)}</p>
                                  </div>
                                  <div>
                                    <span className="font-medium">Description:</span>
                                    <p className="text-muted-foreground">{avatar.description}</p>
                                  </div>
                                  {avatar.characteristics && avatar.characteristics.length > 0 && (
                                    <div>
                                      <span className="font-medium">Characteristics:</span>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {avatar.characteristics.map((char, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {char}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {avatar.pain_point && (
                                    <div>
                                      <span className="font-medium">Pain Point:</span>
                                      <p className="text-muted-foreground">{avatar.pain_point}</p>
                                    </div>
                                  )}
                                  {avatar.emotion && (
                                    <div>
                                      <span className="font-medium">Emotion:</span>
                                      <p className="text-muted-foreground">{avatar.emotion}</p>
                                    </div>
                                  )}
                                  {avatar.desire && (
                                    <div>
                                      <span className="font-medium">Desire:</span>
                                      <p className="text-muted-foreground">{avatar.desire}</p>
                                    </div>
                                  )}
                                  {avatar.key_buying_motivation && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Key Buying Motivation:</span>
                                      <p className="text-muted-foreground">{avatar.key_buying_motivation}</p>
                                    </div>
                                  )}
                                  {avatar.objections && avatar.objections.length > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Objections:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {avatar.objections.map((obj, idx) => (
                                          <li key={idx}>{obj}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {avatar.failed_alternatives && avatar.failed_alternatives.length > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Failed Alternatives:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {avatar.failed_alternatives.map((alt, idx) => (
                                          <li key={idx}>{alt}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Card>
                        )
                      })}
                    </div>
                  </Accordion>

                  <p className="text-xs text-muted-foreground italic mt-3">
                    💡 Selecting a specific avatar helps our AI create hyper-targeted copy that converts better
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => setShowVerification(false)}
              >
                Edit Information
              </Button>
              <Button
                onClick={async () => {
                  if (selectedAvatars.size === 0) {
                    setError('Please select a persona to continue')
                    return
                  }

                  setIsSubmitting(true)
                  try {
                    const selectedAvatarData = Array.from(selectedAvatars).map(index => avatars[index])
                    // Mark selected avatars as researched
                    const avatarsWithResearch = avatars.map((avatar, index) => ({
                      ...avatar,
                      is_researched: selectedAvatars.has(index) ? true : (avatar.is_researched || false)
                    }))
                    // Update formData with verification data and trigger automatic form submission
                    onAvatarsSelected(selectedAvatarData, avatarsWithResearch, true, true)
                  } catch (err) {
                    console.error('Submit error:', err)
                    setError('Failed to create job. Please try again.')
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
                disabled={selectedAvatars.size === 0 || isSubmitting}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm & Continue
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {!isAnalyzing && !showVerification && avatars.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Found {avatars.length} Customer Personas</h3>
              <p className="text-muted-foreground">
                Select the personas you want to target for your campaign
              </p>
            </div>

            <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full space-y-3">
              {avatars.map((avatar, index) => {
                const isSelected = selectedAvatars.has(index)
                const itemValue = `avatar-${index}`

                return (
                  <AccordionItem key={index} value={itemValue} className="border-none">
                    <Card
                      className={`transition-all cursor-pointer hover:shadow-md ${isSelected
                        ? 'border-2 border-primary bg-primary/10'
                        : 'border border-border hover:border-primary/50'
                        }`}
                      onClick={() => {
                        handleAvatarToggle(index)
                        setOpenItem(prev => (prev === itemValue ? undefined : itemValue))
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">{getGenderIcon(avatar.gender)}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border">
                                  #{index + 1}
                                </Badge>
                                <div className="font-semibold text-base">{avatar.persona_name}</div>
                                {avatar.is_broad_avatar && (
                                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Broad Persona
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <span className="text-xs text-muted-foreground">{avatar.age_range}</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{formatGender(avatar.gender)}</span>
                                {avatar.characteristics && avatar.characteristics.length > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <div className="flex flex-wrap gap-1">
                                      {avatar.characteristics.slice(0, 3).map((char, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                          {char}
                                        </Badge>
                                      ))}
                                      {avatar.characteristics.length > 3 && (
                                        <span className="text-xs text-muted-foreground">+{avatar.characteristics.length - 3}</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-primary" />
                            )}
                            <AccordionTrigger />
                          </div>
                        </div>
                      </div>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium">Age Range:</span>
                            <p className="text-muted-foreground">{avatar.age_range}</p>
                          </div>
                          <div>
                            <span className="font-medium">Description:</span>
                            <p className="text-muted-foreground">{avatar.description}</p>
                          </div>
                          {avatar.characteristics && avatar.characteristics.length > 0 && (
                            <div>
                              <span className="font-medium">Characteristics:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {avatar.characteristics.map((char, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {char}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Gender:</span>
                            <p className="text-muted-foreground">{formatGender(avatar.gender)}</p>
                          </div>
                          {avatar.key_buying_motivation && (
                            <div>
                              <span className="font-medium">Key Buying Motivation:</span>
                              <p className="text-muted-foreground">{avatar.key_buying_motivation}</p>
                            </div>
                          )}
                          {avatar.pain_point && (
                            <div>
                              <span className="font-medium">Pain Point:</span>
                              <p className="text-muted-foreground">{avatar.pain_point}</p>
                            </div>
                          )}
                          {avatar.emotion && (
                            <div>
                              <span className="font-medium">Emotion:</span>
                              <p className="text-muted-foreground">{avatar.emotion}</p>
                            </div>
                          )}
                          {avatar.desire && (
                            <div>
                              <span className="font-medium">Desire:</span>
                              <p className="text-muted-foreground">{avatar.desire}</p>
                            </div>
                          )}
                          {avatar.objections && avatar.objections.length > 0 && (
                            <div className="pt-2 border-t border-border">
                              <span className="font-medium">Objections:</span>
                              <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                {avatar.objections.map((obj, idx) => (
                                  <li key={idx}>{obj}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {avatar.failed_alternatives && avatar.failed_alternatives.length > 0 && (
                            <div className="pt-2 border-t border-border">
                              <span className="font-medium">Failed Alternatives:</span>
                              <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                {avatar.failed_alternatives.map((alt, idx) => (
                                  <li key={idx}>{alt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {avatar.hook_line && (
                            <div className="pt-2 border-t border-border">
                              <span className="font-medium">Hook Line:</span>
                              <p className="text-primary italic">{avatar.hook_line}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )
              })}
            </Accordion>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedAvatars.size > 0 ? '1 persona selected' : 'No persona selected'}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting || isLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={selectedAvatars.size === 0 || isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4 mr-2" />
                      Proceed to Template selection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const AvatarExtractionDialog = memo(AvatarExtractionDialogComponent)
