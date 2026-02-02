"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Copy, Download, Eye, FileText, DownloadCloud, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import JSZip from "jszip"

interface Template {
    id?: string
    name: string
    type: string
    html: string
    angle?: string
    timestamp?: string
    swipe_file_name?: string
}

interface TemplateGridProps {
    templates: Template[]
    isLoading?: boolean
    onDelete?: (templateId: string) => void
}

// Lazy iframe component that only loads when visible
function LazyIframe({ srcDoc, className, style, sandbox, title, ...props }: React.IframeHTMLAttributes<HTMLIFrameElement> & { srcDoc: string }) {
    const [shouldLoad, setShouldLoad] = useState(false)
    const iframeRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!iframeRef.current) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setShouldLoad(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '50px' } // Start loading 50px before it's visible
        )

        observer.observe(iframeRef.current)

        return () => observer.disconnect()
    }, [])

    return (
        <div ref={iframeRef} className={className} style={style}>
            {shouldLoad ? (
                <iframe
                    srcDoc={srcDoc}
                    className={className}
                    style={style}
                    sandbox={sandbox}
                    title={title}
                    {...props}
                />
            ) : (
                <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
            )}
        </div>
    )
}

export function TemplateGrid({ templates, isLoading, onDelete }: TemplateGridProps) {
    const [copied, setCopied] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const { toast } = useToast()

    // Memoize HTML processing function
    const createPreviewHTML = useMemo(() => {
        return (htmlContent: string) => {
            const raw = htmlContent;
            const hasRealImages = /res\.cloudinary\.com|images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|\b)/i.test(raw);
            if (!hasRealImages) return raw;
            const noOnError = raw
                .replace(/\s+onerror="[^"]*"/gi, '')
                .replace(/\s+onerror='[^']*'/gi, '');
            const stripFallbackScripts = noOnError.replace(/<script[\s\S]*?<\/script>/gi, (block) => {
                const lower = block.toLowerCase();
                return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                    ? ''
                    : block;
            });
            return stripFallbackScripts;
        }
    }, [])

    // Memoize iframe HTML for each template
    const templateIframeHTML = useMemo(() => {
        return templates.reduce((acc, template) => {
            acc[template.name] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Disable interactions on all clickable elements */
    a, button, input, select, textarea, [onclick], [role="button"], 
    [tabindex]:not([tabindex="-1"]), label[for] {
      pointer-events: none !important;
      cursor: default !important;
    }
    /* Allow scrolling */
    body, html {
      overflow: auto !important;
      pointer-events: auto !important;
    }
  </style>
</head>
<body>
  ${createPreviewHTML(template.html)}
  <script>
    (function(){
      function isTrusted(src){ return /res\\.cloudinary\\.com|images\\.unsplash\\.com|(\\.png|\\.jpe?g|\\.webp|\\.gif)(\\?|$)/i.test(src || ''); }
      function ph(img){ var alt=(img.getAttribute('alt')||'Image'); var text=encodeURIComponent(alt.replace(/[^a-zA-Z0-9\s]/g,'').substring(0,20)||'Image'); return 'https://placehold.co/600x400?text='+text; }
      function apply(img){
        if (isTrusted(img.src)) { img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); }; return; }
        if (!img.complete || img.naturalWidth === 0) { img.src = ph(img); }
        img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); };
      }
      function run(){ document.querySelectorAll('img').forEach(apply); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
      setTimeout(run, 800);
    })();
  </script>
</body>
</html>`;
            return acc;
        }, {} as Record<string, string>);
    }, [templates, createPreviewHTML])

    const handleCopyHTML = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast({
                title: "HTML copied",
                description: "The HTML content has been copied to your clipboard.",
            })
        } catch (err) {
            console.error('Failed to copy HTML:', err)
            toast({
                title: "Copy failed",
                description: "Failed to copy HTML to clipboard.",
                variant: "destructive",
            })
        }
    }

    const handleDownload = (content: string, filename: string) => {
        try {
            const blob = new Blob([content], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast({
                title: "Downloaded",
                description: `${filename} has been downloaded.`,
            })
        } catch (err) {
            console.error('Failed to download template:', err)
            toast({
                title: "Download failed",
                description: "Failed to download template.",
                variant: "destructive",
            })
        }
    }

    const handleDelete = async (templateId: string, templateName: string) => {
        if (!confirm(`Are you sure you want to delete "${templateName}"?`)) {
            return
        }

        if (!templateId) {
            toast({
                title: "Cannot delete",
                description: "Template ID is missing.",
                variant: "destructive",
            })
            return
        }

        setDeleting(templateId)
        try {
            const response = await fetch(`/api/templates/injected/${templateId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete template')
            }

            toast({
                title: "Template deleted",
                description: `"${templateName}" has been deleted.`,
            })

            // Call the onDelete callback to refresh the list
            if (onDelete) {
                onDelete(templateId)
            }
        } catch (err) {
            console.error('Failed to delete template:', err)
            toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete template.",
                variant: "destructive",
            })
        } finally {
            setDeleting(null)
        }
    }

    const handleDownloadAll = async () => {
        if (templates.length === 0) {
            toast({
                title: "No templates",
                description: "There are no templates to download.",
                variant: "destructive",
            })
            return
        }

        try {
            const zip = new JSZip()

            // Add all templates to zip
            templates.forEach((template) => {
                const filename = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
                zip.file(filename, template.html)
            })

            // Generate zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(zipBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `templates_${new Date().getTime()}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            toast({
                title: "Download complete",
                description: `All ${templates.length} template(s) downloaded as ZIP file.`,
            })
        } catch (err) {
            console.error('Failed to create zip file:', err)
            toast({
                title: "Download failed",
                description: "Failed to create ZIP file. Please try again.",
                variant: "destructive",
            })
        }
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="h-4 bg-muted rounded mb-2"></div>
                            <div className="h-3 bg-muted rounded mb-4 w-2/3"></div>
                            <div className="h-32 bg-muted rounded"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (templates.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Generated Prelanders</h3>
                <p className="text-muted-foreground">
                    No prelanders were generated for this job.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Generated Prelanders</h3>
                    <p className="text-sm text-muted-foreground">
                        {templates.length} template{templates.length !== 1 ? 's' : ''} generated
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {templates.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadAll}
                        >
                            <DownloadCloud className="h-4 w-4 mr-2" />
                            Download All
                        </Button>
                    )}
                    <Badge variant="outline">
                        {templates.length} template{templates.length !== 1 ? 's' : ''}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template, index) => (
                    <Card key={index} className="group hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        {template.type && (
                                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30">
                                                {template.type}
                                            </Badge>
                                        )}
                                        {template.swipe_file_name && (
                                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30">
                                                {template.swipe_file_name}
                                            </Badge>
                                        )}
                                    </div>
                                    <h4 className="font-semibold text-foreground mb-1 break-words">
                                        {template.angle || template.name}
                                    </h4>
                                    {template.timestamp && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(template.timestamp).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                <div className="h-32 bg-white rounded-lg overflow-hidden border border-gray-200 relative">
                                    <div className="absolute inset-0 overflow-hidden">
                                        <LazyIframe
                                            key={`preview-${template.name}-${index}`}
                                            srcDoc={templateIframeHTML[template.name]}
                                            className="w-full h-full"
                                            style={{
                                                border: 'none',
                                                transform: 'scale(0.3)',
                                                transformOrigin: 'top left',
                                                width: '333.33%',
                                                height: '333.33%',
                                                pointerEvents: 'none'
                                            }}
                                            sandbox="allow-scripts"
                                            title={`Preview of ${template.angle || template.name}`}
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 pointer-events-none"></div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownload(template.html, `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`)}
                                        className="flex-1"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                    {template.id && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(template.id!, template.angle || template.name)}
                                            disabled={deleting === template.id}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {deleting === template.id ? 'Deleting...' : 'Delete'}
                                        </Button>
                                    )}
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="flex-1" size="sm">
                                                <Eye className="h-4 w-4 mr-2" />
                                                Preview
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden p-2">
                                            <DialogHeader className="pb-2">
                                                <DialogTitle className="text-xl font-bold">
                                                    {template.angle || template.name}
                                                </DialogTitle>
                                                <DialogDescription>
                                                    {template.type} • {template.timestamp ? new Date(template.timestamp).toLocaleString() : 'Generated'}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="h-[calc(98vh-120px)] border rounded-lg bg-background overflow-auto">
                                                <iframe
                                                    key={`full-preview-${template.name}-${index}`}
                                                    srcDoc={templateIframeHTML[template.name]}
                                                    className="w-full h-full"
                                                    sandbox="allow-scripts"
                                                    style={{
                                                        border: 'none',
                                                        width: '100%',
                                                        height: '100%'
                                                    }}
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCopyHTML(template.html)}
                                                >
                                                    {copied ? 'Copied!' : 'Copy HTML'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownload(template.html, `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`)}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
