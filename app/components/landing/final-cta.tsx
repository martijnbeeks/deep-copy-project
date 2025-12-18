"use client"

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  html_content: string;
  angle_name: string;
  swipe_file_name?: string;
}

const TEMPLATE_IDS = [
  "6a274e28-57eb-476d-9ab1-b477d2a7e0c8", // JAVVY HYROX
  "cbdd2176-dd56-4b3b-b5eb-9ff245a5b7a0", // TRY AURA BUGMD
  "a9ba3ca2-3f60-4963-b053-2408f1210754", // TRY AURA SPARTAN
];

const TEMPLATE_NAMES = [
  "Javvy Listicle - Hypowered",
  "BugMD Advertorial - NewAura",
  "BugMD Spartan - NewAura",
];

export const FinalCTA = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedPreviews, setLoadedPreviews] = useState<Set<string>>(new Set());
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const fetchedTemplates = await Promise.all(
          TEMPLATE_IDS.map(async (id, index) => {
            try {
              const response = await fetch(`/api/templates/injected/${id}`);
              if (response.ok) {
                const data = await response.json();
                return data;
              }
              return null;
            } catch (error) {
              console.error(`Error fetching template ${id}:`, error);
              return null;
            }
          })
        );

        setTemplates(fetchedTemplates.filter((t) => t !== null));
      } catch (error) {
        console.error("Error fetching templates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handlePreviewLoad = (templateId: string) => {
    setLoadedPreviews((prev) => new Set(prev).add(templateId));
  };

  return (
    <section id="results" className="py-10 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 text-sm font-medium text-primary">
            🚀 Ready to Transform Your Results?
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Transform Your Pre-Lander Conversions with{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              AI-Powered Intelligence
            </span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join forward-thinking marketers who've discovered the unfair advantage of AI-driven Pre-Landers. Limited spots available for our early adopter program — secure yours now.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-6">
            <Button size="lg" className="text-lg px-12 hover:scale-105 transition-transform" asChild>
              <Link href="/login?waitlist=true">Join Waitlist →</Link>
            </Button>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-primary animate-pulse"></span>
              <span>
                Only <span className="text-primary font-medium">5</span> More Spots Available
              </span>
            </div>
          </div>

          {/*<p className="text-sm text-muted-foreground mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>*/}

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              // Loading state
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-center aspect-video bg-muted rounded">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </div>
              ))
            ) : templates.length > 0 ? (
              // Display fetched templates
              templates.map((template, index) => (
                <div
                  key={template.id}
                  className="bg-muted/50 rounded-lg p-4 border hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground">
                      {TEMPLATE_NAMES[index] || `Sample Page ${index + 1}`}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(template);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                  <div className="relative aspect-video bg-background rounded overflow-hidden border">
                    {!loadedPreviews.has(template.id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <iframe
                      srcDoc={template.html_content}
                      className="w-full h-full border-0"
                      onLoad={() => handlePreviewLoad(template.id)}
                      sandbox="allow-same-origin allow-scripts"
                      title={`Preview of ${TEMPLATE_NAMES[index] || `Template ${index + 1}`}`}
                      style={{
                        transform: "scale(0.3)",
                        transformOrigin: "top left",
                        width: "333.33%",
                        height: "333.33%",
                        pointerEvents: "none",
                        opacity: loadedPreviews.has(template.id) ? 1 : 0,
                        transition: "opacity 0.3s",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              // Fallback if no templates loaded
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4 border">
                  <p className="text-xs text-muted-foreground mb-1">Sample Page {index + 1}</p>
                  <div className="aspect-video bg-muted rounded"></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] max-h-[95vh] overflow-hidden !max-w-none sm:!max-w-[95vw] p-0 flex flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>
                {previewTemplate && (TEMPLATE_NAMES[templates.findIndex(t => t.id === previewTemplate.id)] || "Template Preview")}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewTemplate(null)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden border-t bg-white dark:bg-gray-900 min-h-0">
            {previewTemplate && (
              <iframe
                srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #333;
      background: #fff;
    }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    .container { max-width: 100%; margin: 0 auto; }
    
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
  ${previewTemplate.html_content}
</body>
</html>`}
                className="w-full h-full border-0"
                style={{ height: 'calc(95vh - 100px)' }}
                title={`Preview of ${previewTemplate && (TEMPLATE_NAMES[templates.findIndex(t => t.id === previewTemplate.id)] || "Template")}`}
                sandbox="allow-same-origin allow-scripts"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

