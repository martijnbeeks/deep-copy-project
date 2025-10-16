"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Play, Download } from "lucide-react"
import { validateTemplateContent, TEMPLATE_FIELDS } from "@/lib/types/pydantic-models"

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
    
    // Validate the template
    const validation = validateTemplateContent(htmlContent)
    
    // Count fields and placeholders
    const fieldCount = TEMPLATE_FIELDS.length
    const placeholderRegex = /\{\{content\.([^}]+)\}\}/g
    const foundPlaceholders = new Set<string>()
    let match
    
    while ((match = placeholderRegex.exec(htmlContent)) !== null) {
      foundPlaceholders.add(match[1])
    }
    
    const placeholderCount = foundPlaceholders.size
    
    setTestResults({
      ...validation,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Template Tester
        </CardTitle>
        <CardDescription>
          Validate your template against the Pydantic model and check for issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button onClick={runTest} disabled={isTesting}>
            {isTesting ? "Testing..." : "Run Test"}
          </Button>
          {testResults && (
            <Button variant="outline" onClick={downloadTestReport}>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          )}
        </div>

        {testResults && (
          <div className="space-y-4">
            {/* Overall Status */}
            <Alert className={testResults.isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {testResults.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  <div className="font-medium">
                    {testResults.isValid ? "Template is Valid!" : "Template has Issues"}
                  </div>
                  <div className="text-sm mt-1">
                    Found {testResults.placeholderCount} placeholders out of {testResults.fieldCount} available fields
                  </div>
                </AlertDescription>
              </div>
            </Alert>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{testResults.placeholderCount}</div>
                <div className="text-sm text-gray-600">Placeholders Found</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{testResults.fieldCount - testResults.missingFields.length}</div>
                <div className="text-sm text-gray-600">Fields Used</div>
              </div>
            </div>

            {/* Missing Fields */}
            {testResults.missingFields.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">Missing Required Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {testResults.missingFields.map((field) => (
                    <Badge key={field} variant="destructive" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Extra Fields */}
            {testResults.extraFields.length > 0 && (
              <div>
                <h4 className="font-medium text-yellow-600 mb-2">Unknown Fields (not in model):</h4>
                <div className="flex flex-wrap gap-2">
                  {testResults.extraFields.map((field) => (
                    <Badge key={field} variant="outline" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Field Coverage */}
            <div>
              <h4 className="font-medium mb-2">Field Coverage:</h4>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((testResults.fieldCount - testResults.missingFields.length) / testResults.fieldCount) * 100}%`
                  }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {Math.round(((testResults.fieldCount - testResults.missingFields.length) / testResults.fieldCount) * 100)}% of available fields are used
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
