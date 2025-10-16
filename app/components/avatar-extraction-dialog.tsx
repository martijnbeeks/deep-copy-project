"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertCircle, Users, User } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ExtractedAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
}

interface AvatarExtractionDialogProps {
  isOpen: boolean
  onClose: () => void
  onAvatarsSelected: (avatars: ExtractedAvatar[]) => void
  salesPageUrl: string
  formData: any
}

export function AvatarExtractionDialog({ 
  isOpen, 
  onClose, 
  onAvatarsSelected, 
  salesPageUrl,
  formData 
}: AvatarExtractionDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [avatars, setAvatars] = useState<ExtractedAvatar[]>([])
  const [selectedAvatars, setSelectedAvatars] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && salesPageUrl) {
      extractAvatars()
    }
  }, [isOpen, salesPageUrl])

  const extractAvatars = async () => {
    setIsAnalyzing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/avatars/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: salesPageUrl })
      })

      if (!response.ok) {
        throw new Error('Failed to extract avatars')
      }

      const data = await response.json()
      
      if (data.success && data.avatars && data.avatars.length > 0) {
        setAvatars(data.avatars)
      } else {
        throw new Error('No avatars found')
      }
    } catch (err) {
      console.error('Avatar extraction error:', err)
      setError('Failed to extract avatars from the sales page. Please try again or use the "I know exactly who my customer is" option instead.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAvatarToggle = (index: number) => {
    const newSelected = new Set(selectedAvatars)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedAvatars(newSelected)
  }

  const handleSubmit = async () => {
    if (selectedAvatars.size === 0) {
      setError('Please select at least one avatar to continue')
      return
    }

    setIsSubmitting(true)
    
    try {
      const selectedAvatarData = Array.from(selectedAvatars).map(index => avatars[index])
      onAvatarsSelected(selectedAvatarData)
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            <p className="text-muted-foreground text-center max-w-md">
              Our AI is examining your sales page to identify potential customer segments and their motivations...
            </p>
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

            <div className="grid gap-4">
              {avatars.map((avatar, index) => (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedAvatars.has(index) 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleAvatarToggle(index)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getGenderIcon(avatar.gender)}</div>
                        <div>
                          <CardTitle className="text-lg">{avatar.persona_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getAgeBadgeColor(avatar.age_range)}>
                              {avatar.age_range}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {avatar.gender}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {selectedAvatars.has(index) ? (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-3">
                      {avatar.description}
                    </CardDescription>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Buying Motivation:</p>
                      <p className="text-sm">{avatar.key_buying_motivation}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedAvatars.size} persona{selectedAvatars.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={selectedAvatars.size === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4 mr-2" />
                      Create Job with Selected Personas
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
