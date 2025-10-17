"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, Eye, Save, Upload } from "lucide-react"
// Removed complex field validation - keeping it simple

interface TemplateEditorProps {
  template: {
    id?: string
    name: string
    type: 'listicle' | 'advertorial'
    description: string
    htmlContent: string
  }
  onSave: (template: any) => void
  onCancel: () => void
  onPreview: (htmlContent: string) => void
}

export function TemplateEditor({ template, onSave, onCancel, onPreview }: TemplateEditorProps) {
  const [formData, setFormData] = useState(template)
  const [activeTab, setActiveTab] = useState("basic")

  // Simple template editor - no complex field extraction needed

  // Simple template editor - no complex field management needed

  const handleBasicChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setFormData(prev => ({ ...prev, htmlContent: content }))
      }
      reader.readAsText(file)
    }
  }

  const handleSave = () => {
    onSave(formData)
  }

  const handlePreview = () => {
    onPreview(formData.htmlContent)
  }

  const loadTemplateFromSwipe = async (templateName: string) => {
    try {
      if (templateName === 'blank') {
        setFormData(prev => ({ ...prev, htmlContent: '' }))
        return
      }

      // Load template from swipe_templates folder
      const response = await fetch(`/api/admin/load-swipe-template?template=${templateName}`)
      if (response.ok) {
        const data = await response.json()
        setFormData(prev => ({ 
          ...prev, 
          htmlContent: data.htmlContent,
          name: data.name || prev.name,
          type: data.type || prev.type
        }))
      } else {
        console.error('Failed to load template:', templateName)
      }
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }

  // Removed complex sections - keeping it simple

  return (
    <div className="space-y-6 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Editor</h2>
          <p className="text-muted-foreground">Create and edit injectable templates with field validation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreview} type="button">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} type="button">
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </div>
      </div>

      {/* Simple Status */}
      <Alert className="border-blue-200 bg-blue-50">
        <CheckCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          Upload your HTML template or paste content below. The system will automatically detect placeholders like <code className="bg-blue-100 px-1 rounded">{"{{content.hero.headline}}"}</code> for dynamic content injection.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="html">HTML Editor</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Configure the basic template settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={formData.name}
                  onChange={(e) => handleBasicChange('name', e.target.value)}
                  placeholder="My Injectable Template"
                />
              </div>
              
              <div>
                <Label htmlFor="templateId">Template ID (Optional)</Label>
                <Input
                  id="templateId"
                  value={formData.id || ''}
                  onChange={(e) => handleBasicChange('id', e.target.value)}
                  placeholder="custom-template-id (leave empty for auto-generated)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a custom ID or leave empty to auto-generate one
                </p>
              </div>
              
              <div>
                <Label htmlFor="templateType">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'listicle' | 'advertorial') => handleBasicChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="listicle">Listicle</SelectItem>
                    <SelectItem value="advertorial">Advertorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="templateDescription">Description</Label>
                <Input
                  id="templateDescription"
                  value={formData.description}
                  onChange={(e) => handleBasicChange('description', e.target.value)}
                  placeholder="Brief description of the template"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="templateFile">Upload HTML File</Label>
                <Input
                  id="templateFile"
                  type="file"
                  accept=".html"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-muted-foreground">
                  Upload an HTML file or paste content in the HTML Editor tab below
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Quick HTML Paste</Label>
                <Textarea
                  placeholder="Paste your HTML template content here for quick setup..."
                  rows={6}
                  onChange={(e) => handleBasicChange('htmlContent', e.target.value)}
                  value={formData.htmlContent}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Or use the HTML Editor tab for more detailed editing
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Quick Start Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplateFromSwipe('blissy')}
                    type="button"
                  >
                    Load Blissy Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplateFromSwipe('bugmd')}
                    type="button"
                  >
                    Load BugMD Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplateFromSwipe('example')}
                    type="button"
                  >
                    Load Example Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplateFromSwipe('blank')}
                    type="button"
                  >
                    Start Blank
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Load a template from swipe_templates folder as starting point
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* HTML Editor Tab */}
        <TabsContent value="html" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HTML Editor</CardTitle>
              <CardDescription>Edit the raw HTML template content</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.htmlContent}
                onChange={(e) => handleBasicChange('htmlContent', e.target.value)}
                placeholder="Paste your HTML template content here..."
                rows={20}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
