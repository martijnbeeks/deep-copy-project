"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, CheckCircle, AlertCircle, Users, User } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

  useEffect(() => {
    if (isOpen && salesPageUrl) {
      setError(null)

      // If avatars were previously extracted, reuse them instead of calling the API again
      if (Array.isArray(formData?.extracted_avatars) && formData.extracted_avatars.length > 0) {
        setIsAnalyzing(false)
        const extracted = formData.extracted_avatars as ExtractedAvatar[]
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

    try {
      // Step 1: Submit avatar extraction job to AWS (exact cURL equivalent)
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

      // Step 2: Poll for status and results
      await pollAvatarExtractionStatus(jobId)

    } catch (err) {
      console.error('Avatar extraction error:', err)
      setError('Failed to extract avatars from the sales page. This could be due to:\n\n• The URL is not accessible or requires authentication\n• The page doesn\'t contain enough customer information\n• The service is temporarily unavailable\n\nPlease try again or use the "I know exactly who my customer is" option instead.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const pollAvatarExtractionStatus = async (jobId: string) => {
    const maxAttempts = 50 // ~100 seconds max (20 * 5s)
    const pollInterval = 10000 // Poll every 5 seconds

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
          // Only fetch results after SUCCEEDED
          const resultResponse = await fetchWithAuth(`https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/avatars/${jobId}/result`, {
            method: 'GET'
          })

          if (!resultResponse.ok) {
            throw new Error(`Result fetch failed: ${resultResponse.status}`)
          }

          const resultData = await resultResponse.json()

          if (resultData.success && resultData.avatars && resultData.avatars.length > 0) {
            setAvatars(resultData.avatars)
            return // Success!
          } else {
            throw new Error('No avatars found in results')
          }
        } else if (statusData.status === 'FAILED') {
          throw new Error('Avatar extraction job failed')
        }

        // If still processing, wait and try again
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }

      } catch (err) {
        if (attempt === maxAttempts) {
          throw err // Re-throw on final attempt
        }
        // Continue polling on intermediate errors
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

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
    if (ageRange.includes('45-54') || ageRange.includes('55-75')) return 'bg-purple-100 text-purple-800'
    if (ageRange.includes('60-75') || ageRange.includes('65+')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analyzing Business</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Our AI is examining your sales page to identify potential customer segments and their motivations...
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

        {!isAnalyzing && avatars.length > 0 && (
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
