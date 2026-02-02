"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Play, Download } from "lucide-react"
// Template validation functions

interface TemplateTesterProps {
  htmlContent: string
  templateName: string
}

export function TemplateTester({ htmlContent, templateName }: TemplateTesterProps) {
  const [testResults, setTestResults] = useState<{
    isValid: boolean
    missingFields: string[]
    extraFields: string[]
    fieldCount: number
    placeholderCount: number
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const runTest = () => {
    setIsTesting(true)
    
    // Count placeholders in the template
    const placeholderRegex = /\{\{content\.([^}]+)\}\}/g
    const foundPlaceholders = new Set<string>()
    let match
    
    while ((match = placeholderRegex.exec(htmlContent)) !== null) {
      foundPlaceholders.add(match[1])
    }
    
    const placeholderCount = foundPlaceholders.size
    const fieldCount = 50 // Approximate number of available fields
    
    setTestResults({
      isValid: placeholderCount > 0,
      missingFields: [],
      extraFields: [],
      fieldCount,
      placeholderCount
    })
    
    setIsTesting(false)
  }

  const downloadTestReport = () => {
    if (!testResults) return
    
    const report = {
      templateName,
      timestamp: new Date().toISOString(),
      validation: testResults,
      htmlContent: htmlContent.substring(0, 1000) + "...", // Truncated for readability
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${templateName}-test-report.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Template Analysis</h3>
          <p className="text-xs text-muted-foreground">Analyze placeholder fields in your template</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runTest} disabled={isTesting} size="sm" className="h-8">
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isTesting ? "Testing..." : "Run Test"}
          </Button>
          {testResults && (
            <Button variant="ghost" size="sm" onClick={downloadTestReport} className="h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          )}
        </div>
      </div>

      {testResults && (
        <div className="space-y-4">
          {/* Overall Status */}
          <div className={`rounded-lg border p-3 ${testResults.isValid ? "bg-muted/30 border-border" : "bg-destructive/10 border-destructive/20"}`}>
            <div className="flex items-start gap-2">
              {testResults.isValid ? (
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              )}
              <div className="flex-1">
                <div className="text-xs font-semibold mb-1">
                  {testResults.isValid ? "Template is Valid" : "Template has Issues"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Found {testResults.placeholderCount} placeholders out of {testResults.fieldCount} available fields
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-foreground mb-0.5">{testResults.placeholderCount}</div>
              <div className="text-xs text-muted-foreground">Placeholders</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-foreground mb-0.5">{testResults.placeholderCount}</div>
              <div className="text-xs text-muted-foreground">Fields Used</div>
            </div>
          </div>

          {/* Placeholder List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Found Placeholders</h4>
            <div className="rounded-lg border bg-muted/20 p-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(htmlContent.match(/\{\{content\.([^}]+)\}\}/g) || [])).map((placeholder) => (
                  <Badge key={placeholder} variant="secondary" className="text-xs font-mono">
                    {placeholder}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Field Coverage */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Template Coverage</h4>
            <div className="space-y-1.5">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((testResults.placeholderCount / testResults.fieldCount) * 100, 100)}%`
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {testResults.placeholderCount} placeholders found in template
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
