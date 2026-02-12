"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, X, CheckCircle, AlertCircle, Info, RefreshCw } from "lucide-react"
import { PromptWithVersions } from "@/components/admin/admin-types"
import { PromptVersionHistory } from "@/components/admin/prompt-version-history"

interface PromptEditorProps {
  prompt: PromptWithVersions
  onSave: (content: string, notes: string) => Promise<void>
  onCancel: () => void
}

function extractPlaceholders(content: string): string[] {
  const regex = /\{([^}]+)\}/g
  const placeholders: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1])
    }
  }
  return placeholders
}

function highlightPlaceholdersWithValidation(
  content: string,
  requiredParams: string[]
): React.ReactNode[] {
  const regex = /\{([^}]+)\}/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    const paramName = match[1]
    const isRequired = requiredParams.includes(paramName)
    const colorClass = isRequired
      ? "bg-green-200/40 dark:bg-green-500/20"
      : "bg-blue-200/40 dark:bg-blue-500/20"

    parts.push(
      <span key={match.index} className={`${colorClass} rounded px-0.5`}>
        {match[0]}
      </span>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

export function PromptEditor({ prompt, onSave, onCancel }: PromptEditorProps) {
  const [content, setContent] = useState(prompt.latest_version?.content || "")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("editor")
  const { resolvedTheme } = useTheme()

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)
  const decorationsRef = useRef<{ clear(): void } | null>(null)

  const requiredParams = useMemo(() => prompt.required_params || [], [prompt.required_params])

  const validation = useMemo(() => {
    const found = extractPlaceholders(content)
    const foundRequired = found.filter((p) => requiredParams.includes(p))
    const missingRequired = requiredParams.filter((p) => !found.includes(p))
    const extra = found.filter((p) => !requiredParams.includes(p))
    const valid = missingRequired.length === 0 && extra.length === 0
    return { found, foundRequired, missingRequired, extra, valid }
  }, [content, requiredParams])

  const updateDecorations = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const text = model.getValue()
    const regex = /\{([^}]+)\}/g
    const decorations: {
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
      options: {
        inlineClassName: string
        hoverMessage: { value: string }
      }
    }[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index)
      const endPos = model.getPositionAt(match.index + match[0].length)
      const paramName = match[1]
      const isRequired = requiredParams.includes(paramName)

      decorations.push({
        range: new monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ),
        options: {
          inlineClassName: isRequired
            ? "prompt-placeholder-required"
            : "prompt-placeholder-extra",
          hoverMessage: {
            value: isRequired
              ? `**Required parameter:** \`${paramName}\``
              : `**Extra parameter:** \`${paramName}\``,
          },
        },
      })
    }

    if (decorationsRef.current) {
      decorationsRef.current.clear()
    }
    decorationsRef.current = editor.createDecorationsCollection(decorations)

    // Set markers for missing required placeholders
    const found = extractPlaceholders(text)
    const missing = requiredParams.filter((p) => !found.includes(p))
    const markers = missing.map((p) => ({
      severity: monaco.MarkerSeverity.Error,
      message: `Missing required placeholder: {${p}}`,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    }))
    monaco.editor.setModelMarkers(model, "prompt-validation", markers)
  }, [requiredParams])

  useEffect(() => {
    updateDecorations()
  }, [content, updateDecorations])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    updateDecorations()
  }

  const handleSave = async () => {
    if (!validation.valid) return

    setSaving(true)
    try {
      await onSave(content, notes)
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = (restoredContent: string) => {
    setContent(restoredContent)
    setActiveTab("editor")
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  return (
    <div className="space-y-6 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Edit Prompt: {prompt.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {prompt.category} &middot; {prompt.function_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-8">
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !validation.valid} className="h-8">
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save New Version
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1">Name</p>
            <p className="font-medium truncate">{prompt.name}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1">Category</p>
            <Badge variant="secondary" className="text-xs font-normal">
              {prompt.category}
            </Badge>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1">Function</p>
            <code className="font-mono text-xs bg-background border px-1.5 py-0.5 rounded block truncate">
              {prompt.function_name}
            </code>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1">Required Parameters</p>
            <div className="flex flex-wrap gap-1">
              {requiredParams.length > 0 ? (
                requiredParams.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs font-normal font-mono">
                    {`{${p}}`}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs mt-3 pt-3 border-t">
          <div>
            <p className="text-muted-foreground mb-1">Created</p>
            <p className="font-medium">{formatDate(prompt.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Updated</p>
            <p className="font-medium">{formatDate(prompt.updated_at)}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 h-9">
          <TabsTrigger value="editor" className="text-xs">Editor</TabsTrigger>
          <TabsTrigger value="versions" className="text-xs">Version History ({prompt.versions.length})</TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          {/* Monaco editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Prompt Content</Label>
              <span className="text-xs text-muted-foreground">
                {content.length.toLocaleString()} characters
              </span>
            </div>
            <div className="rounded-md border overflow-hidden">
              <style>{`
                .prompt-placeholder-required {
                  background-color: rgba(34, 197, 94, 0.25);
                  border-radius: 2px;
                  padding: 0 1px;
                }
                .prompt-placeholder-extra {
                  background-color: rgba(59, 130, 246, 0.25);
                  border-radius: 2px;
                  padding: 0 1px;
                }
              `}</style>
              <Editor
                height="600px"
                defaultLanguage="plaintext"
                theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                value={content}
                onChange={(value) => setContent(value ?? "")}
                onMount={handleEditorMount}
                options={{
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  minimap: { enabled: false },
                  wordWrap: "on",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  padding: { top: 8, bottom: 8 },
                  renderWhitespace: "none",
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          {/* Validation panel */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Placeholder Validation</h4>
              {validation.valid ? (
                <Badge className="text-xs font-normal bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs font-normal">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Invalid placeholders
                </Badge>
              )}
            </div>

            {/* Help text for variable format */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Variable Format</p>
                  <p className="text-blue-700 dark:text-blue-400">
                    Variables must be wrapped in curly braces: <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded font-mono">{"{variable_name}"}</code>
                  </p>
                  <p className="mt-1 text-blue-600 dark:text-blue-500">
                    Example: <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded font-mono">Hello {"{user_name}"}, your order {"{order_id}"} is ready.</code>
                  </p>
                </div>
              </div>
            </div>

            {!validation.valid && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 dark:text-red-300">
                    <p className="font-medium">Cannot save: Placeholder validation failed</p>
                    {validation.missingRequired.length > 0 && (
                      <p className="mt-1 text-red-700 dark:text-red-400">
                        Missing: {validation.missingRequired.map(p => `{${p}}`).join(", ")}
                      </p>
                    )}
                    {validation.extra.length > 0 && (
                      <p className="mt-1 text-red-700 dark:text-red-400">
                        Unknown: {validation.extra.map(p => `{${p}}`).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {validation.foundRequired.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                  Found Required
                </p>
                <div className="flex flex-wrap gap-1">
                  {validation.foundRequired.map((p) => (
                    <Badge key={p} className="text-xs font-normal font-mono bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                      {`{${p}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {validation.missingRequired.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                  Missing Required
                </p>
                <div className="flex flex-wrap gap-1">
                  {validation.missingRequired.map((p) => (
                    <Badge key={p} variant="destructive" className="text-xs font-normal font-mono">
                      {`{${p}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {validation.extra.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Info className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  Extra Placeholders
                </p>
                <div className="flex flex-wrap gap-1">
                  {validation.extra.map((p) => (
                    <Badge key={p} className="text-xs font-normal font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                      {`{${p}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Version Notes (optional)</Label>
              <span className="text-xs text-muted-foreground">{notes.length}/500</span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setNotes(e.target.value)
                }
              }}
              placeholder="Describe what changed in this version..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions">
          <PromptVersionHistory prompt={prompt} onRestore={handleRestore} />
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Formatted Preview</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-normal">
                  {validation.found.length} placeholders
                </Badge>
              </div>
            </div>
            <div className="rounded-md bg-background p-4 max-h-[500px] overflow-auto border">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {highlightPlaceholdersWithValidation(content, requiredParams)}
              </pre>
            </div>
            {validation.found.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">Placeholders found:</p>
                <div className="flex flex-wrap gap-1">
                  {validation.found.map((p) => {
                    const isRequired = requiredParams.includes(p)
                    return (
                      <Badge
                        key={p}
                        className={`text-xs font-normal font-mono border-0 ${
                          isRequired
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {`{${p}}`}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
