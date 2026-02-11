"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Eye, FileText } from "lucide-react"

// Update interface to include optional prediction data
export interface TemplatePreviewProps {
  template: {
    id: string
    name: string
    description?: string
    html_content: string
    category?: string
  }
  isSelected: boolean
  onClick: () => void
  prediction?: {
    overall_fit_score: number
    reasoning: string
    audience_fit?: number
    pain_point_fit?: number
    tone_fit?: number
  }
}


// Lazy iframe component that only loads when visible
function LazyIframe({ srcDoc, className, style, title, onLoad, onError, ...props }: React.IframeHTMLAttributes<HTMLIFrameElement> & { srcDoc: string }) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' } // Start loading 50px before it's visible
    )

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className} style={style}>
      {shouldLoad ? (
        <iframe
          srcDoc={srcDoc}
          className={className}
          style={style}
          title={title}
          onLoad={onLoad}
          onError={onError}
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

export function TemplatePreview({ template, isSelected, onClick, prediction }: TemplatePreviewProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogClosing, setIsDialogClosing] = useState(false)

  // Memoize the HTML processing function
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

  // Memoize the actual iframe HTML content based on template
  const smallPreviewHTML = useMemo(() => {
    return createSmallPreviewHTML(template.html_content)
  }, [template.html_content, createSmallPreviewHTML]);

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

  // Memoize the actual iframe HTML content based on template
  const fullPreviewHTML = useMemo(() => {
    return createFullPreviewHTML(template.html_content)
  }, [template.html_content, createFullPreviewHTML]);

  // Load state is handled via onLoad prop in LazyIframe

  return (
    <div
      key={template.id}
      className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all h-auto min-h-[420px] flex flex-col group ${isSelected
        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
        : 'border-border bg-card hover:border-sidebar-accent-foreground/20'
        }`}
      onClick={(e) => {
        // Call the selection handler when clicking on the template
        const target = e.target as HTMLElement
        const isButton = target.closest('button') !== null

        // Only handle selection if not clicking a button
        if (!isButton) {
          e.stopPropagation()
          onClick() // Call the selection handler
        }
      }}
    >
      {/* Prediction Score Banner */}
      {prediction && (
        <div className="absolute -top-3 right-2 z-10">
          <div className={`
            px-3 py-1 rounded-full text-xs font-bold shadow-sm border
            bg-zinc-900 border-zinc-800 backdrop-blur-sm
          `}>
            <span className="text-primary">{(prediction.overall_fit_score * 100).toFixed(0)}%</span> <span className="text-white">Match</span>
          </div>
        </div>
      )}

      {/* Template Header */}
      <div className="flex items-start justify-between mb-3 gap-1.5 pt-2 px-1">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground break-words line-clamp-1">{template.name}</h3>
          <p className="text-xs text-muted-foreground break-words line-clamp-1">{template.description || 'No description available'}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 border border-primary/20 text-primary rounded-full">
            {template.category
              ? template.category.charAt(0).toUpperCase() + template.category.slice(1).toLowerCase()
              : 'General'}
          </span>
        </div>
      </div>

      {/* Preview Area */}
      <div
        className="relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border cursor-pointer h-[200px] mb-3 group-hover:border-primary/50 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <LazyIframe
          key={template.id}
          srcDoc={smallPreviewHTML}
          className="w-full h-full border-0 pointer-events-none"
          title={`Preview of ${template.name}`}
          onLoad={() => {
            setTimeout(() => setIsLoaded(true), 200)
          }}
          onError={() => {
            setIsLoaded(true)
          }}
        />
      </div>

      {/* Prediction Details Footer */}
      {prediction ? (
        <div className="space-y-3 pt-2 border-t border-border/50">
          {/* Reasoning */}
          {prediction.reasoning && (
            <div className="bg-muted/30 rounded-md p-2 text-xs text-muted-foreground border border-border/50">
              <span className="font-semibold text-primary block mb-0.5 text-[10px] uppercase tracking-wider">Why we picked this:</span>
              <p className="transition-all leading-relaxed">
                {prediction.reasoning}
              </p>
            </div>
          )}

          {/* Sub-scores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Audience', value: prediction.audience_fit },
              { label: 'Pain', value: prediction.pain_point_fit },
              { label: 'Tone', value: prediction.tone_fit }
            ].map((metric, i) => (
              metric.value !== undefined && (
                <div key={i} className="flex flex-col gap-1" title={`${metric.label} Fit: ${Math.round(metric.value * 100)}%`}>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                    <span>{metric.label}</span>
                    <span>{Math.round(metric.value * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        metric.value >= 0.8 ? 'bg-green-500' : 
                        metric.value >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${metric.value * 100}%` }}
                    />
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" /> /* Spacer if no prediction */
      )}



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
                srcDoc={fullPreviewHTML}
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
