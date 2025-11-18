"use client"

import { useState, useEffect } from "react"
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
}

interface AvatarExtractionDialogProps {
  isOpen: boolean
  onClose: () => void
  onAvatarsSelected: (selected: ExtractedAvatar[], all: ExtractedAvatar[]) => void
  salesPageUrl: string
  formData: any
  isLoading?: boolean
}

export function AvatarExtractionDialog({
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
      if (Array.isArray(formData?.extracted_avatars) && formData.extracted_avatars.length > 0) {
        setIsAnalyzing(false)
        // Mark the first avatar as broad persona when target_approach is "explore"
        const extracted = (formData.extracted_avatars as ExtractedAvatar[]).map((avatar, index) => ({
          ...avatar,
          // Mark first avatar as broad persona if target_approach is "explore"
          is_broad_avatar: index === 0 && formData?.target_approach === 'explore' ? true : avatar.is_broad_avatar
        }))
        setAvatars(extracted)

        // If there was a previously selected avatar, preselect the matching one by persona_name (or none if not found)
        const previouslySelected = Array.isArray(formData?.customer_avatars) && formData.customer_avatars.length > 0
          ? formData.customer_avatars[0]
          : undefined

        if (previouslySelected) {
          const matchIndex = extracted.findIndex(a => a.persona_name === previouslySelected.persona_name)
          setSelectedAvatars(new Set(matchIndex >= 0 ? [matchIndex] : []))
        } else {
          setSelectedAvatars(new Set())
        }
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
    const res = await fetch('/api/avatars/token', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to get access token')
    const data = await res.json()
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

    // Start progress animation
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          return 90 // Keep at 90% until completion
        }
        return prev + 1
      })
    }, 200)

    // Update stages based on progress
    setTimeout(() => setLoadingStage(1), 2000)   // Stage 1 at 2s
    setTimeout(() => setLoadingStage(2), 4000)   // Stage 2 at 4s
    setTimeout(() => setLoadingStage(3), 6000)   // Stage 3 at 6s
    setTimeout(() => setLoadingStage(4), 8000)   // Stage 4 at 8s

    try {
      // Step 1: Submit avatar extraction job to AWS (exact cURL equivalent)
      setLoadingStage(1)
      const response = await fetchWithAuth('https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/avatars/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: salesPageUrl })
      })

      if (!response.ok) {
        throw new Error('Failed to submit avatar extraction job')
      }

      const data = await response.json()

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
    const maxAttempts = 50 // ~100 seconds max (20 * 5s)
    const pollInterval = 10000 // Poll every 10 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check status (exact cURL equivalent)
        const statusResponse = await fetchWithAuth(`https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/jobs/${jobId}`, {
          method: 'GET'
        })

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === 'SUCCEEDED') {
          setLoadingStage(4)
          setLoadingProgress(95)

          // Only fetch results after SUCCEEDED
          const resultResponse = await fetchWithAuth(`https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/avatars/${jobId}/result`, {
            method: 'GET'
          })

          if (!resultResponse.ok) {
            throw new Error(`Result fetch failed: ${resultResponse.status}`)
          }

          const resultData = await resultResponse.json()

          if (resultData.success && resultData.avatars && resultData.avatars.length > 0) {
            clearInterval(progressInterval)
            setLoadingProgress(100)
            setTimeout(() => {
              // Mark the first avatar as broad persona when target_approach is "explore"
              const processedAvatars = resultData.avatars.map((avatar: ExtractedAvatar, index: number) => ({
                ...avatar,
                // Mark first avatar as broad persona if target_approach is "explore"
                is_broad_avatar: index === 0 && formData?.target_approach === 'explore' ? true : avatar.is_broad_avatar
              }))
              setAvatars(processedAvatars)
              setIsAnalyzing(false)
              setLoadingProgress(0)
              setLoadingStage(0)
              // Show verification dialog after extraction
              setShowVerification(true)
            }, 500)
            return // Success!
          } else {
            throw new Error('No avatars found in results')
          }
        } else if (statusData.status === 'FAILED') {
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
    throw new Error('Avatar extraction timed out after 60 seconds. The service may be experiencing delays.')
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
      onAvatarsSelected(selectedAvatarData, avatars)
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

  const getAgeBadgeColor = (ageRange: string) => {
    if (ageRange.includes('25-34') || ageRange.includes('30-50')) return 'bg-blue-100 text-blue-800'
    if (ageRange.includes('35-44') || ageRange.includes('40-60')) return 'bg-green-100 text-green-800'
    if (ageRange.includes('45-54') || ageRange.includes('55-75')) return 'bg-cyan-100 text-cyan-800'
    if (ageRange.includes('60-75') || ageRange.includes('65+')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
              Analyzing your sales page and generating customer personas
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
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <div className="font-semibold text-base">{avatar.persona_name}</div>
                                        {avatar.is_broad_avatar && (
                                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                            Broad Persona
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{avatar.age_range}</div>
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
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-medium">Description:</span>
                                    <p className="text-muted-foreground">{avatar.description}</p>
                                  </div>
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
                    // Update formData with verification data before submitting
                    onAvatarsSelected(selectedAvatarData, avatars)
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
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-base">{avatar.persona_name}</div>
                                {avatar.is_broad_avatar && (
                                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Broad Persona
                                  </Badge>
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
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Age Range:</span>
                            <p className="text-muted-foreground">{avatar.age_range}</p>
                          </div>
                          <div>
                            <span className="font-medium">Description:</span>
                            <p className="text-muted-foreground">{avatar.description}</p>
                          </div>
                          <div>
                            <span className="font-medium">Gender:</span>
                            <p className="text-muted-foreground">{avatar.gender}</p>
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
