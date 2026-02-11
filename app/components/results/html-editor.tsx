"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getAuthorizationHeader } from "@/lib/utils/client-auth"
import { useToast } from "@/hooks/use-toast"
import { Save, X } from "lucide-react"
import { PrelanderImageGenerationDialog } from "@/components/results/prelander-image-generation-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface HtmlEditorProps {
    isOpen: boolean
    onClose: () => void
    templateId: string
    templateName: string
    initialHtml: string
    onSave?: () => void
}

export function HtmlEditor({
    isOpen,
    onClose,
    templateId,
    templateName,
    initialHtml,
    onSave
}: HtmlEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [editor, setEditor] = useState<any>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isImageGenPromptOpen, setIsImageGenPromptOpen] = useState(false)
    const [isImageGenDialogOpen, setIsImageGenDialogOpen] = useState(false)
    const [hasShownImageGenPrompt, setHasShownImageGenPrompt] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        if (!isOpen || !editorRef.current) return

        // Show image generation prompt when opening editor for the first time
        if (!hasShownImageGenPrompt) {
            setHasShownImageGenPrompt(true)
            setTimeout(() => {
                setIsImageGenPromptOpen(true)
            }, 500) // Small delay to let editor initialize
        }

        // Dynamically import GrapeJS only when needed (client-side only)
        const initEditor = async () => {
            const grapesjs = (await import('grapesjs')).default
            await import('grapesjs/dist/css/grapes.min.css')

            // Extract CSS from <style> tags and strip them from HTML
            let htmlContent = initialHtml
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
            let styleMatch
            const cssBlocks: string[] = []
            while ((styleMatch = styleRegex.exec(htmlContent)) !== null) {
                if (styleMatch[1]) {
                    cssBlocks.push(styleMatch[1].trim())
                }
            }
            // Remove style tags from HTML
            htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

            // Extract body content if HTML has body tag
            if (/<body[^>]*>/i.test(htmlContent)) {
                const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                if (bodyMatch && bodyMatch[1]) {
                    htmlContent = bodyMatch[1]
                }
            }

            const editorInstance = grapesjs.init({
                container: editorRef.current!,
                height: '100%',
                width: '100%',
                fromElement: false,
                storageManager: false,

                // Disable all panels
                panels: { defaults: [] },

                // Disable blocks panel
                blockManager: {
                    appendTo: '',
                },

                // Disable style manager
                styleManager: {
                    appendTo: '',
                },

                // Disable layer manager
                layerManager: {
                    appendTo: '',
                },

                // Disable trait manager
                traitManager: {
                    appendTo: '',
                },

                // Device manager for responsive preview (optional)
                deviceManager: {
                    devices: []
                },

                // Disable Asset Manager completely to prevent conflicts
                assetManager: false as any,

                // Canvas settings - inject extracted CSS
                canvas: {
                    styles: cssBlocks,
                    scripts: [],
                },

                // Component defaults - lock everything except text editing
                components: htmlContent,

                // Plugin configuration
                plugins: [],
                pluginsOpts: {},
            })

            // Apply global component restrictions
            editorInstance.on('component:add', (component: any) => {
                component.set({
                    draggable: false,
                    removable: false,
                    copyable: false,
                    stylable: false,
                    resizable: false,
                    editable: false,
                })

                // Enable text editing for text-based elements
                const tagName = component.get('tagName')
                if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'div'].includes(tagName?.toLowerCase())) {
                    component.set('editable', true)
                }
            })

            // Handle image click for replacement
            let imageInputRef: HTMLInputElement | null = null
            let isUploading = false // Flag to prevent concurrent uploads
            
            const handleComponentSelected = (component: any) => {
                const tagName = component.get('tagName')?.toLowerCase()

                if (tagName === 'img') {
                    // Prevent multiple simultaneous uploads
                    if (isUploading) {
                        console.warn('⚠️ Upload already in progress, ignoring click')
                        return
                    }
                    
                    // Clean up any existing input first (synchronous)
                    if (imageInputRef && document.body.contains(imageInputRef)) {
                        document.body.removeChild(imageInputRef)
                        imageInputRef = null
                    }
                    
                    // Create file input for image replacement
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.style.display = 'none'
                    imageInputRef = input
                    
                    const cleanup = () => {
                        if (imageInputRef && document.body.contains(imageInputRef)) {
                            document.body.removeChild(imageInputRef)
                            imageInputRef = null
                        }
                        isUploading = false
                    }
                    
                    input.onchange = async (e: any) => {
                        const file = e.target.files?.[0]
                        if (!file) {
                            cleanup()
                            return
                        }
                        
                        isUploading = true
                        
                        try {
                            // Upload image to Cloudflare CDN
                            const formData = new FormData()
                            formData.append('file', file)
                            
                            const response = await fetch('/api/upload-image', {
                                method: 'POST',
                                body: formData,
                            })
                            
                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({}));
                                throw new Error(errorData.error || `Upload failed with status ${response.status}`);
                            }
                            
                            const data = await response.json()
                            
                            // Update image src with CDN URL - the standard GrapesJS way
                            // This automatically updates the model, view, and triggers necessary change events
                            component.set('src', data.url)
                            
                            // Verify the attribute was set
                            console.log('✅ Component src updated to:', component.get('src'))
                            
                            toast({
                                title: "Image replaced",
                                description: "The image has been successfully uploaded and replaced.",
                            })
                        } catch (error: any) {
                            console.error('Image upload error:', error)
                            toast({
                                title: "Upload failed",
                                description: error?.message || "Failed to upload image. Please try again.",
                                variant: "destructive",
                            })
                        } finally {
                            cleanup()
                        }
                    }
                    
                    // Cleanup on cancel - synchronous, no setTimeout
                    input.oncancel = cleanup
                    
                    document.body.appendChild(input)
                    input.click()
                }
            }
            
            // Register the event handler
            editorInstance.on('component:selected', handleComponentSelected)
            
            // Store handler reference on editor instance for cleanup
            ;(editorInstance as any)._imageUploadHandler = handleComponentSelected

            // Hide default GrapeJS UI elements
            const style = document.createElement('style')
            style.innerHTML = `
        .gjs-cv-canvas {
          width: 100%;
          height: 100%;
        }
        .gjs-frame {
          border: none !important;
        }
        .gjs-toolbar {
          display: none !important;
        }
        .gjs-resizer-c {
          display: none !important;
        }
        .gjs-badge {
          display: none !important;
        }
        .gjs-highlighter {
          outline: 2px solid #3b82f6 !important;
          outline-offset: -2px !important;
        }
        .gjs-selected {
          outline: 2px solid #3b82f6 !important;
          outline-offset: -2px !important;
        }
      `
            document.head.appendChild(style)

            setEditor(editorInstance)
        }

        initEditor()

        return () => {
            if (editor) {
                // Remove event listener before destroying editor
                const handler = (editor as any)._imageUploadHandler
                if (handler) {
                    editor.off('component:selected', handler)
                }
                editor.destroy()
            }
        }
    }, [isOpen])

    const handleSave = async () => {
        if (!editor) return

        setIsSaving(true)
        try {
            // Get the updated HTML from GrapeJS
            const html = editor.getHtml()
            const css = editor.getCss()

            // Debug: Check if CDN URLs are in the HTML
            const cdnUrlPattern = /imagedelivery\.net|cloudflare|cdn/i
            const hasCdnUrls = cdnUrlPattern.test(html)
            if (hasCdnUrls) {
                console.log('✅ CDN URLs found in HTML:', html.match(/src=["']([^"']*imagedelivery\.net[^"']*)["']/gi))
            } else {
                console.warn('⚠️ No CDN URLs found in HTML. HTML preview:', html.substring(0, 500))
            }

            // Combine HTML and CSS
            const fullHtml = `<style>${css}</style>${html}`

            // Send to API
            const authHeaders = getAuthorizationHeader()
            const response = await fetch(`/api/templates/injected/${templateId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify({ html: fullHtml }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to save template')
            }

            toast({
                title: "Template saved",
                description: "Your changes have been saved successfully.",
            })

            // Call the onSave callback to refresh the template list
            if (onSave) {
                onSave()
            }

            onClose()
        } catch (error) {
            console.error('Failed to save template:', error)
            toast({
                title: "Save failed",
                description: error instanceof Error ? error.message : "Failed to save template.",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (confirm('Are you sure you want to discard your changes?')) {
            onClose()
        }
    }

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[98vw] max-h-[98vh] w-[98vw] h-[98vh] p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold">
                                Edit Template: {templateName}
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Click on text to edit • Click on images to upload and replace
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div
                    ref={editorRef}
                    className="flex-1 overflow-hidden"
                    style={{ height: 'calc(98vh - 100px)' }}
                />
            </DialogContent>
        </Dialog>

        <AlertDialog open={isImageGenPromptOpen} onOpenChange={setIsImageGenPromptOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Generate Images for Prelander?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Do you want to generate AI images for this prelander? This will replace all image placeholders with AI-generated images.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>No, thanks</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            setIsImageGenPromptOpen(false)
                            setIsImageGenDialogOpen(true)
                        }}
                    >
                        Yes, generate images
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <PrelanderImageGenerationDialog
            isOpen={isImageGenDialogOpen}
            onClose={() => setIsImageGenDialogOpen(false)}
            html={initialHtml}
            onImagesGenerated={(count, updatedHtml) => {
                // Update editor if it's initialized
                if (editor) {
                    // Update the HTML in the editor
                    editor.setComponents(updatedHtml)
                    toast({
                        title: "Images updated",
                        description: `Updated ${count} image${count !== 1 ? "s" : ""} in the editor.`,
                    })
                }
            }}
        />
    </>
    )
}
