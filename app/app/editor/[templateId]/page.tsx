"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Save, X, ArrowLeft, Loader2 } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PrelanderImageGenerationDialog } from "@/components/results/prelander-image-generation-dialog"
import { TemplateImageGenerationDialog } from "@/components/results/template-image-generation-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { replaceTemplateImagesInHTML } from "@/lib/utils/template-image-replacer"
import { ImageGenerationFloater } from "@/components/results/image-generation-floater"
import { getAuthorizationHeader } from "@/lib/utils/client-auth"

const NEW_TEMPLATE_IDS = ['AD0001', 'LD0001'] // New templates with image generation support

// Helper function to detect if template needs hydration
const needsHydration = (html: string): boolean => {
    if (!html) return false

    // New CONFIG-based templates
    const hasConfig =
        /const\s+CONFIG\s*=/i.test(html) ||
        /<script[^>]*>[\s\S]*?const\s+CONFIG[\s\S]*?<\/script>/i.test(html)

    // OLD templates that use Tailwind CDN need hydration too
    const usesTailwindCdn = /https:\/\/cdn\.tailwindcss\.com/.test(html)

    // Only hydrate when necessary; all other old templates stay on the fast non-hydrated path
    return hasConfig || usesTailwindCdn
}

// Helper function to check if HTML has full structure
const hasFullStructure = (html: string): boolean => {
    if (!html) return false
    return /<!DOCTYPE\s+html>/i.test(html) || /<html[^>]*>/i.test(html)
}

export default function EditorPage({ params }: { params: { templateId: string } }) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [editor, setEditor] = useState<any>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [template, setTemplate] = useState<any>(null)
    
    // NEW: State to hold the "Hydrated" (fully rendered) content
    const [hydratedData, setHydratedData] = useState<{ html: string, css: string[] } | null>(null)
    const [isHydrating, setIsHydrating] = useState(false)
    
    const [isImageGenPromptOpen, setIsImageGenPromptOpen] = useState(false)
    const [isImageGenDialogOpen, setIsImageGenDialogOpen] = useState(false)
    const [hasShownImageGenPrompt, setHasShownImageGenPrompt] = useState(false)
    const [showImageGenFloater, setShowImageGenFloater] = useState(false)
    const [hasShownImageGenFloater, setHasShownImageGenFloater] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    // Fetch template data
    const fetchTemplate = async () => {
        try {
            const authHeaders = getAuthorizationHeader()

            const response = await fetch(`/api/templates/injected/${params.templateId}`, {
                method: 'GET',
                headers: {
                    ...authHeaders,
                },
            })
            if (!response.ok) {
                throw new Error('Failed to fetch template')
            }
            const data = await response.json()
            setTemplate(data)
            setIsLoading(false)
            return data
        } catch (error) {
            console.error('Error fetching template:', error)
            toast({
                title: "Error",
                description: "Failed to load template",
                variant: "destructive",
            })
            setIsLoading(false)
            return null
        }
    }

    useEffect(() => {
        fetchTemplate()
    }, [params.templateId, toast])

    // Show floater when editor loads for new templates
    useEffect(() => {
        if (template && !hasShownImageGenFloater) {
            const rawHtml = template.html || template.html_content || ''
            if (needsHydration(rawHtml)) {
                // Check if it's a new template (AD/LD)
                const templateId = template.template_id || ''
                if (templateId.startsWith('AD') || templateId.startsWith('LD')) {
                    setTimeout(() => {
                        setShowImageGenFloater(true)
                        setHasShownImageGenFloater(true)
                    }, 1000)
                }
            }
        }
    }, [template, hasShownImageGenFloater])

    // 2. HYDRATION PHASE (Only for new templates with CONFIG script)
    // This executes the HTML/Scripts in a hidden iframe to "bake" the text/images 
    // before GrapesJS ever sees them.
    useEffect(() => {
        if (!template) return
        
        const rawHtml = template.html || template.html_content || ''
        if (!rawHtml) return

        // CRITICAL: Only hydrate if template has CONFIG script
        if (!needsHydration(rawHtml)) {
            // Old template: Skip hydration, extract body and styles directly
            setIsHydrating(false)
            
            let bodyContent = rawHtml
            const styles: string[] = []
            
            // If it has full structure, extract body
            if (hasFullStructure(rawHtml)) {
                const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
                bodyContent = bodyMatch ? bodyMatch[1].trim() : rawHtml
            }
            
            // Extract styles
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
            let styleMatch
            while ((styleMatch = styleRegex.exec(rawHtml)) !== null) {
                if (styleMatch[1]) {
                    styles.push(styleMatch[1].trim())
                }
            }
            
            setHydratedData({
                html: bodyContent,
                css: styles
            })
            return
        }

        setIsHydrating(true)

        // Create an invisible iframe to act as our "Renderer"
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)

        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc) {
            doc.open()
            doc.write(rawHtml)
            doc.close()

            // When the iframe loads, the scripts (CONFIG, etc.) have finished running.
            // We now grab the RESULT (the DOM).
            iframe.onload = () => {
                try {
                    // A. Extract all <style> tags (static CSS)
                    const styleTags = doc.querySelectorAll('style')
                    const cssBlocks: string[] = []
                    styleTags.forEach(tag => cssBlocks.push(tag.innerHTML))

                    // B. Extract CSS Variables (Theme Colors) - IMPROVED
                    // Check computed styles for :root variables
                    const computedStyle = doc.defaultView?.getComputedStyle(doc.documentElement)
                    const rootStyles = doc.documentElement.getAttribute('style')
                    if (rootStyles) {
                        cssBlocks.push(`:root { ${rootStyles} }`)
                    }
                    
                    // Also extract any computed CSS variables
                    if (computedStyle) {
                        const cssVars: string[] = []
                        for (let i = 0; i < computedStyle.length; i++) {
                            const prop = computedStyle[i]
                            if (prop.startsWith('--')) {
                                const value = computedStyle.getPropertyValue(prop)
                                cssVars.push(`${prop}: ${value}`)
                            }
                        }
                        if (cssVars.length > 0) {
                            cssBlocks.push(`:root { ${cssVars.join('; ')} }`)
                        }
                    }

                    // C. Extract external stylesheets (Google Fonts, etc.)
                    const linkTags = doc.querySelectorAll('link[rel="stylesheet"]')
                    linkTags.forEach(link => {
                        const href = link.getAttribute('href')
                        if (href && href.startsWith('http')) {
                            // Inject as @import in CSS
                            cssBlocks.push(`@import url('${href}');`)
                        }
                    })

                    // D. Extract the fully populated Body
                    // We clone the body so we don't affect the iframe
                    const bodyClone = doc.body.cloneNode(true) as HTMLElement
                    
                    // Remove <script> tags from the clone. 
                    // We don't want them running AGAIN inside GrapesJS.
                    const scripts = bodyClone.querySelectorAll('script')
                    scripts.forEach(s => s.remove())
                    
                    const finalHtml = bodyClone.innerHTML

                    // Save this "Baked" data for GrapesJS
                    setHydratedData({
                        html: finalHtml,
                        css: cssBlocks
                    })
                } catch (e) {
                    console.error("Hydration failed", e)
                    // Fallback: If hydration crashes, try loading raw HTML
                    setHydratedData({
                        html: rawHtml,
                        css: []
                    })
                } finally {
                    // Cleanup the iframe
                    document.body.removeChild(iframe)
                    setIsHydrating(false)
                }
            }
        }
    }, [template])

    // Refetch template and reload editor
    const refetchTemplate = async () => {
        try {
            const data = await fetchTemplate()
            if (!data || !editor) return
            
            const rawHTML = data.html || data.html_content || ''
            const isNewTemplate = data.template_id && (
                data.template_id.startsWith('AD') || 
                data.template_id.startsWith('LD')
            )
            
            // Extract CSS
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
            let styleMatch
            const cssBlocks: string[] = []
            while ((styleMatch = styleRegex.exec(rawHTML)) !== null) {
                if (styleMatch[1]) {
                    cssBlocks.push(styleMatch[1].trim())
                }
            }
            const extractedCSS = cssBlocks.join('\n\n')
            
            // Extract CONFIG script for new templates
            let configScript: string | null = null
            if (isNewTemplate) {
                const configScriptMatch = rawHTML.match(/<script[^>]*>[\s\S]*?const\s+CONFIG\s*=[\s\S]*?<\/script>/i)
                if (configScriptMatch) {
                    configScript = configScriptMatch[0]
                }
            }
            
            // Determine body content (same logic as initEditor)
            const startsWithStyle = /^[\s\n]*<style[^>]*>/i.test(rawHTML.trim())
            const hasBodyTag = /<body[^>]*>/i.test(rawHTML)
            
            let bodyContent: string
            if (startsWithStyle && hasBodyTag) {
                bodyContent = rawHTML
            } else if (hasBodyTag) {
                const bodyMatch = rawHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
                bodyContent = bodyMatch ? bodyMatch[1].trim() : rawHTML
                
                // Clean body content
                let previousLength = 0
                let iterations = 0
                const maxIterations = 5
                while (iterations < maxIterations && bodyContent.length !== previousLength) {
                    previousLength = bodyContent.length
                    bodyContent = bodyContent
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<link[^>]*>/gi, '')
                        .replace(/<meta[^>]*>/gi, '')
                        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .trim()
                    iterations++
                }
            } else {
                const styleTagMatch = rawHTML.match(/<\/style>/i)
                if (styleTagMatch && styleTagMatch.index !== undefined) {
                    bodyContent = rawHTML.substring(styleTagMatch.index + styleTagMatch[0].length).trim()
                } else {
                    bodyContent = rawHTML
                }
                
                // Clean head elements
                let previousLength = 0
                let iterations = 0
                const maxIterations = 5
                while (iterations < maxIterations && bodyContent.length !== previousLength) {
                    previousLength = bodyContent.length
                    bodyContent = bodyContent
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<link[^>]*>/gi, '')
                        .replace(/<meta[^>]*>/gi, '')
                        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .trim()
                    iterations++
                }
            }
            
            // Update editor
            editor.setComponents(bodyContent)
            if (extractedCSS) {
                editor.setStyle(extractedCSS)
            }
            
            // Re-inject CONFIG script for new templates
            if (isNewTemplate && configScript) {
                const iframe = editor.Canvas.getFrameEl()
                if (iframe && iframe.contentDocument) {
                    // Remove existing CONFIG script if any
                    const existingScripts = iframe.contentDocument.querySelectorAll('script')
                    existingScripts.forEach((script: HTMLScriptElement) => {
                        if (script.textContent?.includes('const CONFIG')) {
                            script.remove()
                        }
                    })
                    
                    // Add new CONFIG script
                    const script = iframe.contentDocument.createElement('script')
                    script.textContent = configScript.replace(/<script[^>]*>|<\/script>/gi, '')
                    iframe.contentDocument.head.appendChild(script)
                }
            }
        } catch (error) {
            console.error('Error refetching template:', error)
        }
    }

    // 3. Initialize GrapesJS (Handle both hydrated and non-hydrated templates)
    useEffect(() => {
        // We wait for hydratedData, NOT just template
        if (!hydratedData || !editorRef.current || editor) return

        const initEditor = async () => {
            const grapesjs = (await import('grapesjs')).default
            // @ts-ignore - CSS import doesn't have type declarations
            await import('grapesjs/dist/css/grapes.min.css')

            const rawHtml = template.html || template.html_content || ''
            const isNewTemplate = needsHydration(rawHtml)

            // Use hydrated data (works for both new and old templates)
            const components = hydratedData.html
            const styles = hydratedData.css

            const editorInstance = grapesjs.init({
                container: editorRef.current!,
                height: '100%',
                width: '100%',
                fromElement: false,
                storageManager: false,
                panels: { defaults: [] },
                blockManager: { appendTo: '' },
                styleManager: { appendTo: '' },
                layerManager: { appendTo: '' },
                traitManager: { appendTo: '' },
                deviceManager: { devices: [] },
                assetManager: false as any,
                canvas: {
                    styles: styles, // Injects extracted CSS
                    scripts: [],
                },
                components: components, // Injects HTML
                richTextEditor: {
                    actions: ['bold', 'italic', 'underline', 'strikethrough'],
                },
            })

            // --- Editor Configuration (Make Text Editable) ---
            const wrapper = editorInstance.getWrapper()
            
            const wrapTextNodes = (component: any) => {
                const children = component.components()
                const tagName = component.get('tagName')?.toLowerCase()
                
                const containerTags = ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'figure', 'nav', 'ul', 'ol', 'body']
            
                if (!containerTags.includes(tagName)) {
                    if (children && children.length > 0) children.each((child: any) => wrapTextNodes(child))
                    return
                }
                
                if (children && children.length > 0) {
                    const textNodesToWrap: Array<{ node: any, index: number, content: string }> = []
                    children.each((child: any, index: number) => {
                        const childType = child.get('type')
                        if (childType === 'textnode') {
                            const content = child.get('content') || ''
                            if (content.trim()) textNodesToWrap.push({ node: child, index, content: content.trim() })
                        } else {
                            wrapTextNodes(child)
                        }
                    })
                    
                    for (let i = textNodesToWrap.length - 1; i >= 0; i--) {
                        const { node, index, content } = textNodesToWrap[i]
                        component.components().remove(node)
                        component.components().add({
                            type: 'text', tagName: 'span', content: content, editable: true, selectable: true
                        }, { at: index })
                    }
                }
            }
        
            const configureComponents = (component: any) => {
                const tagName = component.get('tagName')?.toLowerCase()
                const children = component.components()
                
                const containerTags = ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'figure', 'nav', 'ul', 'ol', 'body']
                if (containerTags.includes(tagName)) {
                    component.set({ selectable: false, draggable: false, droppable: false, editable: false })
                }
                else if (tagName === 'img') {
                    component.set({ selectable: true, editable: false, draggable: false, removable: false, copyable: false })
                }
                else {
                    component.set({ selectable: true, editable: true, draggable: false, removable: false, copyable: false })
                }
                
                if (children && children.length > 0) children.each((child: any) => configureComponents(child))
            }
            
            if (wrapper) {
                wrapTextNodes(wrapper)
                configureComponents(wrapper)
            }

            // Ensure CSS is applied inside GrapesJS canvas for both new and old templates
            if (styles && styles.length > 0) {
                editorInstance.setStyle(styles.join('\n\n'))
            }
            
            // --- Image Upload Handler ---
            let imageInputRef: HTMLInputElement | null = null
            let isUploading = false
            
            const handleComponentSelected = (component: any) => {
                const tagName = component.get('tagName')?.toLowerCase()
                if (tagName === 'img') {
                    if (isUploading) return
                    
                    if (imageInputRef && document.body.contains(imageInputRef)) {
                        document.body.removeChild(imageInputRef)
                        imageInputRef = null
                    }
                    
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
                        if (!file) { cleanup(); return; }
                        isUploading = true

                        // UX: Immediately inform the user that upload has started
                        toast({
                            title: "Uploading image...",
                            description: "Your image is being uploaded and will appear in the editor in a moment.",
                        })
                        
                        try {
                            const formData = new FormData()
                            formData.append('file', file)
                            const response = await fetch('/api/upload-image', { method: 'POST', body: formData })
                            if (!response.ok) throw new Error('Upload failed')
                            const data = await response.json()
                            component.set('src', data.url)
                            toast({ title: "Image replaced", description: "The image has been successfully replaced." })
                        } catch (error: any) {
                            toast({ title: "Upload failed", description: "Failed to upload image.", variant: "destructive" })
                        } finally { cleanup() }
                    }
                    input.oncancel = cleanup
                    document.body.appendChild(input)
                    input.click()
                }
            }
            
            editorInstance.on('component:selected', handleComponentSelected)
            ;(editorInstance as any)._imageUploadHandler = handleComponentSelected

            // Clean UI Style
            const style = document.createElement('style')
            style.innerHTML = `
                .gjs-cv-canvas { width: 100% !important; height: 100% !important; }
                .gjs-frame { border: none !important; }
                .gjs-toolbar { display: none !important; }
                .gjs-resizer-c { display: none !important; }
                .gjs-badge { display: none !important; }
                .gjs-highlighter { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; }
                .gjs-selected { outline: 2px solid #3b82f6 !important; outline-offset: -2px !important; }
                body { margin: 0; padding: 0; overflow: hidden; }
            `
            document.head.appendChild(style)

            setEditor(editorInstance)

            // CRITICAL FIX: Manually inject :root CSS variables into GrapeJS canvas iframe
            // GrapeJS doesn't always properly apply :root styles, so we inject them directly
            // This works for both new and old templates
            setTimeout(() => {
                const canvasFrame = editorInstance.Canvas.getFrameEl() as HTMLIFrameElement
                if (canvasFrame && canvasFrame.contentDocument) {
                    const iframeDoc = canvasFrame.contentDocument
                    
                    // Extract :root styles from CSS
                    const rootStyles: string[] = []
                    styles.forEach(cssBlock => {
                        // Find :root rules in the CSS
                        const rootMatch = cssBlock.match(/:root\s*\{([^}]+)\}/g)
                        if (rootMatch) {
                            rootMatch.forEach(match => {
                                // Extract the content inside :root { }
                                const contentMatch = match.match(/:root\s*\{([^}]+)\}/)
                                if (contentMatch && contentMatch[1]) {
                                    rootStyles.push(contentMatch[1])
                                }
                            })
                        }
                    })
                    
                    // Also check for standalone :root blocks
                    styles.forEach(cssBlock => {
                        if (cssBlock.trim().startsWith(':root')) {
                            const rootContent = cssBlock.replace(/:root\s*\{?\s*/, '').replace(/\s*\}?\s*$/, '')
                            if (rootContent) {
                                rootStyles.push(rootContent)
                            }
                        }
                    })
                    
                    // Inject :root styles into iframe's head if not already present
                    if (rootStyles.length > 0) {
                        const rootStyleContent = rootStyles.join('; ')
                        
                        // Check if :root styles already exist
                        const existingRootStyle = iframeDoc.querySelector('style[data-root-vars]')
                        if (existingRootStyle) {
                            existingRootStyle.textContent = `:root { ${rootStyleContent} }`
                        } else {
                            const rootStyleTag = iframeDoc.createElement('style')
                            rootStyleTag.setAttribute('data-root-vars', 'true')
                            rootStyleTag.textContent = `:root { ${rootStyleContent} }`
                            iframeDoc.head.appendChild(rootStyleTag)
                        }
                    }
                }
            }, 100) // Small delay to ensure iframe is fully loaded
        }

        initEditor()

        return () => {
            if (editor) {
                const handler = (editor as any)._imageUploadHandler
                if (handler) editor.off('component:selected', handler)
                editor.destroy()
            }
        }
    }, [hydratedData, toast, template]) // Only run when hydration is complete

    const handleSave = async () => {
        if (!editor) return

        setIsSaving(true)
        try {
            const html = editor.getHtml()
            const css = editor.getCss()
            
            const rawHtml = template.html || template.html_content || ''
            const isNewTemplate = needsHydration(rawHtml) // Use function instead of template_id check
            
            let fullHtml: string
            
            if (isNewTemplate) {
                // For new templates, preserve full structure
                const hasOriginalStructure = hasFullStructure(rawHtml)
                
                if (hasOriginalStructure) {
                    // Extract original head content
                    const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
                    let headContent = headMatch ? headMatch[1] : ''
                    
                    // Remove CONFIG and page population scripts from head
                    headContent = headContent.replace(/<script[^>]*>[\s\S]*?const\s+CONFIG[\s\S]*?<\/script>/gi, '')
                    headContent = headContent.replace(/<script[^>]*>[\s\S]*?POPULATE PAGE[\s\S]*?<\/script>/gi, '')
                    
                    // Extract CONFIG script
                    const configScriptMatch = rawHtml.match(/<script[^>]*>[\s\S]*?const\s+CONFIG\s*=[\s\S]*?<\/script>/i)
                    const configScript = configScriptMatch ? configScriptMatch[0] : ''
                    
                    // Extract page population script
                    const pageScriptMatch = rawHtml.match(/<script[^>]*>[\s\S]*?POPULATE PAGE[\s\S]*?<\/script>/i)
                    const pageScript = pageScriptMatch ? pageScriptMatch[0] : ''
                    
                    // Build full HTML
                    fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${headContent}
    <style>${css}</style>
    ${configScript}
</head>
<body>
    ${html}
    ${pageScript}
</body>
</html>`
                } else {
                    // Original doesn't have full structure, but it's a new template
                    // Try to extract CONFIG and reconstruct
                    const configScriptMatch = rawHtml.match(/<script[^>]*>[\s\S]*?const\s+CONFIG\s*=[\s\S]*?<\/script>/i)
                    const configScript = configScriptMatch ? configScriptMatch[0] : ''
                    
                    const pageScriptMatch = rawHtml.match(/<script[^>]*>[\s\S]*?POPULATE PAGE[\s\S]*?<\/script>/i)
                    const pageScript = pageScriptMatch ? pageScriptMatch[0] : ''
                    
                    // Extract any link tags from original
                    const linkTags = (rawHtml.match(/<link[^>]*>/gi) || []).join('\n    ')
                    
                    fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${linkTags}
    <style>${css}</style>
    ${configScript}
</head>
<body>
    ${html}
    ${pageScript}
</body>
</html>`
                }
            } else {
                // For old templates, use simple structure
                fullHtml = `<style>${css}</style>${html}`
            }

            const authHeaders = getAuthorizationHeader()

            const response = await fetch(`/api/templates/injected/${params.templateId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify({ html: fullHtml }),
            })

            if (!response.ok) throw new Error('Failed to save template')

            toast({ title: "Template saved", description: "Your changes have been saved successfully." })

            // Notify parent window (results page) to refresh templates, if available
            try {
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(
                        { type: 'TEMPLATE_UPDATED', injectedTemplateId: params.templateId },
                        window.location.origin
                    )
                }
            } catch (e) {
                // Ignore cross-origin errors; user can manually refresh in worst case
            }

            // Close editor shortly after save
            setTimeout(() => window.close(), 800)
        } catch (error) {
            toast({ title: "Save failed", description: "Failed to save template.", variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (confirm('Are you sure you want to discard your changes?')) {
            window.close()
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <LoadingSpinner className="mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading editor...</p>
                </div>
            </div>
        )
    }

    if (!template) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Template Not Found</h2>
                    <p className="text-muted-foreground mb-4">
                        The requested template could not be found.
                    </p>
                    <Button onClick={() => window.close()}>
                        Close Window
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <>
        {/* Floating button for image generation */}
        {showImageGenFloater && (
            <ImageGenerationFloater
                onYes={() => {
                    setShowImageGenFloater(false)
                    setIsImageGenDialogOpen(true)
                }}
                onNo={() => {
                    setShowImageGenFloater(false)
                }}
            />
        )}
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">
                        Edit Template: {template.angle_name || 'Template'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Click any text to edit • Click any image to replace
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

            {/* Editor Container with Hydration Loading State */}
            <div className="flex-1 relative">
                {(isHydrating || !hydratedData) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                            <p className="text-muted-foreground">Hydrating dynamic content...</p>
                        </div>
                    </div>
                )}
                <div ref={editorRef} className="absolute inset-0" />
            </div>
        </div>

        <AlertDialog open={false} onOpenChange={setIsImageGenPromptOpen}>
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

        {template?.template_id && NEW_TEMPLATE_IDS.some(baseId => template.template_id?.startsWith(baseId)) ? (
            <TemplateImageGenerationDialog
                isOpen={isImageGenDialogOpen}
                onClose={() => setIsImageGenDialogOpen(false)}
                templateId={template.template_id}
                injectedTemplateId={params.templateId}
                configData={template.config_data || {}}
                onImagesGenerated={async (images) => {
                    // Replace images in HTML using utility function
                    let updatedHtml = template?.html_content || template?.html || ''
                    updatedHtml = replaceTemplateImagesInHTML(updatedHtml, images, template?.template_id)

                    // Update editor if it's initialized
                    if (editor) {
                        // Save the updated HTML to the database
                        try {
                            const authHeaders = getAuthorizationHeader()

                            const response = await fetch(`/api/templates/injected/${params.templateId}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...authHeaders,
                                },
                                body: JSON.stringify({ html: updatedHtml }),
                            })
                            
                            if (!response.ok) {
                                const error = await response.json()
                                throw new Error(error.error || 'Failed to save template')
                            }
                            
                            toast({
                                title: "Images updated & saved",
                                description: `Generated ${images.length} image${images.length !== 1 ? "s" : ""}. Closing editor...`,
                            })

                            // Notify parent window (results page) to refresh templates
                            try {
                                if (window.opener && !window.opener.closed) {
                                    window.opener.postMessage(
                                        { type: 'TEMPLATE_UPDATED', injectedTemplateId: params.templateId },
                                        window.location.origin
                                    )
                                }
                            } catch (e) {
                                // Ignore cross-origin errors
                            }

                            // Close editor after showing toast for ~1.5 seconds
                            setTimeout(() => window.close(), 1500)
                        } catch (error) {
                            console.error('Failed to save updated HTML:', error)
                            toast({
                                title: "Save failed",
                                description: `Images were generated but failed to save. Please try again.`,
                                variant: "destructive",
                            })
                        }
                    }
                }}
            />
        ) : (
        <PrelanderImageGenerationDialog
            isOpen={isImageGenDialogOpen}
            onClose={() => setIsImageGenDialogOpen(false)}
            html={hydratedData?.html || ''} 
            onImagesGenerated={(count, updatedHtml) => {
                if (editor) {
                    editor.setComponents(updatedHtml)
                    toast({ title: "Images updated", description: `Updated ${count} images.` })
                }
            }}
        />
        )}
    </>
    )
}
