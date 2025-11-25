"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MarkdownContent } from "@/components/results/markdown-content"
import { TemplateGrid } from "@/components/results/template-grid"
import { FileText, BarChart3, Code, BookOpen, User, Target, Calendar, Clock, Users, MapPin, DollarSign, Briefcase, Sparkles, AlertTriangle, Star, Eye, TrendingUp, Brain, Loader2, CheckCircle2, Download, Globe, DownloadCloud } from "lucide-react"
import JSZip from "jszip"
import { useState, useEffect, useMemo, memo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TemplatePreview } from "@/components/template-preview"
import { useToast } from "@/hooks/use-toast"
import { useTemplates } from "@/lib/hooks/use-templates"
import { extractContentFromSwipeResult, injectContentIntoTemplate } from "@/lib/utils/template-injection"
import { JobResult, SwipeResult, Listicle, Advertorial, Angle } from "@/lib/clients/deepcopy-client"
import { internalApiClient } from "@/lib/clients/internal-client"
import { Template } from "@/lib/db/types"
import { logger } from "@/lib/utils/logger"

interface DeepCopyResult extends JobResult {
  // This now matches the JobResult interface from the API client
}

interface DeepCopyResultsProps {
  result: {
    html_content: string
    metadata?: {
      deepcopy_job_id?: string
      project_name?: string
      timestamp_iso?: string
      full_result?: DeepCopyResult
      generated_at?: string
      word_count?: number
      template_used?: string
      generated_angles?: string[]
    }
  }
  jobTitle: string
  jobId?: string
  advertorialType?: string
  templateId?: string
  customerAvatars?: Array<{
    persona_name: string;
    description?: string;
    age_range?: string;
    gender?: string;
    key_buying_motivation?: string;
    pain_point?: string;
    emotion?: string;
    desire?: string;
    characteristics?: string[];
    objections?: string[];
    failed_alternatives?: string[];
    is_broad_avatar?: boolean;
  }>
  salesPageUrl?: string
}

// Type guard function to check if an object is an Angle
function isAngle(obj: any): obj is Angle {
  return typeof obj === 'object' && obj !== null && 'title' in obj && 'angle' in obj;
}

// Local type alias to ensure TypeScript recognizes all Angle properties
type AngleWithProperties = Angle & {
  target_age_range?: string;
  target_audience?: string;
  pain_points?: string[];
  desires?: string[];
  common_objections?: string[];
  failed_alternatives?: string[];
  copy_approach?: string[];
};

// Helper function to parse angle data (DRY: used in multiple places)
function parseAngle(angle: any): {
  angleObj: AngleWithProperties | null;
  angleTitle: string | null;
  angleDescription: string;
  angleString: string;
} {
  const angleObj: AngleWithProperties | null = isAngle(angle) ? (angle as AngleWithProperties) : null;
  return {
    angleObj,
    angleTitle: angleObj?.title ?? null,
    angleDescription: angleObj?.angle ?? (typeof angle === 'string' ? angle : ''),
    angleString: typeof angle === 'object' ? `${angle.title}: ${angle.angle}` : angle
  };
}

// Reusable component for angle list sections (DRY: used for pain_points, desires, objections, etc.)
function AngleListSection({
  title,
  items,
  className = "",
  listStyle = "bullet" // "bullet" or "disc"
}: {
  title: string;
  items?: string[];
  className?: string;
  listStyle?: "bullet" | "disc";
}) {
  if (!items || items.length === 0) return null;

  if (listStyle === "disc") {
    return (
      <div className={className}>
        <span className="font-medium">{title}:</span>
        <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={className}>
      <h6 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{title}</h6>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground flex items-start gap-2">
            <span className="text-primary mt-1.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Reusable component for angle status icon (DRY: used in multiple places)
function AngleStatusIcon({
  isGenerated,
  isGenerating
}: {
  isGenerated: boolean;
  isGenerating: boolean;
}) {
  if (isGenerated) {
    return (
      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (isGenerating) {
    return <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />;
  }
  return (
    <div className="bg-primary/10 rounded-full p-1.5 flex-shrink-0">
      <Target className="h-4 w-4 text-primary" />
    </div>
  );
}

// Helper function to get file type from templateId or advertorialType
function getFileType(templateId?: string, advertorialType?: string): string {
  // First try to determine from templateId (L = listicle, A = advertorial)
  if (templateId) {
    if (templateId.startsWith('L')) {
      return 'listicle';
    }
    if (templateId.startsWith('A')) {
      return 'advertorial';
    }
  }

  // Fallback to advertorialType prop
  if (advertorialType) {
    return advertorialType.toLowerCase();
  }

  // Default fallback
  return 'advertorial';
}

// Helper function to format file type for display
function formatFileType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Helper function to capitalize first letter of a string
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function DeepCopyResultsComponent({ result, jobTitle, jobId, advertorialType, templateId, customerAvatars, salesPageUrl }: DeepCopyResultsProps) {
  const [templates, setTemplates] = useState<Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string, templateId?: string }>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; html_content: string; description?: string; category?: string } | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)

  // Swipe file generation state - track multiple angles
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null)
  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined)
  const [generatedAngles, setGeneratedAngles] = useState<Set<string>>(new Set())
  const [generatingAngles, setGeneratingAngles] = useState<Map<string, string>>(new Map()) // angle -> jobId
  const [angleStatuses, setAngleStatuses] = useState<Map<string, string>>(new Map()) // angle -> status
  const [isGeneratingSwipeFiles, setIsGeneratingSwipeFiles] = useState(false)
  const [swipeFileResults, setSwipeFileResults] = useState<any>(null)

  // Template exploration state
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateModalStep, setTemplateModalStep] = useState<1 | 2>(1) // 1 = template selection, 2 = angle selection
  const [selectedTemplateForRefinement, setSelectedTemplateForRefinement] = useState<string[]>([])
  const [selectedAngleForRefinement, setSelectedAngleForRefinement] = useState<string | null>(null)
  const [openAngleItem, setOpenAngleItem] = useState<string | undefined>(undefined)
  const [isGeneratingRefined, setIsGeneratingRefined] = useState(false)
  const [selectedAngleFilter, setSelectedAngleFilter] = useState<string>("all")
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all")
  const [modalTypeFilter, setModalTypeFilter] = useState<string>("all")
  const [openMarketingAngle, setOpenMarketingAngle] = useState<string | undefined>(undefined)
  // Use TanStack Query for templates data
  const { data: availableTemplates = [], isLoading: availableTemplatesLoading } = useTemplates()
  const { toast } = useToast()

  const fullResult = result.metadata?.full_result
  const originalJobId = result.metadata?.deepcopy_job_id

  // Memoize HTML processing function for iframes
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
  }, []);

  // Memoize iframe HTML for each template
  const templateIframeHTML = useMemo(() => {
    return templates.reduce((acc, template) => {
      const key = `${template.name}-${template.angle || ''}`;
      acc[key] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
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
  }, [templates, createPreviewHTML]);

  // Helper functions for Map state updates (DRY: used multiple times)
  const updateGeneratingAngle = (angleString: string, jobId: string) => {
    setGeneratingAngles(prev => {
      const newMap = new Map(prev);
      newMap.set(angleString, jobId);
      return newMap;
    });
  };

  const removeGeneratingAngle = (angleString: string) => {
    setGeneratingAngles(prev => {
      const newMap = new Map(prev);
      newMap.delete(angleString);
      return newMap;
    });
  };

  const updateAngleStatus = (angleString: string, status: string) => {
    setAngleStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(angleString, status);
      return newMap;
    });
  };

  const removeAngleStatus = (angleString: string) => {
    setAngleStatuses(prev => {
      const newMap = new Map(prev);
      newMap.delete(angleString);
      return newMap;
    });
  };

  // Helper function to show error (DRY: used multiple times)
  const showError = (error: unknown, defaultMessage: string = 'An error occurred') => {
    const errorMessage = error instanceof Error ? error.message : defaultMessage;
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  };

  // Helper function to filter templates by angle (DRY: used in multiple places)
  const filterTemplatesByAngle = (
    templatesList: Array<{ name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string }>,
    angleFilter: string
  ) => {
    if (angleFilter === "all") return templatesList;

    return templatesList.filter((template: { name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string }) => {
      // Direct match
      if (template.angle === angleFilter) return true;

      // Handle "Title: Description" format - check if description part matches
      if (template.angle?.includes(': ')) {
        const parts = template.angle.split(': ');
        if (parts.length >= 2 && parts[1] === angleFilter) return true;
      }

      // Partial matches (for backwards compatibility)
      if (template.angle?.includes(angleFilter)) return true;
      if (angleFilter.includes(template.angle || '')) return true;

      return false;
    });
  };

  // Helper function to filter templates by type (advertorial/listical)
  const filterTemplatesByType = (
    templatesList: Array<{ name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string }>,
    typeFilter: string
  ) => {
    if (typeFilter === "all") return templatesList;

    return templatesList.filter((template) => {
      const fileType = getFileType(template.templateId, advertorialType);
      return fileType.toLowerCase() === typeFilter.toLowerCase();
    });
  };

  // Combined filter function for both angle and type
  const filterTemplates = (
    templatesList: Array<{ name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string }>,
    angleFilter: string,
    typeFilter: string
  ) => {
    let filtered = filterTemplatesByAngle(templatesList, angleFilter);
    filtered = filterTemplatesByType(filtered, typeFilter);
    return filtered;
  };

  // Load generated angles and templates from database on mount
  useEffect(() => {
    const loadData = async () => {
      if (jobId) {
        try {
          // Load generated angles from database
          try {
            const angles = await internalApiClient.getGeneratedAngles(jobId)
            setGeneratedAngles(new Set(angles))
          } catch (error) {
            logger.error('Failed to load generated angles:', error)
          }

          // Load templates from database
          try {
            const injectedTemplates = await internalApiClient.getInjectedTemplates(jobId) as any[]
            if (injectedTemplates && Array.isArray(injectedTemplates) && injectedTemplates.length > 0) {
              const templates = injectedTemplates.map((injected: any) => ({
                name: `${injected.template_id} - ${injected.angle_name}`,
                type: 'Marketing Angle',
                html: injected.html_content,
                angle: injected.angle_name,
                templateId: injected.template_id,
                timestamp: injected.created_at
              }))

              // Sort by angle name and template ID
              templates.sort((a: any, b: any) => {
                if (a.angle !== b.angle) {
                  return (a.angle || '').localeCompare(b.angle || '')
                }
                return (a.templateId || '').localeCompare(b.templateId || '')
              })

              setTemplates(templates)
            }
          } catch (error) {
            logger.error('Failed to load templates:', error)
          }
          // Always set loading to false after checking database
          setTemplatesLoading(false)
        } catch (error) {
          logger.error('Error loading data from database:', error)
          setTemplatesLoading(false)
        }
      } else {
        // If no jobId, still set loading to false
        setTemplatesLoading(false)
      }
    }
    loadData()
  }, [jobId])

  // Poll swipe file status for a specific angle
  const pollSwipeFileStatus = async (swipeFileJobId: string, angle: string) => {
    const maxAttempts = 60 // 5 minutes max (60 * 5s)
    const pollInterval = 5000 // Poll every 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const statusData = await internalApiClient.getSwipeFileStatus(swipeFileJobId) as { status: string }

        // Update status for this specific angle
        setAngleStatuses(prev => {
          const newMap = new Map(prev)
          newMap.set(angle, statusData.status)
          return newMap
        })

        if (statusData.status === 'SUCCEEDED') {
          // Fetch results
          const swipeFileResponse = await internalApiClient.getSwipeFileResult(swipeFileJobId)

          // Process swipe file response - inject into templates and store
          try {
            const processResult = await internalApiClient.processSwipeFile({
              jobId: jobId!, // Use the local job ID from props
              angle,
              swipeFileResponse
            }) as { processed: number }
            logger.log(`✅ Processed ${processResult.processed} templates for angle "${angle}"`)

            // Mark this angle as generated
            setGeneratedAngles(prev => {
              const newSet = new Set(prev).add(angle)
              return newSet
            })

            // Remove from generating map
            setGeneratingAngles(prev => {
              const newMap = new Map(prev)
              newMap.delete(angle)
              return newMap
            })

            // Reload templates and generated angles from database
            try {
              // Reload generated angles
              const angles = await internalApiClient.getGeneratedAngles(jobId!)
              setGeneratedAngles(new Set(angles))

              // Reload templates
              const injectedTemplates = await internalApiClient.getInjectedTemplates(jobId!) as any[]
              if (injectedTemplates && Array.isArray(injectedTemplates) && injectedTemplates.length > 0) {
                const templates = injectedTemplates.map((injected: any) => ({
                  name: `${injected.template_id} - ${injected.angle_name}`,
                  type: 'Injected Template',
                  html: injected.html_content,
                  angle: injected.angle_name,
                  templateId: injected.template_id,
                  timestamp: injected.created_at
                }))

                templates.sort((a: any, b: any) => {
                  if (a.angle !== b.angle) {
                    return (a.angle || '').localeCompare(b.angle || '')
                  }
                  return (a.templateId || '').localeCompare(b.templateId || '')
                })

                setTemplates(templates)
              }
            } catch (error) {
              logger.error('Error reloading templates:', error)
            }
            setTemplatesLoading(false)
          } catch (processError) {
            logger.error('Error processing swipe file response:', processError)
            // Still mark as generated to prevent retries, but show error
            setGeneratedAngles(prev => {
              const newSet = new Set(prev).add(angle)
              return newSet
            })
            setGeneratingAngles(prev => {
              const newMap = new Map(prev)
              newMap.delete(angle)
              return newMap
            })
            alert('Pre-landers generated but failed to process. Please try refreshing the page.')
          }
          return
        } else if ((statusData as { status: string }).status === 'FAILED') {
          // Remove from generating map on failure
          setGeneratingAngles(prev => {
            const newMap = new Map(prev)
            newMap.delete(angle)
            return newMap
          })
          throw new Error('Swipe file generation job failed')
        }
      } catch (err) {
        if (attempt === maxAttempts) {
          logger.error('Swipe file polling error:', err)
          // Remove from generating map on timeout
          setGeneratingAngles(prev => {
            const newMap = new Map(prev)
            newMap.delete(angle)
            return newMap
          })
          setAngleStatuses(prev => {
            const newMap = new Map(prev)
            newMap.set(angle, 'FAILED')
            return newMap
          })
        }
      }
    }

    // Remove from generating map on timeout
    setGeneratingAngles(prev => {
      const newMap = new Map(prev)
      newMap.delete(angle)
      return newMap
    })
    setAngleStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(angle, 'TIMEOUT')
      return newMap
    })
  }

  const extractHTMLTemplates = async () => {
    const templates: Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string, templateId?: string }> = []

    try {
      // Check if we have full result data with swipe_results
      if (fullResult && fullResult.results?.swipe_results) {
        const swipeResults = fullResult.results.swipe_results

        // Get injectable template for this specific template ID
        const templateType = advertorialType === 'listicle' ? 'listicle' : 'advertorial'

        try {
          let injectableTemplate = null

          if (templateId) {
            // Try to fetch the specific injectable template with the same ID
            const specificTemplates = await internalApiClient.getAdminInjectableTemplates({ id: templateId }) as any[]

            if (Array.isArray(specificTemplates) && specificTemplates.length > 0) {
              injectableTemplate = specificTemplates[0]
            }
          }

          // Fallback: fetch by type if specific template not found
          if (!injectableTemplate) {
            const injectableTemplates = await internalApiClient.getAdminInjectableTemplates({ type: templateType }) as any[]

            if (Array.isArray(injectableTemplates) && injectableTemplates.length > 0) {
              injectableTemplate = injectableTemplates[0]
            }
          }

          if (injectableTemplate) {
            // Process each swipe result
            swipeResults.forEach((swipeResult, index) => {
              try {
                // extractContentFromSwipeResult now handles both string and object formats
                // Pass the swipeResult as-is
                const contentData = extractContentFromSwipeResult(swipeResult, templateType)

                // Inject content into the injectable template
                const renderedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

                templates.push({
                  name: typeof swipeResult.angle === 'string' && swipeResult.angle.includes(':')
                    ? swipeResult.angle.split(':')[0].trim()
                    : `Angle ${index + 1}`,
                  type: 'Marketing Angle',
                  html: renderedHtml,
                  angle: swipeResult.angle,
                  templateId: injectableTemplate.id,
                  timestamp: result.metadata?.generated_at || new Date().toISOString()
                })
              } catch (error) {
                logger.error(`Error processing angle ${index + 1}:`, error)
              }
            })
          } else {
            // Fallback to old carousel method
            return await extractFromCarousel()
          }
        } catch (error) {
          logger.error('Error fetching injectable templates:', error)
          // Fallback to old carousel method
          return await extractFromCarousel()
        }

        return templates
      }

      // Fallback: Check if we have processed HTML content (carousel) from the old system
      if (result.html_content && result.html_content.includes('carousel-container')) {
        return await extractFromCarousel()
      }

      // If no data available, show empty state
      return templates

    } catch (error) {
      logger.error('Error in template extraction:', error)
      return templates
    }
  }

  const extractFromCarousel = async () => {
    const templates: Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }> = []

    try {
      // Extract individual angles and their HTML from the carousel
      const angleMatches = result.html_content.match(/<button class="nav-button[^>]*>([^<]+)<\/button>/g)
      const angles = angleMatches ? angleMatches.map(match =>
        match.replace(/<[^>]*>/g, '').trim()
      ) : ['Marketing Angle 1']

      // Try multiple approaches to extract template content
      let templateContent: string[] = []

      // Approach 1: Look for iframes with srcdoc
      const iframeMatches = result.html_content.match(/<iframe[^>]*srcdoc="([^"]*)"[^>]*><\/iframe>/g)

      if (iframeMatches && iframeMatches.length > 0) {
        templateContent = iframeMatches.map(iframeHtml => {
          const contentMatch = iframeHtml.match(/srcdoc="([^"]*)"/)
          if (contentMatch) {
            return contentMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
          }
          return ''
        }).filter(content => content.length > 0)
      }

      // Approach 2: Look for template-slide divs with content
      if (templateContent.length === 0) {
        const slideMatches = result.html_content.match(/<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)

        if (slideMatches && slideMatches.length > 0) {
          templateContent = slideMatches.map(slideHtml => {
            // Extract content from within the slide
            const contentMatch = slideHtml.match(/<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)
            return contentMatch ? contentMatch[1] : slideHtml
          })
        }
      }

      // Approach 3: Look for any div with template content
      if (templateContent.length === 0) {
        const divMatches = result.html_content.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/g)

        if (divMatches && divMatches.length > 0) {
          templateContent = divMatches.map(divHtml => {
            const contentMatch = divHtml.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/)
            return contentMatch ? contentMatch[1] : divHtml
          })
        }
      }

      // Create templates from extracted content
      if (templateContent.length > 0) {
        angles.forEach((angle, index) => {
          const content = templateContent[index] || templateContent[0] || result.html_content

          templates.push({
            name: `Angle ${index + 1}`,
            type: 'Marketing Angle',
            html: content,
            angle: angle,
            timestamp: result.metadata?.generated_at || new Date().toISOString()
          })
        })
      } else {
        // Fallback: create individual templates with the full carousel HTML
        angles.forEach((angle, index) => {
          templates.push({
            name: `Angle ${index + 1}`,
            type: 'Marketing Angle',
            html: result.html_content,
            angle: angle,
            timestamp: result.metadata?.generated_at || new Date().toISOString()
          })
        })
      }

      return templates
    } catch (error) {
      logger.error('Error in carousel extraction:', error)
      return templates
    }
  }

  // Load templates when result changes (fallback to old method if no database templates)
  // This runs after the initial database load to handle old jobs
  useEffect(() => {
    const loadTemplates = async () => {
      // Only load if we don't already have templates from database and templatesLoading is true
      if (templates.length === 0 && templatesLoading) {
        try {
          const extractedTemplates = await extractHTMLTemplates()
          if (extractedTemplates.length > 0) {
            setTemplates(extractedTemplates)
            setTemplatesLoading(false)
          } else {
            setTemplatesLoading(false)
          }
        } catch (error) {
          logger.error('Error loading templates:', error)
          setTemplatesLoading(false)
        }
      }
    }

    // Load templates as fallback if database doesn't have them (for old jobs)
    loadTemplates()
  }, [result, jobTitle, swipeFileResults, fullResult, templates.length, templatesLoading])

  // Handler for exploring templates
  const handleExploreTemplates = async () => {
    setShowTemplateModal(true)
    // Use the same store as /templates page
    // Templates are automatically fetched by useTemplates hook
  }

  // Handler for template selection
  const handleAngleToggle = (angleText: string) => {
    if (selectedAngleForRefinement === angleText) {
      setSelectedAngleForRefinement(null)
    } else {
      setSelectedAngleForRefinement(angleText)
    }
  }

  // Helper function to get angle title from angle string (DRY principle)
  // Handles both "Title: Description" format (from Avatar & Marketing) and plain description format (from Explore More)
  const getAngleTitle = (angleString: string | undefined, fallback: string = '') => {
    if (!angleString) return fallback;

    // Extract description part if angleString is in "Title: Description" format
    let angleDescription = angleString;
    let angleTitlePart = '';
    if (angleString.includes(': ')) {
      const parts = angleString.split(': ');
      if (parts.length >= 2) {
        angleTitlePart = parts[0];
        angleDescription = parts[1];
      }
    }

    // Try to find matching marketing angle by description (the actual angle text)
    const matchingAngle = fullResult?.results?.marketing_angles?.find((ma: any) => {
      if (typeof ma === 'string') {
        // Match against full string or description part
        return ma === angleString || ma === angleDescription;
      }
      // Match by angle description (the actual angle text)
      if (ma.angle === angleDescription || ma.angle === angleString) return true;
      // Also check if title matches (for backwards compatibility)
      if (ma.title === angleString || (angleTitlePart && ma.title === angleTitlePart)) return true;
      return false;
    });

    if (matchingAngle && typeof matchingAngle === 'object' && matchingAngle.title) {
      return matchingAngle.title;
    }

    // If no match found but we have a title part from "Title: Description" format, use it
    if (angleTitlePart) {
      return angleTitlePart;
    }

    return angleString;
  };

  // Helper function to get angle description from angle string
  // Handles both "Title: Description" format and plain description format
  const getAngleDescription = (angleString: string | undefined, fallback: string = '') => {
    if (!angleString) return fallback;

    // Extract description part if angleString is in "Title: Description" format
    let angleDescription = angleString;
    if (angleString.includes(': ')) {
      const parts = angleString.split(': ');
      if (parts.length >= 2) {
        angleDescription = parts[1];
      }
    }

    // Try to find matching marketing angle by description (the actual angle text)
    const matchingAngle = fullResult?.results?.marketing_angles?.find((ma: any) => {
      if (typeof ma === 'string') {
        return ma === angleString || ma === angleDescription;
      }
      // Match by angle description (the actual angle text)
      if (ma.angle === angleDescription || ma.angle === angleString) return true;
      return false;
    });

    if (matchingAngle && typeof matchingAngle === 'object' && matchingAngle.angle) {
      return matchingAngle.angle;
    }

    // Return the description part (or full string if not in "Title: Description" format)
    return angleDescription;
  };

  const handleDownloadAll = async () => {
    try {
      // Get filtered templates based on current filters (angle and type)
      const templatesToDownload = filterTemplates(templates, selectedAngleFilter, selectedTypeFilter);

      if (templatesToDownload.length === 0) {
        toast({
          title: "No templates to download",
          description: "There are no templates available to download.",
          variant: "destructive",
        });
        return;
      }

      // Create zip file
      const zip = new JSZip();

      // Add each template to the zip
      templatesToDownload.forEach((template, index) => {
        const angleTitle = getAngleTitle(template.angle, template.name);
        const sanitizedTitle = angleTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = template.templateId
          ? `${template.templateId}_${sanitizedTitle}.html`
          : `template_${index + 1}_${sanitizedTitle}.html`;

        zip.file(filename, template.html);
      });

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `templates_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${templatesToDownload.length} template${templatesToDownload.length !== 1 ? 's' : ''} as ZIP file.`,
      });
    } catch (error) {
      logger.error('Failed to download templates:', error);
      toast({
        title: "Download failed",
        description: "Failed to create ZIP file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    logger.log('Template selected:', templateId)
    setSelectedTemplateForRefinement(prev => {
      if (prev.includes(templateId)) {
        // Deselect if already selected
        return prev.filter(id => id !== templateId)
      } else {
        // Add to selection
        return [...prev, templateId]
      }
    })
  }

  // Handler for generating refined template
  const handleGenerateRefinedTemplate = async (templateIds: string[], angle: string) => {
    if (!originalJobId || !templateIds || templateIds.length === 0 || !angle) {
      toast({
        title: "Error",
        description: "Please select at least one template and an angle.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingRefined(true)
    try {
      // Call swipe-files/generate endpoint with original_job_id, select_angle, and swipe_file_ids array
      const data = await internalApiClient.generateSwipeFiles({
        original_job_id: originalJobId,
        select_angle: angle,
        swipe_file_ids: templateIds // Array of template IDs in format L00001, A00003, etc.
      }) as { jobId?: string }

      // Track this angle as generating (similar to the swipe file generation flow)
      if (data.jobId) {
        setGeneratingAngles(prev => {
          const newMap = new Map(prev)
          newMap.set(angle, data.jobId!)
          return newMap
        })
        setAngleStatuses(prev => {
          const newMap = new Map(prev)
          newMap.set(angle, 'SUBMITTED')
          return newMap
        })

        // Start polling for this specific angle
        pollSwipeFileStatus(data.jobId!, angle)
      }

      // Close modal and reset
      setShowTemplateModal(false)
      setSelectedTemplateForRefinement([])
      setSelectedAngleForRefinement(null)
      setTemplateModalStep(1)

      toast({
        title: "Success",
        description: `Swipe file generation started for ${templateIds.length} template${templateIds.length !== 1 ? 's' : ''}! Templates will appear when ready.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate pre-landers",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingRefined(false)
    }
  }

  const formatAnalysis = (analysis: string) => {
    const paragraphs = analysis.split('\n\n').filter(p => p.trim())
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="mb-4 leading-relaxed">
        {paragraph.trim()}
      </p>
    ))
  }

  return (
    <div className="space-y-8 min-h-full">
      {/* Offer Brief */}
      {fullResult?.results?.offer_brief && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="offer-brief">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Marketing Research</h2>
                        <p className="text-sm text-muted-foreground">Key elements of your marketing strategy</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    {(() => {
                      try {
                        // Parse offer_brief - it might be a string or already an object
                        const offerBrief = typeof fullResult.results.offer_brief === 'string'
                          ? JSON.parse(fullResult.results.offer_brief)
                          : fullResult.results.offer_brief;

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {offerBrief.potential_product_names && offerBrief.potential_product_names.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Potential Product Names
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {offerBrief.potential_product_names.map((name: string, idx: number) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.level_of_consciousness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-accent" />
                                    Level of Consciousness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">{offerBrief.level_of_consciousness}</p>
                                </div>
                              )}

                              {offerBrief.level_of_awareness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    Level of Awareness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">{offerBrief.level_of_awareness.replace(/_/g, ' ')}</p>
                                </div>
                              )}

                              {offerBrief.stage_of_sophistication && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-accent" />
                                    Stage of Sophistication
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {offerBrief.stage_of_sophistication.level?.replace(/_/g, ' ') || 'N/A'}
                                  </p>
                                  {offerBrief.stage_of_sophistication.rationale && (
                                    <p className="text-xs text-muted-foreground mt-1">{offerBrief.stage_of_sophistication.rationale}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              {offerBrief.big_idea && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Big Idea</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.big_idea}</p>
                                </div>
                              )}

                              {offerBrief.metaphors && offerBrief.metaphors.length > 0 && (
                                <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Metaphors</h4>
                                  <div className="space-y-1">
                                    {offerBrief.metaphors.map((metaphor: string, idx: number) => (
                                      <p key={idx} className="text-sm text-muted-foreground">"{metaphor}"</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(offerBrief.potential_ump || offerBrief.potential_ums) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {offerBrief.potential_ump && offerBrief.potential_ump.length > 0 && (
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Problem)</h4>
                                      <ul className="space-y-1">
                                        {offerBrief.potential_ump.map((ump: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-destructive mt-0.5">•</span>
                                            <span>{ump}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {offerBrief.potential_ums && offerBrief.potential_ums.length > 0 && (
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Solution)</h4>
                                      <ul className="space-y-1">
                                        {offerBrief.potential_ums.map((ums: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span>{ums}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {offerBrief.guru && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Guru / Discovery Story</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.guru}</p>
                                </div>
                              )}

                              {offerBrief.discovery_story && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Discovery Story</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.discovery_story}</p>
                                </div>
                              )}

                              {offerBrief.headline_ideas && offerBrief.headline_ideas.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Potential Headline/Subheadline Ideas</h4>
                                  <div className="space-y-2">
                                    {offerBrief.headline_ideas.map((headline: any, idx: number) => (
                                      <div key={idx} className="text-sm text-muted-foreground">
                                        {headline.headline && (
                                          <p className="mb-1"><strong>H1:</strong> "{headline.headline}"</p>
                                        )}
                                        {headline.subheadline && (
                                          <p><strong>H2:</strong> "{headline.subheadline}"</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.objections && offerBrief.objections.length > 0 && (
                                <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Key Objections</h4>
                                  <ul className="space-y-1">
                                    {offerBrief.objections.map((objection: string, idx: number) => (
                                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                        <span className="text-destructive">•</span>
                                        <span>{objection}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {offerBrief.belief_chains && offerBrief.belief_chains.length > 0 && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Belief Chains</h4>
                                  <div className="space-y-3">
                                    {offerBrief.belief_chains.map((chain: any, idx: number) => (
                                      <div key={idx} className="bg-background/50 p-3 rounded border border-primary/10">
                                        <p className="text-sm font-medium text-foreground mb-2">{chain.outcome}</p>
                                        <ul className="space-y-1">
                                          {chain.steps?.map((step: string, stepIdx: number) => (
                                            <li key={stepIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                                              <span className="text-primary mt-0.5">✓</span>
                                              <span>{step}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.funnel_architecture && offerBrief.funnel_architecture.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Funnel Architecture</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.funnel_architecture.join(' → ')}</p>
                                </div>
                              )}

                              {offerBrief.potential_domains && offerBrief.potential_domains.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Potential Domains</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {offerBrief.potential_domains.map((domain: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {domain}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.product && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Product Information</h4>
                                  {offerBrief.product.name && (
                                    <p className="text-sm text-muted-foreground mb-1"><strong>Name:</strong> {offerBrief.product.name}</p>
                                  )}
                                  {offerBrief.product.description && (
                                    <p className="text-sm text-muted-foreground mb-1"><strong>Description:</strong> {offerBrief.product.description}</p>
                                  )}
                                  {offerBrief.product.details && (
                                    <p className="text-sm text-muted-foreground"><strong>Details:</strong> {offerBrief.product.details}</p>
                                  )}
                                </div>
                              )}

                              {offerBrief.examples_swipes && offerBrief.examples_swipes.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Example Swipes</h4>
                                  <div className="space-y-2">
                                    {offerBrief.examples_swipes.map((swipe: any, idx: number) => (
                                      <div key={idx} className="text-sm text-muted-foreground">
                                        <p className="font-medium text-foreground">{swipe.title}</p>
                                        {swipe.url && (
                                          <a href={swipe.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                            {swipe.url}
                                          </a>
                                        )}
                                        {swipe.notes && (
                                          <p className="text-xs mt-1">{swipe.notes}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.other_notes && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Other Notes</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.other_notes}</p>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      } catch (error) {
                        // Fallback if parsing fails
                        return (
                          <div className="bg-muted rounded-lg p-4">
                            <pre className="text-sm whitespace-pre-wrap text-foreground">
                              {typeof fullResult.results.offer_brief === 'string'
                                ? fullResult.results.offer_brief
                                : JSON.stringify(fullResult.results.offer_brief, null, 2)}
                            </pre>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Avatar & Marketing */}
      {(fullResult?.results?.avatar_sheet || fullResult?.results?.marketing_angles) && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="avatar-marketing">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Avatars & Marketing Angles</h2>
                        <p className="text-sm text-muted-foreground">Customer avatar and marketing angles</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {fullResult?.results?.avatar_sheet && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold mb-4">
                            {customerAvatars?.[0]?.persona_name || 'Customer Avatar'}
                          </h4>
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                            {(() => {
                              try {
                                const avatarData = JSON.parse(fullResult.results.avatar_sheet)

                                // Build array of all available accordion items to open by default
                                const defaultOpenItems = ["demographics"]
                                if (avatarData.demographics?.professional_backgrounds) {
                                  defaultOpenItems.push("professional-background")
                                }
                                if (avatarData.demographics?.typical_identities) {
                                  defaultOpenItems.push("identities")
                                }
                                if (avatarData.pain_points) {
                                  defaultOpenItems.push("pain-points")
                                }
                                if (avatarData.goals) {
                                  defaultOpenItems.push("goals")
                                }

                                return (
                                  <Accordion type="multiple" className="w-full" defaultValue={defaultOpenItems}>
                                    {/* Demographics */}
                                    <AccordionItem value="demographics" className="border-none">
                                      <AccordionTrigger className="py-2 hover:no-underline">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-4 w-4 text-primary" />
                                          <span className="font-semibold text-foreground text-sm">Demographics</span>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-2">
                                        <div className="space-y-3">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                              <p className="text-muted-foreground text-xs">Age</p>
                                              <p className="font-medium text-foreground">{avatarData.demographics?.age_range || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">Gender</p>
                                              <p className="font-medium text-foreground">
                                                {avatarData.demographics?.gender?.map((g: string) => capitalizeFirst(g)).join(', ') || 'N/A'}
                                              </p>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground text-xs mb-1">Locations</p>
                                            <div className="flex flex-wrap gap-1">
                                              {avatarData.demographics?.locations?.map((location: string, index: number) => (
                                                <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                                                  {location}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>

                                    {/* Professional Background */}
                                    {avatarData.demographics?.professional_backgrounds && (
                                      <AccordionItem value="professional-background" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-accent" />
                                            <span className="font-semibold text-foreground text-sm">Professional Background</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="flex flex-wrap gap-1">
                                            {avatarData.demographics.professional_backgrounds.map((bg: string, index: number) => (
                                              <Badge key={index} variant="outline" className="text-sm px-2 py-0.5">
                                                {bg}
                                              </Badge>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Identities */}
                                    {avatarData.demographics?.typical_identities && (
                                      <AccordionItem value="identities" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-accent" />
                                            <span className="font-semibold text-foreground text-sm">Identities</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="flex flex-wrap gap-1">
                                            {avatarData.demographics.typical_identities.map((identity: string, index: number) => (
                                              <Badge key={index} variant="secondary" className="text-sm px-2 py-0.5">
                                                {identity}
                                              </Badge>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Pain Points */}
                                    {avatarData.pain_points && (
                                      <AccordionItem value="pain-points" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                            <span className="font-semibold text-foreground text-sm">Pain Points</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="space-y-2">
                                            {avatarData.pain_points.slice(0, 3).map((painPoint: any, index: number) => (
                                              <div key={index} className="bg-destructive/5 border border-destructive/20 p-2 rounded-lg">
                                                <h6 className="font-medium text-foreground text-sm mb-1">{painPoint.title}</h6>
                                                <ul className="space-y-0.5">
                                                  {painPoint.bullets?.slice(0, 2).map((bullet: string, bulletIndex: number) => (
                                                    <li key={bulletIndex} className="text-sm text-muted-foreground flex items-start gap-1">
                                                      <span className="text-destructive mt-0.5">•</span>
                                                      <span className="break-words">{bullet}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Goals */}
                                    {avatarData.goals && (
                                      <AccordionItem value="goals" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-foreground text-sm">Goals</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="grid grid-cols-1 gap-2">
                                            <div>
                                              <h6 className="font-medium text-foreground text-sm mb-1">Short Term</h6>
                                              <ul className="space-y-0.5">
                                                {avatarData.goals.short_term?.slice(0, 2).map((goal: string, index: number) => (
                                                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                                    <span className="text-primary mt-0.5">✓</span>
                                                    <span className="break-words">{goal}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                            <div>
                                              <h6 className="font-medium text-foreground text-sm mb-1">Long Term</h6>
                                              <ul className="space-y-0.5">
                                                {avatarData.goals.long_term?.slice(0, 2).map((goal: string, index: number) => (
                                                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                                    <span className="text-primary mt-0.5">✓</span>
                                                    <span className="break-words">{goal}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}
                                  </Accordion>
                                )
                              } catch (error) {
                                return (
                                  <div className="bg-muted rounded-lg p-4">
                                    <pre className="text-sm whitespace-pre-wrap text-foreground">
                                      {fullResult.results.avatar_sheet}
                                    </pre>
                                  </div>
                                )
                              }
                            })()}
                          </div>
                        </div>
                      )}
                      {fullResult?.results?.marketing_angles && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold mb-4">Marketing Angles</h4>
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full space-y-3"
                            value={openMarketingAngle}
                            onValueChange={setOpenMarketingAngle}
                          >
                            {fullResult.results.marketing_angles.map((angle, index) => {
                              const { angleObj, angleTitle, angleDescription, angleString } = parseAngle(angle);
                              const isGenerated = generatedAngles.has(angleString);
                              const isGenerating = generatingAngles.has(angleString);
                              const status = angleStatuses.get(angleString);
                              const itemValue = `angle-${index}`;
                              const isOpen = openMarketingAngle === itemValue;

                              return (
                                <AccordionItem
                                  key={index}
                                  value={itemValue}
                                  className="border-none"
                                >
                                  <Card className={`p-0 transition-all hover:shadow-md cursor-pointer ${isGenerated
                                    ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
                                    : 'border border-border hover:border-primary/50'
                                    }`}>
                                    <div
                                      className="p-4"
                                      onClick={() => {
                                        setOpenMarketingAngle(isOpen ? undefined : itemValue);
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                          <AngleStatusIcon isGenerated={isGenerated} isGenerating={isGenerating} />
                                          <div className="flex-1">
                                            {angleTitle && (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border">
                                                  #{index + 1}
                                                </Badge>
                                                <h3 className="text-base font-semibold text-foreground">{angleTitle}</h3>
                                              </div>
                                            )}
                                            <p className="text-sm text-muted-foreground mt-1">{angleDescription}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isGenerated && (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                              Generated
                                            </Badge>
                                          )}
                                          {isGenerating && status && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                              {status}
                                            </Badge>
                                          )}
                                          <AccordionTrigger className="pointer-events-none" />
                                        </div>
                                      </div>
                                    </div>
                                    <AccordionContent className="px-4 pb-4">
                                      {angleObj && (
                                        <div className="space-y-4">
                                          {angleObj?.target_age_range && (
                                            <div>
                                              <h6 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Target Age Range</h6>
                                              <p className="text-sm text-foreground">{angleObj.target_age_range}</p>
                                            </div>
                                          )}
                                          {angleObj?.target_audience && (
                                            <div>
                                              <h6 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Target Audience</h6>
                                              <p className="text-sm text-foreground">{angleObj.target_audience}</p>
                                            </div>
                                          )}
                                          <AngleListSection title="Pain Points" items={angleObj?.pain_points} />
                                          <AngleListSection title="Desires" items={angleObj?.desires} />
                                          <AngleListSection title="Common Objections" items={angleObj?.common_objections} />
                                          <AngleListSection title="Failed Alternatives" items={angleObj?.failed_alternatives} />
                                          <AngleListSection title="Copy Approach" items={angleObj?.copy_approach} />
                                        </div>
                                      )}
                                      <div className="flex justify-end pt-4 border-t border-border/50 mt-4">
                                        <Button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!originalJobId || isGenerated || isGenerating) return;

                                            // Add to generating map
                                            updateGeneratingAngle(angleString, 'pending');
                                            updateAngleStatus(angleString, 'SUBMITTED');

                                            try {
                                              const data = await internalApiClient.generateSwipeFiles({
                                                original_job_id: originalJobId,
                                                select_angle: angleString
                                              }) as { jobId?: string };

                                              // Track this angle as generating
                                              if (data.jobId) {
                                                updateGeneratingAngle(angleString, data.jobId);
                                                // Start polling for this specific angle
                                                pollSwipeFileStatus(data.jobId, angleString);
                                              }
                                            } catch (error) {
                                              logger.error('Error generating pre-landers:', error);
                                              // Remove from generating map on error
                                              removeGeneratingAngle(angleString);
                                              removeAngleStatus(angleString);

                                              // Show user-friendly error message
                                              showError(error, 'Failed to generate pre-landers. Please try again.');
                                            }
                                          }}
                                          disabled={!originalJobId || isGenerated || isGenerating}
                                          size="sm"
                                        >
                                          {isGenerating ? (
                                            <>
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                              Generating...
                                            </>
                                          ) : isGenerated ? (
                                            <>
                                              <CheckCircle2 className="w-4 h-4 mr-2" />
                                              Generated
                                            </>
                                          ) : (
                                            'Generate Pre-Landers'
                                          )}
                                        </Button>
                                      </div>
                                    </AccordionContent>
                                  </Card>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Angle Selection & Swipe File Generation */}
      {/* Always show if we have marketing_angles */}
      {/*fullResult?.results?.marketing_angles &&
        fullResult.results.marketing_angles.length > 0 && (
          <div className="mb-12">
            <Accordion type="single" collapsible>
              <AccordionItem value="marketing-angle-selection">
                <Card className="bg-card/80 border-border/50">
                  <AccordionTrigger className="p-8 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Select Marketing Angle</h2>
                          <p className="text-sm text-muted-foreground">Choose an angle to generate pre-landers</p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="px-8 pb-8 space-y-3 border-t border-border/50 pt-6">
                      <Accordion
                        type="single"
                        collapsible
                        className="w-full space-y-3"
                        value={accordionValue}
                        onValueChange={setAccordionValue}
                      >
                        {fullResult.results.marketing_angles.map((angle, index) => {
                          const { angleObj, angleTitle, angleDescription, angleString } = parseAngle(angle);
                          const isGenerated = generatedAngles.has(angleString);
                          const isGenerating = generatingAngles.has(angleString);
                          const status = angleStatuses.get(angleString);
                          const isSelected = selectedAngle === angleString;
                          const itemValue = `select-angle-${index}`;

                          return (
                            <AccordionItem
                              key={index}
                              value={itemValue}
                              className="border-none"
                            >
                              <Card
                                className={`cursor-pointer transition-all hover:shadow-md ${isGenerated
                                  ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
                                  : isSelected
                                    ? 'border-2 border-primary bg-primary/10'
                                    : 'border border-border hover:border-primary/50'
                                  }`}
                                onClick={() => {
                                  // Select the angle when clicking anywhere on the card
                                  if (!isGenerated && !isGenerating) {
                                    if (selectedAngle === angleString) {
                                      setSelectedAngle(null);
                                    } else {
                                      setSelectedAngle(angleString);
                                    }
                                    // Toggle accordion open/close (same as avatar accordion)
                                    setAccordionValue(prev => (prev === itemValue ? undefined : itemValue));
                                  }
                                }}
                              >
                                <div className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      {isSelected && !isGenerated && !isGenerating ? (
                                        <div className="bg-primary/20 rounded-full p-1.5 flex-shrink-0">
                                          <Target className="h-4 w-4 text-primary" />
                                        </div>
                                      ) : (
                                        <AngleStatusIcon isGenerated={isGenerated} isGenerating={isGenerating} />
                                      )}
                                      <div className="flex-1">
                                        {angleTitle && (
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border">
                                              #{index + 1}
                                            </Badge>
                                            <h3 className="text-base font-semibold text-foreground">{angleTitle}</h3>
                                          </div>
                                        )}
                                        <p className="text-sm text-muted-foreground mt-1">{angleDescription}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isGenerated && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                          Generated
                                        </Badge>
                                      )}
                                      {isGenerating && status && (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                          {status}
                                        </Badge>
                                      )}
                                      {isSelected && !isGenerated && (
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                      )}
                                      <AccordionTrigger />
                                    </div>
                                  </div>
                                </div>
                                <AccordionContent className="px-4 pb-4">
                                  {angleObj && (
                                    <div className="space-y-3 text-sm">
                                      {angleObj?.target_age_range && (
                                        <div>
                                          <span className="font-medium">Target Age Range:</span>
                                          <p className="text-muted-foreground">{angleObj.target_age_range}</p>
                                        </div>
                                      )}
                                      {angleObj?.target_audience && (
                                        <div>
                                          <span className="font-medium">Target Audience:</span>
                                          <p className="text-muted-foreground">{angleObj.target_audience}</p>
                                        </div>
                                      )}
                                      <AngleListSection title="Pain Points" items={angleObj?.pain_points} listStyle="disc" />
                                      <AngleListSection title="Desires" items={angleObj?.desires} listStyle="disc" />
                                      <AngleListSection title="Common Objections" items={angleObj?.common_objections} listStyle="disc" className="pt-2 border-t border-border" />
                                      <AngleListSection title="Failed Alternatives" items={angleObj?.failed_alternatives} listStyle="disc" className="pt-2 border-t border-border" />
                                      <AngleListSection title="Copy Approach" items={angleObj?.copy_approach} listStyle="disc" className="pt-2 border-t border-border" />
                                    </div>
                                  )}
                                </AccordionContent>
                              </Card>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>

                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={async () => {
                            if (!selectedAngle || !originalJobId || generatedAngles.has(selectedAngle) || generatingAngles.has(selectedAngle)) return;

                            // Add to generating map
                            setIsGeneratingSwipeFiles(true);
                            try {
                              const data = await internalApiClient.generateSwipeFiles({
                                original_job_id: originalJobId,
                                select_angle: selectedAngle
                              }) as { jobId?: string };

                              // Track this angle as generating
                              if (data.jobId) {
                                setGeneratingAngles(prev => {
                                  const newMap = new Map(prev)
                                  newMap.set(selectedAngle, data.jobId!)
                                  return newMap
                                })
                              }
                              setAngleStatuses(prev => {
                                const newMap = new Map(prev)
                                newMap.set(selectedAngle, 'SUBMITTED')
                                return newMap
                              })

                              // Start polling for this specific angle
                              pollSwipeFileStatus(data.jobId, selectedAngle);

                              // Clear selection
                              setSelectedAngle(null);
                            } catch (error) {
                              console.error('Error generating pre-landers:', error);
                              // Remove from generating map on error
                              setGeneratingAngles(prev => {
                                const newMap = new Map(prev)
                                newMap.delete(selectedAngle)
                                return newMap
                              })

                              // Show user-friendly error message
                              showError(error, 'Failed to generate pre-landers. Please try again.');
                            } finally {
                              setIsGeneratingSwipeFiles(false);
                            }
                          }}
                          disabled={!selectedAngle || isGeneratingSwipeFiles || generatedAngles.has(selectedAngle || '') || generatingAngles.has(selectedAngle || '')}
                          className="px-8"
                        >
                          {isGeneratingSwipeFiles ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            'Generate Pre-Landers'
                          )}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>
          </div>
        )*/}

      {/* Generated Prelanders */}
      <div className="mb-12">
        <Accordion type="single" collapsible>
          <AccordionItem value="html-templates">
            <Card className="bg-card/80 border-border/50">
              <AccordionTrigger className="p-8 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Generated Prelanders</h2>
                      <p className="text-sm text-muted-foreground">Generated marketing templates and angles</p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-8 pb-8 border-t border-border/50 pt-6">
                  {templates.length === 0 && generatingAngles.size === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        No templates generated yet. Select a marketing angle above to generate templates.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {generatingAngles.size > 0 && (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">
                            Generating templates for {generatingAngles.size} angle{generatingAngles.size > 1 ? 's' : ''}...
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">Generated Prelanders</h3>
                          <p className="text-sm text-muted-foreground">
                            {(() => {
                              const filteredCount = filterTemplates(templates, selectedAngleFilter, selectedTypeFilter).length;

                              if (templates.length === 0) {
                                return 'No templates generated yet';
                              }

                              const parts: string[] = [];
                              if (selectedAngleFilter !== "all") {
                                // Get the title for the selected angle
                                const selectedAngle = fullResult?.results?.marketing_angles?.find((ma: any) => {
                                  if (typeof ma === 'string') return ma === selectedAngleFilter;
                                  return ma.angle === selectedAngleFilter;
                                });
                                const angleTitle = selectedAngle && typeof selectedAngle === 'object'
                                  ? selectedAngle.title
                                  : selectedAngleFilter;
                                parts.push(angleTitle);
                              }
                              if (selectedTypeFilter !== "all") {
                                parts.push(formatFileType(selectedTypeFilter));
                              }

                              if (parts.length > 0) {
                                return `${filteredCount} of ${templates.length} template${templates.length !== 1 ? 's' : ''} (${parts.join(', ')})`;
                              }
                              return `${templates.length} template${templates.length !== 1 ? 's' : ''} generated`;
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Type Filter */}
                          {templates.length > 0 && (
                            <div className="w-[180px] min-w-0 max-w-[180px]">
                              <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                                <SelectTrigger
                                  className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(180px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0"
                                >
                                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  <SelectItem value="advertorial">Advertorial</SelectItem>
                                  <SelectItem value="listicle">Listical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {/* Angle Filter */}
                          {templates.length > 0 && (() => {
                            // Only use angles from the API response (marketing_angles)
                            // Don't create new entries from templates - only show original marketing angles
                            const angleMap = new Map<string, { title: string; description: string }>();

                            // Only add marketing angles from the API response
                            fullResult?.results?.marketing_angles?.forEach((angle: any) => {
                              if (typeof angle === 'object' && angle.title && angle.angle) {
                                // Use angle.angle (description) as the key for consistency
                                angleMap.set(angle.angle, { title: angle.title, description: angle.angle });
                              } else if (typeof angle === 'string') {
                                // Handle string format marketing angles
                                angleMap.set(angle, { title: angle, description: angle });
                              }
                            });

                            const angleEntries = Array.from(angleMap.entries());

                            if (angleEntries.length > 0) {
                              return (
                                <div className="w-[220px] min-w-0 max-w-[220px]">
                                  <Select value={selectedAngleFilter} onValueChange={setSelectedAngleFilter}>
                                    <SelectTrigger
                                      className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(220px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0"
                                    >
                                      <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <SelectValue placeholder="Filter by angle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Angles</SelectItem>
                                      {angleEntries.map(([description, { title }]) => {
                                        // Truncate title if too long for display
                                        const displayTitle = title.length > 35 ? title.substring(0, 32) + '...' : title;
                                        return (
                                          <SelectItem key={description} value={description}>
                                            {displayTitle}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {templates.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadAll}
                              disabled={templates.length === 0}
                            >
                              <DownloadCloud className="h-4 w-4 mr-2" />
                              Download All
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Existing templates */}
                        {(() => {
                          // Filter templates by selected angle and type
                          let filteredTemplates = filterTemplates(templates, selectedAngleFilter, selectedTypeFilter);

                          // Sort templates by angle index to group same angles together and maintain order
                          filteredTemplates = [...filteredTemplates].sort((a, b) => {
                            // Helper to find angle index in marketing_angles array
                            const getAngleIndex = (templateAngle: string | undefined): number => {
                              if (!templateAngle || !fullResult?.results?.marketing_angles) return 999;

                              return fullResult.results.marketing_angles.findIndex((ma: any) => {
                                if (typeof ma === 'string') {
                                  return ma === templateAngle;
                                }
                                // Extract description from template.angle if it's in "Title: Description" format
                                let templateAngleDesc = templateAngle;
                                if (templateAngle.includes(': ')) {
                                  const parts = templateAngle.split(': ');
                                  if (parts.length >= 2) {
                                    templateAngleDesc = parts[1];
                                  }
                                }
                                return ma.angle === templateAngleDesc || ma.angle === templateAngle;
                              });
                            };

                            const indexA = getAngleIndex(a.angle);
                            const indexB = getAngleIndex(b.angle);

                            // First sort by angle index (to maintain #1, #2, #3 order)
                            if (indexA !== indexB) {
                              // If not found, put at end (999)
                              if (indexA === -1) return 1;
                              if (indexB === -1) return -1;
                              return indexA - indexB;
                            }

                            // If same angle index, sort by templateId for consistency
                            const idA = a.templateId || '';
                            const idB = b.templateId || '';
                            return idA.localeCompare(idB);
                          });

                          if (filteredTemplates.length === 0) {
                            return (
                              <div className="col-span-full text-center py-12">
                                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                  {selectedAngleFilter !== "all" || selectedTypeFilter !== "all"
                                    ? "No templates found for the selected filters."
                                    : "No templates found for the selected angle."}
                                </p>
                              </div>
                            );
                          }

                          return filteredTemplates.map((template, index) => (
                            <Card key={`template-${index}`} className="group p-0 overflow-hidden transition-all duration-200 flex flex-col h-full border-border/50 hover:border-primary/50">
                              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                                {/* Preview Section */}
                                <div className="relative h-48 bg-background overflow-hidden border-b border-border/50">
                                  <div className="absolute inset-0 overflow-hidden">
                                    <iframe
                                      key={`preview-${template.name}-${template.angle || ''}-${index}`}
                                      srcDoc={templateIframeHTML[`${template.name}-${template.angle || ''}`]}
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
                                      title={`Preview of ${getAngleTitle(template.angle, template.name)}`}
                                    />
                                  </div>
                                </div>

                                {/* Content Section */}
                                <div className="p-5 flex flex-col flex-1 min-h-0">
                                  <div className="flex-1">
                                    {(() => {
                                      // Find the matching marketing angle to get its index
                                      let angleIndex = -1;
                                      const templateAngle = template.angle;
                                      if (fullResult?.results?.marketing_angles && templateAngle) {
                                        const matchingIndex = fullResult.results.marketing_angles.findIndex((ma: any) => {
                                          if (typeof ma === 'string') {
                                            return ma === templateAngle;
                                          }
                                          // Extract description from template.angle if it's in "Title: Description" format
                                          let templateAngleDesc = templateAngle;
                                          if (templateAngle.includes(': ')) {
                                            const parts = templateAngle.split(': ');
                                            if (parts.length >= 2) {
                                              templateAngleDesc = parts[1];
                                            }
                                          }
                                          return ma.angle === templateAngleDesc || ma.angle === templateAngle;
                                        });
                                        if (matchingIndex >= 0) {
                                          angleIndex = matchingIndex;
                                        }
                                      }

                                      const fileType = getFileType(template.templateId, advertorialType);

                                      return (
                                        <div className="space-y-2">
                                          {/* Number Badge and File Type */}
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {/*angleIndex >= 0 && (
                                              <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border w-fit">
                                                #{angleIndex + 1}
                                              </Badge>
                                            )*/}
                                            <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20 w-fit">
                                              {formatFileType(fileType)}
                                            </Badge>
                                          </div>
                                          {/* Title with Icon */}
                                          <div className="flex items-center gap-2">
                                            {/*angleIndex >= 0 && (
                                              <div className="bg-primary/10 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                                                <Target className="h-4 w-4 text-primary" />
                                              </div>
                                            )*/}
                                            {angleIndex >= 0 && (
                                              <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border w-fit">
                                                #{angleIndex + 1}
                                              </Badge>
                                            )}
                                            <h4 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors flex-1">
                                              {getAngleTitle(template.angle, template.name)}
                                            </h4>
                                          </div>
                                          {/* Description */}
                                          {template.angle && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                              {getAngleDescription(template.angle)}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const blob = new Blob([template.html], { type: 'text/html' })
                                        const url = URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                        URL.revokeObjectURL(url)
                                      }}
                                      className="flex-1"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </Button>
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
                                            {getAngleTitle(template.angle, template.name)}
                                          </DialogTitle>
                                          <DialogDescription>
                                            {template.timestamp ? new Date(template.timestamp).toLocaleString() : 'Generated'}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="h-[calc(98vh-120px)] border rounded-lg bg-background overflow-auto">
                                          <iframe
                                            srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${(() => {
                                                const raw = template.html;
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
                                              })()}
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
</html>`}
                                            className="w-full h-full"
                                            sandbox="allow-scripts"
                                            style={{
                                              border: 'none',
                                              width: '100%',
                                              height: '100%'
                                            }}
                                          />
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        })()}
                        {/* Skeleton loaders for generating angles */}
                        {Array.from({ length: generatingAngles.size }).map((_, i) => (
                          <div key={`skeleton-${i}`} className="border border-border rounded-lg p-6 bg-card">
                            <div className="h-6 w-3/4 bg-muted animate-pulse rounded-md mb-3" />
                            <div className="h-4 w-full bg-muted animate-pulse rounded-md mb-2" />
                            <div className="h-4 w-2/3 bg-muted animate-pulse rounded-md mb-4" />
                            <div className="h-48 w-full bg-muted animate-pulse rounded-md" />
                          </div>
                        ))}
                      </div>
                      {/* Explore More Templates Button */}
                      <div className="mt-8">
                        <Button
                          onClick={handleExploreTemplates}
                          disabled={availableTemplatesLoading}
                          size="lg"
                          className="w-full"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Explore More Templates
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Template Preview Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="w-[95vw] max-h-[95vh] overflow-hidden !max-w-none sm:!max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              Template: {selectedTemplate?.name || 'Template Preview'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || 'Preview of the template used for this content'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border-t bg-white dark:bg-gray-900 mt-4">
            {selectedTemplate && (
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
      padding: 10px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #333;
      background: #fff;
    }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    .container { max-width: 95vw; margin: 0 auto; }
  </style>
</head>
<body>
  ${selectedTemplate.html_content}
</body>
</html>`}
                className="w-full h-[70vh] border rounded-lg"
                title={`Preview of ${selectedTemplate.name}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Selection Modal for Refined Generation */}
      <Dialog open={showTemplateModal} onOpenChange={(open) => {
        setShowTemplateModal(open)
        if (!open) {
          // Reset state when modal closes
          setSelectedTemplateForRefinement([])
          setSelectedAngleForRefinement(null)
          setTemplateModalStep(1)
          setModalTypeFilter("all")
        }
      }}>
        <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <DialogTitle>
                  {templateModalStep === 1 ? 'Step 1: Select a Template' : 'Step 2: Select Marketing Angle'}
                </DialogTitle>
                <DialogDescription>
                  {templateModalStep === 1
                    ? 'Choose a template to generate a refined prelander'
                    : 'Choose a marketing angle for your selected template'}
                </DialogDescription>
              </div>
              {templateModalStep === 1 && availableTemplates.length > 0 && (
                <div className="w-[180px] min-w-0 max-w-[180px] flex-shrink-0">
                  <Select value={modalTypeFilter} onValueChange={setModalTypeFilter}>
                    <SelectTrigger
                      className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(180px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0"
                    >
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="advertorial">Advertorial</SelectItem>
                      <SelectItem value="listicle">Listical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DialogHeader>

          {availableTemplatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templateModalStep === 1 ? (
            // Step 1: Template Selection
            availableTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No templates available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Template Grid */}
                <div className="space-y-4">
                  {(() => {
                    // Filter templates by type
                    const filteredTemplates = modalTypeFilter === "all"
                      ? availableTemplates
                      : availableTemplates.filter((template: Template) => {
                        const templateType = template.category?.toLowerCase() === 'listicle' ? 'listicle' : 'advertorial';
                        return templateType === modalTypeFilter.toLowerCase();
                      });

                    return (
                      <>
                        {selectedTemplateForRefinement.length > 0 && (
                          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-sm font-medium text-foreground mb-1">
                              {selectedTemplateForRefinement.length} template{selectedTemplateForRefinement.length !== 1 ? 's' : ''} selected
                              {modalTypeFilter !== "all" && (
                                <span className="text-muted-foreground">
                                  {' '}({filteredTemplates.length} {formatFileType(modalTypeFilter)} template{filteredTemplates.length !== 1 ? 's' : ''} available)
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedTemplateForRefinement.map((templateId: string) => {
                                const template = availableTemplates.find((t: Template) => t.id === templateId)
                                return (
                                  <Badge key={templateId} variant="secondary" className="text-xs">
                                    {template?.name || templateId}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {modalTypeFilter !== "all" && (
                          <div className="text-sm text-muted-foreground">
                            Showing {filteredTemplates.length} of {availableTemplates.length} template{availableTemplates.length !== 1 ? 's' : ''} ({formatFileType(modalTypeFilter)})
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {filteredTemplates.length === 0 ? (
                            <div className="col-span-full text-center py-12">
                              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground">
                                No templates found for the selected type.
                              </p>
                            </div>
                          ) : (
                            filteredTemplates.map((template: Template) => (
                              <TemplatePreview
                                key={template.id}
                                template={template}
                                isSelected={selectedTemplateForRefinement.includes(template.id)}
                                onClick={() => handleTemplateSelect(template.id)}
                              />
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                  {selectedTemplateForRefinement.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => setTemplateModalStep(2)}
                        disabled={selectedTemplateForRefinement.length === 0}
                      >
                        Continue with {selectedTemplateForRefinement.length} template{selectedTemplateForRefinement.length !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            // Step 2: Angle Selection
            <div className="space-y-6">
              {/* Show selected templates info */}
              {selectedTemplateForRefinement.length > 0 && (
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Selected Templates ({selectedTemplateForRefinement.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplateForRefinement.map((templateId: string) => {
                      const template = availableTemplates.find((t: Template) => t.id === templateId)
                      return (
                        <Badge key={templateId} variant="secondary" className="text-sm">
                          {template?.name || templateId}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Marketing Angles in Accordion Format */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Select Marketing Angle</h3>
                  <p className="text-sm text-muted-foreground">Choose a marketing angle to generate your refined template</p>
                </div>

                {fullResult?.results?.marketing_angles && fullResult.results.marketing_angles.length > 0 ? (
                  <Accordion
                    type="single"
                    collapsible
                    className="w-full space-y-3"
                    value={openAngleItem}
                    onValueChange={setOpenAngleItem}
                  >
                    {fullResult.results.marketing_angles.map((angle: any, index: number) => {
                      const { angleObj, angleTitle, angleDescription } = parseAngle(angle);
                      // Always prioritize the angle property for matching, not the title
                      const angleText = typeof angle === 'string' ? angle : (angle.angle || angleDescription);
                      const isSelected = selectedAngleForRefinement === angleText;
                      const itemValue = `angle-${index}`;

                      return (
                        <AccordionItem
                          key={index}
                          value={itemValue}
                          className="border-none"
                        >
                          <Card
                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                              ? 'border-2 border-primary bg-primary/10'
                              : 'border border-border hover:border-primary/50'
                              }`}
                            onClick={() => {
                              handleAngleToggle(angleText);
                              setOpenAngleItem(prev => (prev === itemValue ? undefined : itemValue));
                            }}
                          >
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className={`bg-primary/10 rounded-full p-1.5 flex-shrink-0 ${isSelected ? 'bg-primary/20' : ''}`}>
                                    <Target className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    {angleTitle && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border">
                                          #{index + 1}
                                        </Badge>
                                        <h5 className="text-sm font-bold text-foreground">{angleTitle}</h5>
                                      </div>
                                    )}
                                    <p className="text-sm text-foreground font-medium leading-relaxed break-words mt-1">{angleDescription}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isSelected && (
                                    <CheckCircle2 className="w-5 h-5 text-primary" />
                                  )}
                                  <AccordionTrigger />
                                </div>
                              </div>
                            </div>
                            <AccordionContent className="px-4 pb-4">
                              {angleObj && (
                                <div className="space-y-3 text-sm">
                                  {angleObj?.target_age_range && (
                                    <div>
                                      <span className="font-medium">Target Age Range:</span>
                                      <p className="text-muted-foreground">{angleObj.target_age_range}</p>
                                    </div>
                                  )}
                                  {angleObj?.target_audience && (
                                    <div>
                                      <span className="font-medium">Target Audience:</span>
                                      <p className="text-muted-foreground">{angleObj.target_audience}</p>
                                    </div>
                                  )}
                                  {angleObj?.pain_points && angleObj.pain_points.length > 0 && (
                                    <div>
                                      <span className="font-medium">Pain Points:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {(angleObj.pain_points || []).map((point: string, idx: number) => (
                                          <li key={idx}>{point}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {angleObj?.desires && angleObj.desires.length > 0 && (
                                    <div>
                                      <span className="font-medium">Desires:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {(angleObj.desires || []).map((desire: string, idx: number) => (
                                          <li key={idx}>{desire}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {angleObj?.common_objections && angleObj.common_objections.length > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Common Objections:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {(angleObj.common_objections || []).map((objection: string, idx: number) => (
                                          <li key={idx}>{objection}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {angleObj?.failed_alternatives && angleObj.failed_alternatives.length > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Failed Alternatives:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {(angleObj.failed_alternatives || []).map((alternative: string, idx: number) => (
                                          <li key={idx}>{alternative}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {angleObj?.copy_approach && angleObj.copy_approach.length > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <span className="font-medium">Copy Approach:</span>
                                      <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                        {(angleObj.copy_approach || []).map((approach: string, idx: number) => (
                                          <li key={idx}>{approach}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </AccordionContent>
                          </Card>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                ) : (
                  <div className="p-4 bg-muted rounded-lg border border-border text-center">
                    <p className="text-sm text-muted-foreground">No marketing angles available</p>
                  </div>
                )}
              </div>

              {/* Navigation and Generate Button */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTemplateModalStep(1)
                    setSelectedAngleForRefinement(null)
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (selectedTemplateForRefinement.length > 0 && selectedAngleForRefinement) {
                      handleGenerateRefinedTemplate(
                        selectedTemplateForRefinement,
                        selectedAngleForRefinement
                      )
                    }
                  }}
                  disabled={isGeneratingRefined || !selectedAngleForRefinement || selectedTemplateForRefinement.length === 0}
                  className="min-w-[180px]"
                >
                  {isGeneratingRefined ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Refined Template'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const DeepCopyResults = memo(DeepCopyResultsComponent)
