"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Eye } from "lucide-react"

interface TemplatePreviewProps {
  template: {
    id: string
    name: string
    description?: string
    html_content: string
    category?: string
  }
  isSelected: boolean
  onClick: () => void
}

export function TemplatePreview({ template, isSelected, onClick }: TemplatePreviewProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogClosing, setIsDialogClosing] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const createSmallPreviewHTML = useMemo(() => {
    return (htmlContent: string) => {
      const hasRealImages = /res\.cloudinary\.com|images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|\b)/i.test(htmlContent);
      const processed = hasRealImages
        ? htmlContent
            .replace(/\s+onerror="[^"]*"/gi, '')
            .replace(/\s+onerror='[^']*'/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, (block) => {
              const lower = block.toLowerCase();
              return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                ? ''
                : block;
            })
        : htmlContent;

      // Just wrap in basic HTML structure with Tailwind -- do not replace or alter image URLs!
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body style="transform: scale(0.3); transform-origin: top left; width: 333%; height: 333%; overflow: hidden;">
  ${processed}
  <script>
    (function(){
      function isTrusted(src){ return /res\\.cloudinary\\.com|images\\.unsplash\\.com|(\\.png|\\.jpe?g|\\.webp|\\.gif)(\\?|$)/i.test(src || ''); }
      function ph(img){ var alt=(img.getAttribute('alt')||'Image'); var text=encodeURIComponent(alt.replace(/[^a-zA-Z0-9\\s]/g,'').substring(0,20)||'Image'); return 'https://placehold.co/600x400?text='+text; }
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
    }
  }, []);

  const createFullPreviewHTML = useMemo(() => {
    return (htmlContent: string) => {
      const hasRealImages = /res\.cloudinary\.com|images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|\b)/i.test(htmlContent);
      const processed = hasRealImages
        ? htmlContent
            .replace(/\s+onerror="[^"]*"/gi, '')
            .replace(/\s+onerror='[^']*'/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, (block) => {
              const lower = block.toLowerCase();
              return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                ? ''
                : block;
            })
        : htmlContent;

      // Just wrap in basic HTML structure (no .replace)
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      margin: 0; 
      padding: 10px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #333;
      background: #fff;
    }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    .container { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  ${processed}
  <script>
    (function(){
      function isTrusted(src){ return /res\\.cloudinary\\.com|images\\.unsplash\\.com|(\\.png|\\.jpe?g|\\.webp|\\.gif)(\\?|$)/i.test(src || ''); }
      function ph(img){ var alt=(img.getAttribute('alt')||'Image'); var text=encodeURIComponent(alt.replace(/[^a-zA-Z0-9\\s]/g,'').substring(0,20)||'Image'); return 'https://placehold.co/600x400?text='+text; }
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
    }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe) {
      const handleLoad = () => {
        setIsLoaded(true)
      }
      
      iframe.addEventListener('load', handleLoad)
      return () => iframe.removeEventListener('load', handleLoad)
    }
  }, [])

  return (
    <div
      key={template.id}
      className={`relative cursor-pointer rounded-xl border-2 p-3 md:p-4 transition-all h-[350px] md:h-[400px] flex flex-col ${
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border bg-card'
      }`}
      onClick={(e) => {
        // Don't navigate if:
        // 1. Dialog is currently open or closing
        // 2. Click is on a button (like "Full Preview")
        // 3. Click is inside dialog content
        const target = e.target as HTMLElement
        const isButton = target.closest('button') !== null
        const isDialogContent = target.closest('[role="dialog"]') !== null
        
        if (!isDialogOpen && !isDialogClosing && !isButton && !isDialogContent) {
          onClick()
        }
      }}
    >
      {/* Template Header */}
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base md:text-lg text-foreground break-words">{template.name}</h3>
          <p className="text-xs md:text-sm text-muted-foreground break-words">{template.description || 'No description available'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
            {template.category || 'General'}
          </span>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border">
        
        <iframe
          key={template.id}
          ref={iframeRef}
          srcDoc={createSmallPreviewHTML(template.html_content)}
          className="w-full h-full border-0"
          loading="eager"
          title={`Preview of ${template.name}`}
          onLoad={() => {
            setTimeout(() => setIsLoaded(true), 200)
          }}
          onError={() => {
            setIsLoaded(true)
          }}
        />

      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-3">
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              // Set closing flag to prevent navigation
              setIsDialogClosing(true)
              setTimeout(() => {
                setIsDialogClosing(false)
              }, 100)
            }
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setIsDialogOpen(true)
              }}
            >
              <Eye className="h-4 w-4" />
              Full Preview
            </button>
          </DialogTrigger>
          <DialogContent 
            className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden"
            onInteractOutside={(e) => {
              // Prevent the click from bubbling to parent onClick
              e.stopPropagation()
            }}
            onPointerDownOutside={(e) => {
              // Prevent pointer events from bubbling when closing dialog
              e.stopPropagation()
            }}
          >
            <div className="p-4 pb-0">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Template Preview: {template.name}</DialogTitle>
                <DialogDescription>
                  {template.description || 'This is how your content will look with the selected template'}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 border-t bg-white overflow-hidden">
              <iframe
                key={`full-${template.id}`}
                srcDoc={createFullPreviewHTML(template.html_content)}
                className="w-full h-full border-0"
                style={{ 
                  width: '100%', 
                  height: 'calc(98vh - 120px)',
                  border: 'none'
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Selection Indicator */}
        {isSelected && (
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            Selected
          </div>
        )}
      </div>
    </div>
  )
}
