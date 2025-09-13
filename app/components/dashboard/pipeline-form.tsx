"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, X, AlertCircle } from "lucide-react"

interface PipelineFormData {
  title: string
  description: string
  contentType: string
  tone: string
  targetAudience: string
  keywords: string[]
  additionalInstructions: string
}

interface PipelineFormProps {
  onSubmit: (data: PipelineFormData) => Promise<void>
  isLoading?: boolean
}

export function PipelineForm({ onSubmit, isLoading = false }: PipelineFormProps) {
  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    description: "",
    contentType: "",
    tone: "",
    targetAudience: "",
    keywords: [],
    additionalInstructions: "",
  })
  const [keywordInput, setKeywordInput] = useState("")
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Project title is required"
    }

    if (!formData.description.trim()) {
      newErrors.description = "Content description is required"
    } else if (formData.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters"
    }

    if (!formData.contentType) {
      newErrors.contentType = "Content type is required"
    }

    if (!formData.tone) {
      newErrors.tone = "Tone selection is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      await onSubmit(formData)
      // Reset form on success
      setFormData({
        title: "",
        description: "",
        contentType: "",
        tone: "",
        targetAudience: "",
        keywords: [],
        additionalInstructions: "",
      })
      setErrors({})
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  const addKeyword = () => {
    const keyword = keywordInput.trim()
    if (keyword && !formData.keywords.includes(keyword)) {
      if (formData.keywords.length >= 10) {
        setErrors((prev) => ({ ...prev, keywords: "Maximum 10 keywords allowed" }))
        return
      }
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, keyword],
      }))
      setKeywordInput("")
      setErrors((prev) => ({ ...prev, keywords: undefined }))
    }
  }

  const removeKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }))
  }

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addKeyword()
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create New AI Content</CardTitle>
        <CardDescription>Configure your AI copywriting pipeline to generate high-quality content</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Project Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Blog Post: AI in Marketing"
                value={formData.title}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                }}
                disabled={isLoading}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentType">
                Content Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.contentType}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, contentType: value }))
                  if (errors.contentType) setErrors((prev) => ({ ...prev, contentType: undefined }))
                }}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.contentType ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog-post">Blog Post</SelectItem>
                  <SelectItem value="social-media">Social Media Post</SelectItem>
                  <SelectItem value="email">Email Campaign</SelectItem>
                  <SelectItem value="product-description">Product Description</SelectItem>
                  <SelectItem value="ad-copy">Advertisement Copy</SelectItem>
                  <SelectItem value="landing-page">Landing Page Copy</SelectItem>
                </SelectContent>
              </Select>
              {errors.contentType && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.contentType}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Content Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe what you want to create. Be specific about the topic, key points, and desired outcome..."
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, description: e.target.value }))
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }))
              }}
              rows={4}
              disabled={isLoading}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tone">
                Tone & Style <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tone}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, tone: value }))
                  if (errors.tone) setErrors((prev) => ({ ...prev, tone: undefined }))
                }}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.tone ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="creative">Creative & Engaging</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
              {errors.tone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.tone}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience</Label>
              <Input
                id="targetAudience"
                placeholder="e.g., Marketing professionals, Small business owners"
                value={formData.targetAudience}
                onChange={(e) => setFormData((prev) => ({ ...prev, targetAudience: e.target.value }))}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <div className="flex gap-2">
              <Input
                id="keywords"
                placeholder="Add keywords and press Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={handleKeywordKeyPress}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addKeyword}
                disabled={isLoading || !keywordInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.keywords && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.keywords}
              </p>
            )}
            {formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      disabled={isLoading}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalInstructions">Additional Instructions</Label>
            <Textarea
              id="additionalInstructions"
              placeholder="Any specific requirements, constraints, or additional context..."
              value={formData.additionalInstructions}
              onChange={(e) => setFormData((prev) => ({ ...prev, additionalInstructions: e.target.value }))}
              rows={3}
              disabled={isLoading}
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please fix the errors above before submitting.</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Content...
              </>
            ) : (
              "Start AI Pipeline"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
