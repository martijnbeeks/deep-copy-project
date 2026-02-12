"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Save, X, CheckCircle, AlertCircle, RefreshCw, ChevronDown } from "lucide-react"
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
    <div className="flex flex-col h-full">
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

      {/* Header - fixed at top */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">{prompt.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs font-normal">{prompt.category}</Badge>
            <code className="text-xs text-muted-foreground font-mono">{prompt.function_name}</code>
            {validation.valid ? (
              <Badge className="text-xs font-normal bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs font-normal">
                <AlertCircle className="h-3 w-3 mr-1" />
                {validation.missingRequired.length > 0 ? `${validation.missingRequired.length} missing` : ""}
                {validation.missingRequired.length > 0 && validation.extra.length > 0 ? ", " : ""}
                {validation.extra.length > 0 ? `${validation.extra.length} unknown` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Collapsible metadata */}
      <div className="px-6 flex-shrink-0">
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <ChevronDown className="h-3 w-3" />
            Details & Parameters
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border bg-muted/30 p-3 mt-1 mb-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="min-w-0">
                  <p className="text-muted-foreground mb-0.5">Required Parameters</p>
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
                <div className="min-w-0">
                  <p className="text-muted-foreground mb-0.5">Dates</p>
                  <p className="font-medium">Created {formatDate(prompt.created_at)} &middot; Updated {formatDate(prompt.updated_at)}</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Tabs - fills remaining space */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col px-6 pb-4">
        <TabsList className="bg-muted/50 h-9 flex-shrink-0">
          <TabsTrigger value="editor" className="text-xs">Editor</TabsTrigger>
          <TabsTrigger value="versions" className="text-xs">Version History ({prompt.versions.length})</TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
        </TabsList>

        {/* Editor Tab - flex layout, Monaco fills available space */}
        <TabsContent value="editor" className="flex-1 min-h-0 flex flex-col gap-3 mt-3 data-[state=inactive]:hidden">
          {/* Validation status bar */}
          {!validation.valid && (
            <div className="flex-shrink-0 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-red-800 dark:text-red-300 font-medium">Cannot save:</span>
                {validation.missingRequired.length > 0 && (
                  <span className="text-red-700 dark:text-red-400">
                    Missing: {validation.missingRequired.map(p => `{${p}}`).join(", ")}
                  </span>
                )}
                {validation.extra.length > 0 && (
                  <span className="text-red-700 dark:text-red-400">
                    Unknown: {validation.extra.map(p => `{${p}}`).join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Monaco editor - takes all available space */}
          <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
            <Editor
              height="100%"
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

          {/* Placeholder badges + Notes - fixed at bottom */}
          <div className="flex-shrink-0 space-y-2">
            {(validation.foundRequired.length > 0 || validation.extra.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Placeholders:</span>
                {validation.foundRequired.map((p) => (
                  <Badge key={p} className="text-xs font-normal font-mono bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 py-0">
                    {`{${p}}`}
                  </Badge>
                ))}
                {validation.extra.map((p) => (
                  <Badge key={p} className="text-xs font-normal font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 py-0">
                    {`{${p}}`}
                  </Badge>
                ))}
                {validation.missingRequired.map((p) => (
                  <Badge key={p} variant="destructive" className="text-xs font-normal font-mono py-0">
                    {`{${p}}`}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground ml-1">{content.length.toLocaleString()} chars</span>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={notes}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setNotes(e.target.value)
                  }
                }}
                placeholder="Version notes (optional)..."
                rows={1}
                className="text-sm resize-none flex-1"
              />
            </div>
          </div>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions" className="flex-1 min-h-0 overflow-y-auto mt-3 data-[state=inactive]:hidden">
          <PromptVersionHistory prompt={prompt} onRestore={handleRestore} />
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="flex-1 min-h-0 overflow-y-auto mt-3 data-[state=inactive]:hidden">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Formatted Preview</h4>
              <Badge variant="outline" className="text-xs font-normal">
                {validation.found.length} placeholders
              </Badge>
            </div>
            <div className="rounded-md bg-background p-4 border">
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
