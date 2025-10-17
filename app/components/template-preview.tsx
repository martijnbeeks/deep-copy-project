"use client"

import { useState, useRef, useEffect } from "react"
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
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const createSmallPreviewHTML = (htmlContent: string) => {
    // Fix broken image URLs and use the exact same HTML as full preview, just add scaling
    let processedContent = htmlContent
      .replace(/https?:\/\/[^\s"']*FFFFFF\?[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
      .replace(/https?:\/\/[^\s"']*placehold\.co\/[^"'\s]*FFFFFF[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
      .replace(/src="[^"]*FFFFFF[^"]*"/g, 'src="https://placehold.co/600x400?text=Image"')
      .replace(/src='[^']*FFFFFF[^']*'/g, "src='https://placehold.co/600x400?text=Image'")
    
    // Wrap in basic HTML structure with Tailwind CDN
    const wrappedContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com?v=${Date.now()}"></script>
</head>
<body>
  ${processedContent}
</body>
</html>`
    
    return wrappedContent.replace(
      /<body([^>]*)>/i,
      '<body$1 style="transform: scale(0.3); transform-origin: top left; width: 333%; height: 333%; overflow: hidden;">'  
    )
  }

  const createFullPreviewHTML = (htmlContent: string) => {
    // Use the same logic as small preview but without scaling - just full size
    let processedContent = htmlContent
      .replace(/https?:\/\/[^\s"']*FFFFFF\?[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
      .replace(/https?:\/\/[^\s"']*placehold\.co\/[^"'\s]*FFFFFF[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
      .replace(/src="[^"]*FFFFFF[^"]*"/g, 'src="https://placehold.co/600x400?text=Image"')
      .replace(/src='[^']*FFFFFF[^']*'/g, "src='https://placehold.co/600x400?text=Image'")
    
    // Wrap in basic HTML structure with Tailwind CDN - same as small preview but no scaling
    const wrappedContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com?v=${Date.now()}"></script>
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
  ${processedContent}
  <script>
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a, button, [onclick]');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    document.addEventListener('submit', function(e) {
      e.preventDefault();
    });
    
    window.parent.postMessage('iframe-ready', '*');
  </script>
</body>
</html>`
    
    return wrappedContent
  }

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
      onClick={onClick}
    >
      {/* Template Header */}
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base md:text-lg text-foreground truncate">{template.name}</h3>
          <p className="text-xs md:text-sm text-muted-foreground truncate">{template.description || 'No description available'}</p>
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
          key={`${template.id}-${Date.now()}`}
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
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-4 w-4" />
              Full Preview
            </button>
          </DialogTrigger>
          <DialogContent className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden">
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
                key={`full-${template.id}-${Date.now()}`}
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
