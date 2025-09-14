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

  const createPreviewHTML = (htmlContent: string) => {
    if (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) {
      return htmlContent
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
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
  ${htmlContent}
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
      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg h-[400px] flex flex-col ${
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50 bg-card'
      }`}
      onClick={onClick}
    >
      {/* Template Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-foreground truncate">{template.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{template.description || 'No description available'}</p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
            {template.category || 'General'}
          </span>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        )}
        
        <div className="w-full h-full bg-white overflow-hidden" style={{ padding: '2px' }}>
          <iframe
            ref={iframeRef}
            srcDoc={createPreviewHTML(template.html_content)}
            className="w-full h-full border-0"
            style={{
              transform: 'scale(0.3)',
              transformOrigin: 'top left',
              width: '333%',
              height: '333%',
              border: 'none',
              background: 'white'
            }}
            sandbox="allow-same-origin allow-scripts"
            loading="eager"
            title={`Preview of ${template.name}`}
            onLoad={() => {
              console.log(`Template ${template.name} loaded successfully`)
              setTimeout(() => setIsLoaded(true), 200)
            }}
            onError={() => {
              console.error(`Failed to load template: ${template.name}`)
              setIsLoaded(true) // Show the frame even if there's an error
            }}
          />
        </div>

        {/* Full Preview Button */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="opacity-0 hover:opacity-100 transition-opacity bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 cursor-pointer"
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
                  srcDoc={createPreviewHTML(template.html_content)}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  style={{ 
                    width: '100%', 
                    height: 'calc(98vh - 120px)',
                    border: 'none'
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                srcDoc={createPreviewHTML(template.html_content)}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
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
