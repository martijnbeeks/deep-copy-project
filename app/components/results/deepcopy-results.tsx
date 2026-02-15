"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarkdownContent } from "@/components/results/markdown-content";
import { TemplateGrid } from "@/components/results/template-grid";
import {
  FileText,
  BarChart3,
  Code,
  BookOpen,
  User,
  Target,
  Calendar,
  Clock,
  Users,
  MapPin,
  DollarSign,
  Briefcase,
  Sparkles,
  AlertTriangle,
  Star,
  Eye,
  TrendingUp,
  Brain,
  Loader2,
  CheckCircle2,
  Download,
  Globe,
  DownloadCloud,
  Trash2,
  Zap,
  Edit,
  Copy,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import JSZip from "jszip";
import { useState, useEffect, useMemo, memo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { TemplatePreview } from "@/components/template-preview";
import { useToast } from "@/hooks/use-toast";
import { useTemplates } from "@/lib/hooks/use-templates";
import { UsageLimitDialog } from "@/components/ui/usage-limit-dialog";
import {
  extractContentFromSwipeResult,
  injectContentIntoTemplate,
} from "@/lib/utils/template-injection";
import {
  MarketingAngleResult,
  SwipeResult,
  Listicle,
  Advertorial,
  Angle,
  MarketingAvatarV2,
} from "@/lib/clients/deepcopy-client";
import { internalApiClient } from "@/lib/clients/internal-client";
import { Template } from "@/lib/db/types";
import { logger } from "@/lib/utils/logger";
import { capitalizeFirst, getAvatarBasedNumber } from "@/lib/utils/avatar-utils";
import { GenerateStaticAds } from "@/components/results/generate-static-ads";
import { isV2Job, transformV2ToExistingSchema, TransformedAvatar } from "@/lib/utils/v2-data-transformer";
import { ExploreTemplatesDialogV2 } from "@/components/results/explore-templates-dialog-v2";
import { V2AvatarTree } from "@/components/results/v2-avatar-tree";
import { V2ResearchData } from "@/components/results/v2-research-data";
import { PrelanderImageGenerationDialog } from "@/components/results/prelander-image-generation-dialog";
import { TemplateImageGenerationDialog } from "@/components/results/template-image-generation-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getAuthorizationHeader } from "@/lib/utils/client-auth"
import { replaceTemplateImagesInHTML } from "@/lib/utils/template-image-replacer";
import { ImageGenerationFloater } from "@/components/results/image-generation-floater";

const NEW_TEMPLATE_IDS = ['AD0001', 'LD0001'] // New templates with image generation support

interface DeepCopyResult extends MarketingAngleResult {
  results: MarketingAngleResult["results"] & {
    marketing_avatars?: MarketingAvatarV2[];
  };
}

interface DeepCopyResultsProps {
  result: {
    html_content: string;
    metadata?: {
      deepcopy_job_id?: string;
      project_name?: string;
      timestamp_iso?: string;
      full_result?: DeepCopyResult;
      generated_at?: string;
      word_count?: number;
      template_used?: string;
      generated_angles?: string[];
    };
  };
  jobTitle: string;
  jobId?: string;
  advertorialType?: string;
  templateId?: string;
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
  }>;
  salesPageUrl?: string;
}

// Type guard function to check if an object is an Angle
function isAngle(obj: any): obj is Angle {
  return (
    typeof obj === "object" && obj !== null && "title" in obj && "angle" in obj
  );
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
  const angleObj: AngleWithProperties | null = isAngle(angle)
    ? (angle as AngleWithProperties)
    : null;
  return {
    angleObj,
    angleTitle: angleObj?.title ?? null,
    angleDescription:
      angleObj?.angle ?? (typeof angle === "string" ? angle : ""),
    angleString:
      typeof angle === "object" ? `${angle.title}: ${angle.angle}` : angle,
  };
}

// Reusable component for angle list sections (DRY: used for pain_points, desires, objections, etc.)
function AngleListSection({
  title,
  items,
  className = "",
  listStyle = "bullet", // "bullet" or "disc"
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
      <h6 className="text-xs font-semibold text-foreground uppercase mb-2">
        {title}
      </h6>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="text-sm text-muted-foreground flex items-start gap-2"
          >
            <span className="text-primary">•</span>
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
  isGenerating,
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
    return (
      <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
    );
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
    if (templateId.startsWith("L")) {
      return "listicle";
    }
    if (templateId.startsWith("A")) {
      return "advertorial";
    }
  }

  // Fallback to advertorialType prop
  if (advertorialType) {
    return advertorialType.toLowerCase();
  }

  // Default fallback
  return "advertorial";
}

// Helper function to format file type for display
function formatFileType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function DeepCopyResultsComponent({
  result,
  jobTitle,
  jobId,
  advertorialType,
  templateId,
  customerAvatars,
  salesPageUrl,
}: DeepCopyResultsProps) {
  const [templates, setTemplates] = useState<Array<{
    id?: string;
    name: string;
    type: string;
    html: string;
    angle?: string;
    timestamp?: string;
    templateId?: string;
    swipe_file_name?: string;
    config_data?: any;
  }>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    name: string;
    html_content: string;
    description?: string;
    category?: string;
  } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [selectedAnglePredictions, setSelectedAnglePredictions] = useState<any[] | undefined>(undefined);
  const [previewImageGenDialogOpen, setPreviewImageGenDialogOpen] = useState<{ [key: string]: boolean }>({});
  const [showImageGenFloater, setShowImageGenFloater] = useState<{ [key: string]: boolean }>({});
  const [activeImageJobs, setActiveImageJobs] = useState<Set<string>>(new Set()); // injected_template_ids with active jobs

  // Swipe file generation state - track multiple angles
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    undefined
  );
  const [generatedAngles, setGeneratedAngles] = useState<Set<string>>(
    new Set()
  );
  const [generatingAngles, setGeneratingAngles] = useState<Map<string, string>>(
    new Map()
  ); // angle -> jobId
  const [angleStatuses, setAngleStatuses] = useState<Map<string, string>>(
    new Map()
  ); // angle -> status
  const [isGeneratingSwipeFiles, setIsGeneratingSwipeFiles] = useState(false);
  const [swipeFileResults, setSwipeFileResults] = useState<any>(null);

  // Template exploration state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateModalStep, setTemplateModalStep] = useState<1 | 2>(1); // 1 = template selection, 2 = angle selection
  const [selectedTemplateForRefinement, setSelectedTemplateForRefinement] =
    useState<string | null>(null);
  const [selectedAngleForRefinement, setSelectedAngleForRefinement] = useState<
    string | null
  >(null);
  const [openAngleItem, setOpenAngleItem] = useState<string | undefined>(
    undefined
  );
  const [isGeneratingRefined, setIsGeneratingRefined] = useState(false);
  const [selectedAngleFilter, setSelectedAngleFilter] = useState<string>("all");
  const [selectedAvatarFilter, setSelectedAvatarFilter] = useState<string>("all");

  // Usage limit dialog state
  const [showUsageLimitDialog, setShowUsageLimitDialog] = useState(false);
  const [usageLimitData, setUsageLimitData] = useState<{
    usageType: "deep_research" | "pre_lander";
    currentUsage: number;
    limit: number;
  } | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [modalTypeFilter, setModalTypeFilter] = useState<string>("all");
  const [openMarketingAngle, setOpenMarketingAngle] = useState<
    string | undefined
  >(undefined);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  // V2 state management
  const [isV2, setIsV2] = useState(false);
  const [showExploreTemplatesV2, setShowExploreTemplatesV2] = useState(false);

  // Use TanStack Query for templates data
  const {
    data: availableTemplates = [],
    isLoading: availableTemplatesLoading,
  } = useTemplates();
  const { toast } = useToast();


  // Listen for template updates coming back from the editor window and refresh the page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        !event.data ||
        event.data.type !== "TEMPLATE_UPDATED"
      ) {
        return;
      }

      // Simplest robust behaviour: reload so all data and UI are in sync
      window.location.reload();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // On load: check for pending image jobs, trigger server-side recovery, show indicators
  useEffect(() => {
    let cancelled = false;

    const checkAndRecover = async () => {
      try {
        const response = await fetch('/api/image-jobs/active');
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const activeIds: string[] = data.activeTemplateIds || [];

        if (activeIds.length > 0 && !cancelled) {
          setActiveImageJobs(new Set(activeIds));

          // Server is now polling these jobs to completion.
          // Wait and then check again until all jobs are done.
          const waitForCompletion = async () => {
            while (!cancelled) {
              await new Promise(resolve => setTimeout(resolve, 15000));
              if (cancelled) break;

              try {
                const checkResponse = await fetch('/api/image-jobs/active');
                if (!checkResponse.ok || cancelled) break;

                const checkData = await checkResponse.json();
                const remaining: string[] = checkData.activeTemplateIds || [];

                if (remaining.length === 0) {
                  // All jobs done — refresh to show updated images
                  setActiveImageJobs(new Set());
                  setTimeout(() => window.location.reload(), 2000);
                  break;
                } else {
                  setActiveImageJobs(new Set(remaining));
                }
              } catch {
                break;
              }
            }
          };

          waitForCompletion();
        }
      } catch {
        // Silently fail — table might not exist
      }
    };

    checkAndRecover();

    return () => { cancelled = true; };
  }, []);

  const fullResult = result.metadata?.full_result;
  // Use local database jobId instead of DeepCopy API job ID for API calls
  const originalJobId = jobId || result.metadata?.deepcopy_job_id;

  // Detect V2 jobs and transform data if needed
  useEffect(() => {
    // First check if customerAvatars has V2 data
    if (customerAvatars && customerAvatars.length > 0) {
      setIsV2(isV2Job(customerAvatars));
    }
    // If customerAvatars is empty but fullResult has V2 structure, it's a V2 job
    else if (fullResult?.results?.marketing_avatars) {
      setIsV2(true);
    }
  }, [customerAvatars, fullResult]);

  // Memoize HTML processing function for iframes
  const createPreviewHTML = useMemo(() => {
    return (htmlContent: string) => {
      return htmlContent;
    };
  }, []);

  // Memoize iframe HTML for each template
  const templateIframeHTML = useMemo(() => {
    return templates.reduce((acc, template) => {
      const key = `${template.name}-${template.angle || ""}`;
      acc[key] = `<!DOCTYPE html>
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
</body>
</html>`;
      return acc;
    }, {} as Record<string, string>);
  }, [templates, createPreviewHTML]);

  // Helper functions for Map state updates (DRY: used multiple times)
  const updateGeneratingAngle = (angleString: string, jobId: string) => {
    setGeneratingAngles((prev) => {
      const newMap = new Map(prev);
      newMap.set(angleString, jobId);
      return newMap;
    });
  };

  const removeGeneratingAngle = (angleString: string) => {
    setGeneratingAngles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(angleString);
      return newMap;
    });
  };

  const updateAngleStatus = (angleString: string, status: string) => {
    setAngleStatuses((prev) => {
      const newMap = new Map(prev);
      newMap.set(angleString, status);
      return newMap;
    });
  };

  const removeAngleStatus = (angleString: string) => {
    setAngleStatuses((prev) => {
      const newMap = new Map(prev);
      newMap.delete(angleString);
      return newMap;
    });
  };

  // Helper function to show error (DRY: used multiple times)
  const showError = (
    error: unknown,
    defaultMessage: string = "An error occurred"
  ) => {
    const errorWithStatus = error as Error & {
      status?: number;
      currentUsage?: number;
      limit?: number;
    };

    // Check if it's a usage limit error (429)
    if (errorWithStatus.status === 429) {
      setUsageLimitData({
        usageType: "pre_lander",
        currentUsage: errorWithStatus.currentUsage || 0,
        limit: errorWithStatus.limit || 0,
      });
      setShowUsageLimitDialog(true);
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message : defaultMessage;
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  };

  // Helper function to filter templates by angle (DRY: used in multiple places)
  const filterTemplatesByAngle = (
    templatesList: Array<{
      id?: string;
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
      templateId?: string;
      swipe_file_name?: string;
    }>,
    angleFilter: string
  ) => {
    if (angleFilter === "all") return templatesList;

    return templatesList.filter(
      (template) => {
        if (!template.angle) return false;
        
        // Normalize both for comparison
        const templateAngle = template.angle.trim();
        const filterAngle = angleFilter.trim();
        
        // Exact match (most reliable)
        if (templateAngle === filterAngle) return true;
        
        // Handle "Title: Description" format - match by full string or description part
        if (templateAngle.includes(": ")) {
          const parts = templateAngle.split(": ");
          if (parts.length >= 2) {
            // Match by description part
            if (parts[1].trim() === filterAngle) return true;
            // Match by full string if filter is also "Title: Description"
            if (filterAngle.includes(": ")) {
              const filterParts = filterAngle.split(": ");
              if (filterParts.length >= 2 && parts[1].trim() === filterParts[1].trim()) {
                return true;
              }
            }
          }
        }
        
        return false;
      }
    );
  };

  // Helper function to filter templates by type (advertorial/listical)
  const filterTemplatesByType = (
    templatesList: Array<{
      id?: string;
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
      templateId?: string;
      swipe_file_name?: string;
    }>,
    typeFilter: string
  ) => {
    if (typeFilter === "all") return templatesList;

    return templatesList.filter((template) => {
      const fileType = getFileType(template.templateId, advertorialType);
      return fileType.toLowerCase() === typeFilter.toLowerCase();
    });
  };

  // Helper function to match template to avatar by angle (V2 only)
  const getTemplateAvatarIndex = (
    template: { angle?: string }
  ): number | null => {
    if (!isV2 || !template.angle || !fullResult?.results?.marketing_avatars) {
      return null;
    }

    // Normalize template angle for comparison
    const templateAngle = template.angle.trim();
    
    // Check each avatar to see if any of its angles match this template's angle
    for (let i = 0; i < fullResult.results.marketing_avatars.length; i++) {
      const avatarData = fullResult.results.marketing_avatars[i];
      const angles = avatarData.angles?.generated_angles || [];

      for (const angle of angles) {
        // Build angle string EXACTLY as it was stored (matching v2-avatar-tree.tsx line 225-227)
        const angleString = angle.angle_subtitle
          ? `${angle.angle_title}: ${angle.angle_subtitle}`
          : angle.angle_title;
        
        // Exact match only (normalized)
        if (templateAngle === angleString.trim()) {
          return i;
        }
      }
    }
    return null;
  };

  // Helper function to filter templates by avatar (V2 only)
  const filterTemplatesByAvatar = (
    templatesList: Array<{
      id?: string;
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
      templateId?: string;
      swipe_file_name?: string;
    }>,
    avatarFilter: string
  ) => {
    if (avatarFilter === "all" || !isV2) return templatesList;

    const avatarIndex = parseInt(avatarFilter);
    if (isNaN(avatarIndex)) return templatesList;

    return templatesList.filter((template) => {
      const templateAvatarIndex = getTemplateAvatarIndex(template);
      return templateAvatarIndex === avatarIndex;
    });
  };

  // Combined filter function for angle, type, and avatar
  const filterTemplates = (
    templatesList: Array<{
      id?: string;
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
      templateId?: string;
      swipe_file_name?: string;
    }>,
    angleFilter: string,
    typeFilter: string,
    avatarFilter: string = "all"
  ) => {
    let filtered = filterTemplatesByAngle(templatesList, angleFilter);
    filtered = filterTemplatesByType(filtered, typeFilter);
    filtered = filterTemplatesByAvatar(filtered, avatarFilter);
    return filtered;
  };

  // Helper to make template names unique when there are multiple generations
  const makeTemplateNameUnique = (
    template: { 
      name: string; 
      timestamp?: string;
      templateId?: string;
      angle?: string;
    },
    allTemplates: Array<{ name: string; timestamp?: string; templateId?: string; angle?: string }>
  ): string => {
    // Count how many templates have the same base name (same templateId + angle)
    const sameNameCount = allTemplates.filter(t => 
      t.templateId === template.templateId && t.angle === template.angle
    ).length
    
    // If there are multiple generations, add timestamp to distinguish them
    if (sameNameCount > 1 && template.timestamp) {
      const date = new Date(template.timestamp)
      const timeStr = date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      return `${template.name} (${timeStr})`
    }
    
    return template.name
  }

  // Function to refresh templates and generated angles
  const refreshTemplates = useCallback(async () => {
    if (jobId) {
      try {
        // Load generated angles from database
        try {
          const angles = await internalApiClient.getGeneratedAngles(jobId);
          setGeneratedAngles(new Set(angles));
        } catch (error) {
          logger.error("Failed to load generated angles:", error);
        }

        // Load templates from database
        try {
          const injectedTemplatesResponse =
            (await internalApiClient.getInjectedTemplates(jobId)) as any;

          // Handle different response formats
          let injectedTemplates: any[] = [];
          if (Array.isArray(injectedTemplatesResponse)) {
            injectedTemplates = injectedTemplatesResponse;
          } else if (
            injectedTemplatesResponse?.templates &&
            Array.isArray(injectedTemplatesResponse.templates)
          ) {
            injectedTemplates = injectedTemplatesResponse.templates;
          } else if (
            injectedTemplatesResponse?.data &&
            Array.isArray(injectedTemplatesResponse.data)
          ) {
            injectedTemplates = injectedTemplatesResponse.data;
          }

          logger.log(
            `📦 Initial load: Processed ${injectedTemplates.length} injected templates for job ${jobId}`
          );

          if (injectedTemplates.length > 0) {
            let templates = injectedTemplates.map((injected: any) => ({
              id: injected.id,
              name: `${injected.template_id} - ${injected.angle_name}`,
              type: injected.template_id?.startsWith('L') ? 'Listicle' : injected.template_id?.startsWith('A') ? 'Advertorial' : "Marketing Angle",
              html: injected.html_content,
              angle: injected.angle_name,
              templateId: injected.template_id,
              timestamp: injected.created_at,
              swipe_file_name: injected.swipe_file_name || undefined,
              config_data: injected.config_data || undefined,
            }));

            // Make names unique for multiple generations of the same template
            const templatesWithUniqueNames = templates.map(t => ({
              ...t,
              name: makeTemplateNameUnique(t, templates)
            }))

            // Sort by angle name, then by template ID, then by timestamp (newest first)
            templatesWithUniqueNames.sort((a: any, b: any) => {
              if (a.angle !== b.angle) {
                return (a.angle || "").localeCompare(b.angle || "");
              }
              // Same angle - sort by template ID, then by timestamp (newest first)
              if (a.templateId !== b.templateId) {
                return (a.templateId || "").localeCompare(b.templateId || "");
              }
              // Same angle and template - newest first
              if (a.timestamp && b.timestamp) {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              }
              return 0
            });

            // MERGE instead of replace: Keep existing templates and add new ones
            setTemplates(prev => {
              const existingMap = new Map<string, { id?: string; name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string; swipe_file_name?: string; config_data?: any; }>()
              // Add all existing templates to map, using ID as key
              prev.forEach(t => {
                if (t.id) {
                  existingMap.set(t.id, t)
                }
              })

              // Add/update with new templates (by ID)
              templatesWithUniqueNames.forEach(t => {
                if (t.id) {
                  existingMap.set(t.id, t) // Will add new or update existing
                }
              })

              const merged = Array.from(existingMap.values())
              // Sort merged array
              merged.sort((a: any, b: any) => {
                if (a.angle !== b.angle) {
                  return (a.angle || "").localeCompare(b.angle || "");
                }
                if (a.templateId !== b.templateId) {
                  return (a.templateId || "").localeCompare(b.templateId || "");
                }
                if (a.timestamp && b.timestamp) {
                  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                }
                return 0
              })

              return merged
            })

            // Update generatedAngles based on loaded templates
            const uniqueAngles = new Set<string>();
            templates.forEach((template) => {
              if (template.angle) {
                // Extract the angle description part if it's in "Title: Description" format
                let angleDescription = template.angle;
                if (template.angle.includes(": ")) {
                  const parts = template.angle.split(": ");
                  if (parts.length >= 2) {
                    angleDescription = parts[1];
                  }
                }

                // Add the description part
                uniqueAngles.add(angleDescription);
                // Also add the full angle string for matching
                uniqueAngles.add(template.angle);

                // Find matching marketing angle to get the full "Title: Description" format
                if (fullResult?.results?.marketing_angles) {
                  const matchingAngle = fullResult.results.marketing_angles.find((ma: any) => {
                    if (typeof ma === "string") {
                      return ma === angleDescription || ma === template.angle;
                    }
                    // Match by angle description
                    if (ma.angle === angleDescription || ma.angle === template.angle) {
                      return true;
                    }
                    return false;
                  });

                  // If we found a matching marketing angle, add it in "Title: Description" format
                  if (matchingAngle && typeof matchingAngle === "object" && matchingAngle.title && matchingAngle.angle) {
                    uniqueAngles.add(`${matchingAngle.title}: ${matchingAngle.angle}`);
                  }
                }
              }
            });

            // Add all unique angles to generatedAngles
            if (uniqueAngles.size > 0) {
              setGeneratedAngles((prev) => {
                const newSet = new Set(prev);
                uniqueAngles.forEach((angle) => newSet.add(angle));
                return newSet;
              });
            logger.log(
              `✅ Updated generatedAngles with ${uniqueAngles.size} angles from loaded templates`
            );
          }

          logger.log(
            `✅ Loaded ${templatesWithUniqueNames.length} templates into UI for job ${jobId}`
          );
          } else {
            // DON'T clear templates if none found - might be a temporary issue
            logger.log(`⚠️ No templates found in database for job ${jobId}, keeping existing templates`)
          }
        } catch (error) {
          logger.error("Failed to load templates:", error);
          // DON'T clear templates on error - preserve existing state
        }
        // Always set loading to false after checking database
        setTemplatesLoading(false);
      } catch (error) {
        logger.error("Error loading data from database:", error);
        setTemplatesLoading(false);
      }
    } else {
      // If no jobId, still set loading to false
      setTemplatesLoading(false);
    }
  }, [jobId, fullResult]);

  // Load generated angles and templates from database on mount
  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // Poll swipe file status for a specific angle
  const pollSwipeFileStatus = async (swipeFileJobId: string, angle: string) => {
    const maxAttempts = 60; // 5 minutes max (60 * 5s)
    const pollInterval = 5000; // Poll every 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const statusData = (await internalApiClient.getSwipeFileStatus(
          swipeFileJobId
        )) as { status: string };

        // Update status for this specific angle
        setAngleStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(angle, statusData.status);
          return newMap;
        });

        if (statusData.status === "SUCCEEDED") {
          // Fetch results
          const swipeFileResponse = await internalApiClient.getSwipeFileResult(
            swipeFileJobId
          );

          // Process swipe file response - inject into templates and store
          try {
            const processResult = (await internalApiClient.processSwipeFile({
              jobId: jobId!, // Use the local job ID from props
              angle,
              swipeFileResponse,
            })) as { processed: number };
            logger.log(
              `✅ Processed ${processResult.processed} templates for angle "${angle}"`
            );

            // Mark this angle as generated - add both full angle and description part for matching
            setGeneratedAngles((prev) => {
              const newSet = new Set(prev);
              newSet.add(angle);

              // Also add the description part if angle is in "Title: Description" format
              let angleDescription = angle;
              if (angle.includes(": ")) {
                const parts = angle.split(": ");
                if (parts.length >= 2) {
                  angleDescription = parts[1];
                  newSet.add(angleDescription); // Add just the description part
                }
              } else {
                angleDescription = angle;
              }

              // Find matching marketing angle to get the full "Title: Description" format
              if (fullResult?.results?.marketing_angles) {
                const matchingAngle = fullResult.results.marketing_angles.find((ma: any) => {
                  if (typeof ma === "string") {
                    return ma === angleDescription || ma === angle;
                  }
                  // Match by angle description
                  if (ma.angle === angleDescription || ma.angle === angle) {
                    return true;
                  }
                  return false;
                });

                // If we found a matching marketing angle, add it in "Title: Description" format
                if (matchingAngle && typeof matchingAngle === "object" && matchingAngle.title && matchingAngle.angle) {
                  newSet.add(`${matchingAngle.title}: ${matchingAngle.angle}`);
                }
              }

              return newSet;
            });

            // Remove from generating map
            setGeneratingAngles((prev) => {
              const newMap = new Map(prev);
              newMap.delete(angle);
              return newMap;
            });

            // Reload templates and generated angles from database
            try {
              // Reload generated angles
              const angles = await internalApiClient.getGeneratedAngles(jobId!);
              setGeneratedAngles(new Set(angles));
              logger.log(
                `✅ Reloaded ${angles.length} generated angles for job ${jobId}`
              );

              // Reload templates
              const injectedTemplatesResponse =
                (await internalApiClient.getInjectedTemplates(jobId!)) as any;

              // Handle different response formats
              let injectedTemplates: any[] = [];
              if (Array.isArray(injectedTemplatesResponse)) {
                injectedTemplates = injectedTemplatesResponse;
              } else if (
                injectedTemplatesResponse?.templates &&
                Array.isArray(injectedTemplatesResponse.templates)
              ) {
                injectedTemplates = injectedTemplatesResponse.templates;
              } else if (
                injectedTemplatesResponse?.data &&
                Array.isArray(injectedTemplatesResponse.data)
              ) {
                injectedTemplates = injectedTemplatesResponse.data;
              }

              // Always set loading to false, even if no templates found
              setTemplatesLoading(false);

              if (injectedTemplates.length > 0) {
                let templates = injectedTemplates.map((injected: any) => ({
                  id: injected.id,
                  name: `${injected.template_id} - ${injected.angle_name}`,
                  type: injected.template_id?.startsWith('L') ? 'Listicle' : injected.template_id?.startsWith('A') ? 'Advertorial' : "Injected Template",
                  html: injected.html_content,
                  angle: injected.angle_name,
                  templateId: injected.template_id,
                  timestamp: injected.created_at,
                  swipe_file_name: injected.swipe_file_name || undefined,
                  config_data: injected.config_data || undefined,
                }));

                // Make names unique for multiple generations
                const templatesWithUniqueNames = templates.map(t => ({
                  ...t,
                  name: makeTemplateNameUnique(t, templates)
                }))

                // Sort
                templatesWithUniqueNames.sort((a: any, b: any) => {
                  if (a.angle !== b.angle) {
                    return (a.angle || "").localeCompare(b.angle || "");
                  }
                  if (a.templateId !== b.templateId) {
                    return (a.templateId || "").localeCompare(b.templateId || "");
                  }
                  if (a.timestamp && b.timestamp) {
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  }
                  return 0
                });

                // Update generatedAngles based on loaded templates
                const uniqueAngles = new Set<string>();
                templatesWithUniqueNames.forEach((template) => {
                  if (template.angle) {
                    // Extract the angle description part if it's in "Title: Description" format
                    let angleDescription = template.angle;
                    if (template.angle.includes(": ")) {
                      const parts = template.angle.split(": ");
                      if (parts.length >= 2) {
                        angleDescription = parts[1];
                      }
                    }

                    // Add the description part
                    uniqueAngles.add(angleDescription);
                    // Also add the full angle string for matching
                    uniqueAngles.add(template.angle);

                    // Find matching marketing angle to get the full "Title: Description" format
                    if (fullResult?.results?.marketing_angles) {
                      const matchingAngle = fullResult.results.marketing_angles.find((ma: any) => {
                        if (typeof ma === "string") {
                          return ma === angleDescription || ma === template.angle;
                        }
                        // Match by angle description
                        if (ma.angle === angleDescription || ma.angle === template.angle) {
                          return true;
                        }
                        return false;
                      });

                      // If we found a matching marketing angle, add it in "Title: Description" format
                      if (matchingAngle && typeof matchingAngle === "object" && matchingAngle.title && matchingAngle.angle) {
                        uniqueAngles.add(`${matchingAngle.title}: ${matchingAngle.angle}`);
                      }
                    }
                  }
                });

                // Add all unique angles to generatedAngles
                if (uniqueAngles.size > 0) {
                  setGeneratedAngles((prev) => {
                    const newSet = new Set(prev);
                    uniqueAngles.forEach((angle) => newSet.add(angle));
                    return newSet;
                  });
                }

                // MERGE instead of replace
                setTemplates(prev => {
                  const existingMap = new Map<string, { id?: string; name: string; type: string; html: string; angle?: string; timestamp?: string; templateId?: string; swipe_file_name?: string; config_data?: any; }>()
                  // Add all existing templates
                  prev.forEach(t => {
                    if (t.id) {
                      existingMap.set(t.id, t)
                    }
                  })

                  // Add/update with new templates
                  templatesWithUniqueNames.forEach(t => {
                    if (t.id) {
                      existingMap.set(t.id, t)
                    }
                  })

                  const merged = Array.from(existingMap.values())
                  merged.sort((a: any, b: any) => {
                    if (a.angle !== b.angle) {
                      return (a.angle || "").localeCompare(b.angle || "");
                    }
                    if (a.templateId !== b.templateId) {
                      return (a.templateId || "").localeCompare(b.templateId || "");
                    }
                    if (a.timestamp && b.timestamp) {
                      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    }
                    return 0
                  })

                  return merged
                })

                logger.log(
                  `✅ Setting ${templatesWithUniqueNames.length} templates in UI state`
                );
              } else {
                logger.log(
                  `⚠️ No templates found in response for job ${jobId}, keeping existing templates`
                );
                // DON'T clear: setTemplates([]); // REMOVED
              }
            } catch (error) {
              logger.error("Error reloading templates:", error);
              setTemplatesLoading(false);
            }
          } catch (processError) {
            logger.error("Error processing swipe file response:", processError);
            // Still mark as generated to prevent retries, but show error
            setGeneratedAngles((prev) => {
              const newSet = new Set(prev).add(angle);
              return newSet;
            });
            setGeneratingAngles((prev) => {
              const newMap = new Map(prev);
              newMap.delete(angle);
              return newMap;
            });
            alert(
              "Pre-landers generated but failed to process. Please try refreshing the page."
            );
          }
          return;
        } else if ((statusData as { status: string }).status === "FAILED") {
          // Log the full response to see error details
          logger.error(
            "❌ Swipe file generation failed. Full response:",
            statusData
          );

          // Extract error message from response if available
          const errorMessage =
            (statusData as any).error ||
            (statusData as any).message ||
            (statusData as any).errorMessage ||
            "Swipe file generation job failed on the server";

          logger.error("❌ Error details:", errorMessage);

          // Remove from generating map on failure
          setGeneratingAngles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(angle);
            return newMap;
          });

          // Update status
          setAngleStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(angle, "FAILED");
            return newMap;
          });

          // Show user-friendly error notification (only once)
          toast({
            title: "Pre-lander generation failed",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });

          // Return immediately to stop polling - don't throw error to prevent loop continuation
          return;
        }
      } catch (err: any) {
        logger.error(
          `⚠️ Swipe file polling error (attempt ${attempt}/${maxAttempts}):`,
          err
        );

        if (attempt === maxAttempts) {
          // Final attempt failed - show error to user
          const errorMessage =
            err?.message ||
            err?.error ||
            "Failed to check pre-lander generation status. Please try again.";

          logger.error(
            "❌ Swipe file polling failed after all attempts:",
            errorMessage
          );

          // Remove from generating map on timeout/failure
          setGeneratingAngles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(angle);
            return newMap;
          });

          setAngleStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(angle, "FAILED");
            return newMap;
          });

          // Show user-friendly error notification
          toast({
            title: "Pre-lander generation failed",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    }

    // Remove from generating map on timeout
    logger.warn(
      `⏱️ Swipe file generation timed out for angle "${angle}" after ${maxAttempts} attempts`
    );
    setGeneratingAngles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(angle);
      return newMap;
    });
    setAngleStatuses((prev) => {
      const newMap = new Map(prev);
      newMap.set(angle, "TIMEOUT");
      return newMap;
    });

    // Show timeout error to user
    toast({
      title: "Pre-lander generation timed out",
      description: `The pre-lander generation for "${angle}" is taking longer than expected. Please check back later or try again.`,
      variant: "destructive",
      duration: 5000,
    });
  };

  const extractHTMLTemplates = async () => {
    const templates: Array<{
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
      templateId?: string;
    }> = [];

    try {
      // Check if we have full result data with swipe_results
      if (fullResult && fullResult.results?.swipe_results) {
        const swipeResults = fullResult.results.swipe_results;

        // Get injectable template for this specific template ID
        const templateType =
          advertorialType === "listicle" ? "listicle" : "advertorial";

        try {
          let injectableTemplate = null;

          if (templateId) {
            // Try to fetch the specific injectable template with the same ID
            const specificTemplates =
              (await internalApiClient.getAdminInjectableTemplates({
                id: templateId,
              })) as any[];

            if (
              Array.isArray(specificTemplates) &&
              specificTemplates.length > 0
            ) {
              injectableTemplate = specificTemplates[0];
            }
          }

          // Fallback: fetch by type if specific template not found
          if (!injectableTemplate) {
            const injectableTemplates =
              (await internalApiClient.getAdminInjectableTemplates({
                type: templateType,
              })) as any[];

            if (
              Array.isArray(injectableTemplates) &&
              injectableTemplates.length > 0
            ) {
              injectableTemplate = injectableTemplates[0];
            }
          }

          if (injectableTemplate) {
            // Process each swipe result
            swipeResults.forEach((swipeResult: SwipeResult, index: number) => {
              try {
                // extractContentFromSwipeResult now handles both string and object formats
                // Pass the swipeResult as-is
                const contentData = extractContentFromSwipeResult(
                  swipeResult,
                  templateType,
                  templateId || undefined
                );

                // Inject content into the injectable template
                const renderedHtml = injectContentIntoTemplate(
                  injectableTemplate,
                  contentData,
                  templateId || undefined
                );

                templates.push({
                  name:
                    typeof swipeResult.angle === "string" &&
                      swipeResult.angle.includes(":")
                      ? swipeResult.angle.split(":")[0].trim()
                      : `Angle ${index + 1}`,
                  type: "Marketing Angle",
                  html: renderedHtml,
                  angle: swipeResult.angle,
                  templateId: injectableTemplate.id,
                  timestamp:
                    result.metadata?.generated_at || new Date().toISOString(),
                });
              } catch (error) {
                logger.error(`Error processing angle ${index + 1}:`, error);
              }
            });
          } else {
            // Fallback to old carousel method
            return await extractFromCarousel();
          }
        } catch (error) {
          logger.error("Error fetching injectable templates:", error);
          // Fallback to old carousel method
          return await extractFromCarousel();
        }

        return templates;
      }

      // Fallback: Check if we have processed HTML content (carousel) from the old system
      if (
        result.html_content &&
        result.html_content.includes("carousel-container")
      ) {
        return await extractFromCarousel();
      }

      // If no data available, show empty state
      return templates;
    } catch (error) {
      logger.error("Error in template extraction:", error);
      return templates;
    }
  };

  const extractFromCarousel = async () => {
    const templates: Array<{
      name: string;
      type: string;
      html: string;
      angle?: string;
      timestamp?: string;
    }> = [];

    try {
      // Extract individual angles and their HTML from the carousel
      const angleMatches = result.html_content.match(
        /<button class="nav-button[^>]*>([^<]+)<\/button>/g
      );
      const angles = angleMatches
        ? angleMatches.map((match) => match.replace(/<[^>]*>/g, "").trim())
        : ["Marketing Angle 1"];

      // Try multiple approaches to extract template content
      let templateContent: string[] = [];

      // Approach 1: Look for iframes with srcdoc
      const iframeMatches = result.html_content.match(
        /<iframe[^>]*srcdoc="([^"]*)"[^>]*><\/iframe>/g
      );

      if (iframeMatches && iframeMatches.length > 0) {
        templateContent = iframeMatches
          .map((iframeHtml) => {
            const contentMatch = iframeHtml.match(/srcdoc="([^"]*)"/);
            if (contentMatch) {
              return contentMatch[1]
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&");
            }
            return "";
          })
          .filter((content) => content.length > 0);
      }

      // Approach 2: Look for template-slide divs with content
      if (templateContent.length === 0) {
        const slideMatches = result.html_content.match(
          /<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
        );

        if (slideMatches && slideMatches.length > 0) {
          templateContent = slideMatches.map((slideHtml) => {
            // Extract content from within the slide
            const contentMatch = slideHtml.match(
              /<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/
            );
            return contentMatch ? contentMatch[1] : slideHtml;
          });
        }
      }

      // Approach 3: Look for any div with template content
      if (templateContent.length === 0) {
        const divMatches = result.html_content.match(
          /<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/g
        );

        if (divMatches && divMatches.length > 0) {
          templateContent = divMatches.map((divHtml) => {
            const contentMatch = divHtml.match(
              /<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/
            );
            return contentMatch ? contentMatch[1] : divHtml;
          });
        }
      }

      // Create templates from extracted content
      if (templateContent.length > 0) {
        angles.forEach((angle, index) => {
          const content =
            templateContent[index] || templateContent[0] || result.html_content;

          templates.push({
            name: `Angle ${index + 1}`,
            type: "Marketing Angle",
            html: content,
            angle: angle,
            timestamp:
              result.metadata?.generated_at || new Date().toISOString(),
          });
        });
      } else {
        // Fallback: create individual templates with the full carousel HTML
        angles.forEach((angle, index) => {
          templates.push({
            name: `Angle ${index + 1}`,
            type: "Marketing Angle",
            html: result.html_content,
            angle: angle,
            timestamp:
              result.metadata?.generated_at || new Date().toISOString(),
          });
        });
      }

      return templates;
    } catch (error) {
      logger.error("Error in carousel extraction:", error);
      return templates;
    }
  };

  // Load templates when result changes (fallback to old method if no database templates)
  // This runs after the initial database load to handle old jobs
  useEffect(() => {
    const loadTemplates = async () => {
      // Only load if we don't already have templates from database and templatesLoading is true
      if (templates.length === 0 && templatesLoading) {
        try {
          const extractedTemplates = await extractHTMLTemplates();
          if (extractedTemplates.length > 0) {
            setTemplates(extractedTemplates);
            setTemplatesLoading(false);
          } else {
            setTemplatesLoading(false);
          }
        } catch (error) {
          logger.error("Error loading templates:", error);
          setTemplatesLoading(false);
        }
      }
    };

    // Load templates as fallback if database doesn't have them (for old jobs)
    loadTemplates();
  }, [
    result,
    jobTitle,
    swipeFileResults,
    fullResult,
    templates.length,
    templatesLoading,
  ]);

  // Handler for exploring templates
  const handleExploreTemplates = async () => {
    setShowTemplateModal(true);
    // Use the same store as /templates page
    // Templates are automatically fetched by useTemplates hook
  };

  // Handler for template selection
  const handleAngleToggle = (angleText: string) => {
    if (selectedAngleForRefinement === angleText) {
      setSelectedAngleForRefinement(null);
    } else {
      setSelectedAngleForRefinement(angleText);
    }
  };

  // Helper function to get angle title from angle string (DRY principle)
  // Handles both "Title: Description" format (from Avatar & Marketing) and plain description format (from Explore More)
  const getAngleTitle = (
    angleString: string | undefined,
    fallback: string = ""
  ) => {
    if (!angleString) return fallback;

    // Extract description part if angleString is in "Title: Description" format
    let angleDescription = angleString;
    let angleTitlePart = "";
    if (angleString.includes(": ")) {
      const parts = angleString.split(": ");
      if (parts.length >= 2) {
        angleTitlePart = parts[0];
        angleDescription = parts[1];
      }
    }

    // Try to find matching marketing angle by description (the actual angle text)
    const matchingAngle = fullResult?.results?.marketing_angles?.find(
      (ma: any) => {
        if (typeof ma === "string") {
          // Match against full string or description part
          return ma === angleString || ma === angleDescription;
        }
        // Match by angle description (the actual angle text)
        if (ma.angle === angleDescription || ma.angle === angleString)
          return true;
        // Also check if title matches (for backwards compatibility)
        if (
          ma.title === angleString ||
          (angleTitlePart && ma.title === angleTitlePart)
        )
          return true;
        return false;
      }
    );

    if (
      matchingAngle &&
      typeof matchingAngle === "object" &&
      matchingAngle.title
    ) {
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
  const getAngleDescription = (
    angleString: string | undefined,
    fallback: string = ""
  ) => {
    if (!angleString) return fallback;

    // Extract description part if angleString is in "Title: Description" format
    let angleDescription = angleString;
    if (angleString.includes(": ")) {
      const parts = angleString.split(": ");
      if (parts.length >= 2) {
        angleDescription = parts[1];
      }
    }

    // Try to find matching marketing angle by description (the actual angle text)
    const matchingAngle = fullResult?.results?.marketing_angles?.find(
      (ma: any) => {
        if (typeof ma === "string") {
          return ma === angleString || ma === angleDescription;
        }
        // Match by angle description (the actual angle text)
        if (ma.angle === angleDescription || ma.angle === angleString)
          return true;
        return false;
      }
    );

    if (
      matchingAngle &&
      typeof matchingAngle === "object" &&
      matchingAngle.angle
    ) {
      return matchingAngle.angle;
    }

    // Return the description part (or full string if not in "Title: Description" format)
    return angleDescription;
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"?`)) {
      return
    }

    if (!templateId) {
      showError(new Error("Template ID is missing"), "Cannot delete template")
      return
    }

    // Store the template in case we need to restore it
    const templateToDelete = templates.find(t => t.id === templateId)

    // Optimistically remove from UI immediately
    setTemplates(prev => prev.filter(t => t.id !== templateId))

    toast({
      title: "Template deleted",
      description: `"${templateName}" has been deleted.`,
    })

    // Delete from database in the background
    try {
      const authHeaders = getAuthorizationHeader()
      const response = await fetch(`/api/templates/injected/${templateId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }
    } catch (err) {
      // If deletion fails, restore the template
      if (templateToDelete) {
        setTemplates(prev => [...prev, templateToDelete].sort((a, b) => {
          // Maintain original order
          const indexA = templates.findIndex(t => t.id === a.id)
          const indexB = templates.findIndex(t => t.id === b.id)
          return indexA - indexB
        }))
      }

      showError(err, "Failed to delete template from server. Template has been restored.")
    }
  }

  const handleDownloadAll = async () => {
    try {
      // Get filtered templates based on current filters (angle, type, and avatar)
      const templatesToDownload = filterTemplates(
        templates,
        selectedAngleFilter,
        selectedTypeFilter,
        selectedAvatarFilter
      );

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
        const sanitizedTitle = angleTitle
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const filename = template.templateId
          ? `${template.templateId}_${sanitizedTitle}.html`
          : `template_${index + 1}_${sanitizedTitle}.html`;

        zip.file(filename, template.html);
      });

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `templates_${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${templatesToDownload.length} template${templatesToDownload.length !== 1 ? "s" : ""
          } as ZIP file.`,
      });
    } catch (error) {
      logger.error("Failed to download templates:", error);
      toast({
        title: "Download failed",
        description: "Failed to create ZIP file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyHTML = async (content: string, templateId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedTemplateId(templateId);
      setTimeout(() => setCopiedTemplateId(null), 2000);
      toast({
        title: "HTML copied",
        description: "The HTML content has been copied to your clipboard.",
      });
    } catch (err) {
      console.error('Failed to copy HTML:', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy HTML to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    logger.log("Template selected:", templateId);
    setSelectedTemplateForRefinement((prev) => {
      if (prev === templateId) {
        // Deselect if already selected
        return null;
      } else {
        // Select this template (replace any previous selection)
        return templateId;
      }
    });
  };

  // Helper function to find angle and avatar IDs from fullResult based on angle string
  const findAngleAndAvatarIds = (angleString: string): { angleId: string | null; avatarId: string | null } => {
    if (!fullResult?.results?.marketing_avatars) {
      return { angleId: null, avatarId: null };
    }

    // Search through all avatars and their angles
    for (const avatarData of fullResult.results.marketing_avatars) {
      const angles = avatarData.angles?.generated_angles || [];
      
      for (const angle of angles) {
        // Match angle by comparing the angle string
        // Angle string can be in format "Title: Subtitle" or just "Title"
        const angleMatchString = angle.angle_subtitle
          ? `${angle.angle_title}: ${angle.angle_subtitle}`
          : angle.angle_title;
        
        if (angleMatchString === angleString || angle.angle_title === angleString) {
          // Found matching angle - extract IDs
          const angleId = (angle as any).id || null;
          // Avatar ID is in avatarData.avatar.id (based on V2 structure)
          const avatarId = (avatarData.avatar as any)?.id || null;
          
          return { angleId, avatarId };
        }
      }
    }

    return { angleId: null, avatarId: null };
  };

  // Handler for generating refined template
  const handleGenerateRefinedTemplate = async (
    templateIds: string[],
    angle: string
  ) => {
    if (!originalJobId || !templateIds || templateIds.length === 0 || !angle) {
      toast({
        title: "Error",
        description: "Please select at least one template and an angle.",
        variant: "destructive",
      });
      return;
    }

    // Find the correct angle and avatar IDs from fullResult
    const { angleId, avatarId } = findAngleAndAvatarIds(angle);
    
    if (!angleId || !avatarId) {
      toast({
        title: "Error",
        description: "Could not find angle or avatar IDs. Please try selecting the angle again.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingRefined(true);

    // Close modal and reset immediately for better UX
    setShowTemplateModal(false);
    setSelectedTemplateForRefinement(null);
    setSelectedAngleForRefinement(null);
    setTemplateModalStep(1);

    // Add to generatingAngles immediately so skeleton loader appears right away
    // Use a temporary jobId placeholder until we get the real one from the API
    setGeneratingAngles((prev) => {
      const newMap = new Map(prev);
      newMap.set(angle, "pending"); // Temporary placeholder
      return newMap;
    });

    setAngleStatuses((prev) => {
      const newMap = new Map(prev);
      newMap.set(angle, "SUBMITTING");
      return newMap;
    });

    // Show success acknowledgment immediately
    toast({
      title: "Generation started",
      description: "Your pre-lander is being generated. This may take a few minutes.",
    });

    try {
      // Call swipe-files/generate endpoint with original_job_id, angle_id, avatar_id, and swipe_file_ids array
      const data = (await internalApiClient.generateSwipeFiles({
        original_job_id: originalJobId,
        angle_id: angleId, // Use the actual angle ID, not the descriptive string
        avatar_id: avatarId, // Use the actual avatar ID, not 'default'
        swipe_file_ids: templateIds, // Array of template IDs in format L00001, A00003, etc.
      })) as { jobId?: string };

      // Update with the real jobId from the API response
      if (data.jobId) {
        setGeneratingAngles((prev) => {
          const newMap = new Map(prev);
          newMap.set(angle, data.jobId!); // Replace placeholder with real jobId
          return newMap;
        });
        setAngleStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(angle, "SUBMITTED");
          return newMap;
        });

        // Start polling for this specific angle
        pollSwipeFileStatus(data.jobId!, angle);
      } else {
        // If no jobId returned, remove from generating
        setGeneratingAngles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(angle);
          return newMap;
        });
        setAngleStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.delete(angle);
          return newMap;
        });
      }
    } catch (error: any) {
      // Handle intentional overage confirmation for swipe-file pre-landers
      if (error.status === 402 && (error as any).code === "JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED") {
        // Show toast notification about overage
        const overageCredits = (error as any).overageCredits ?? 0;
        const overageCostTotal = (error as any).overageCostTotal ?? 0;
        const currency = (error as any).currency ?? "EUR";
        
        toast({
          title: "Overage Charges Apply",
          description: `This job requires ${overageCredits} extra credit${overageCredits === 1 ? '' : 's'}. Overage charges will be added to your next invoice.`,
          variant: "default",
        });

        // Automatically retry with allowOverage=true
        try {
          const retryData = await internalApiClient.generateSwipeFiles({
            original_job_id: originalJobId,
            angle_id: angleId,
            avatar_id: avatarId,
            swipe_file_ids: templateIds,
            allowOverage: true,
          }) as { jobId?: string };
          
          if (retryData.jobId) {
            setGeneratingAngles(prev => {
              const newMap = new Map(prev)
              newMap.set(angle, retryData.jobId!)
              return newMap
            })
            setAngleStatuses(prev => {
              const newMap = new Map(prev)
              newMap.set(angle, "SUBMITTED")
              return newMap
            })
            pollSwipeFileStatus(retryData.jobId!, angle)
          }
        } catch (retryError: any) {
          toast({
            title: "Error",
            description: retryError.message || "Failed to generate pre-landers",
            variant: "destructive",
          });
          // Only remove generating state if retry FAILED
          setGeneratingAngles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(angle);
            return newMap;
          });
          setAngleStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.delete(angle);
            return newMap;
          });
        }
      } else {
        // Remove from generatingAngles on error
        setGeneratingAngles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(angle);
          return newMap;
        });
        setAngleStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.delete(angle);
          return newMap;
        });

        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to generate pre-landers",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingRefined(false);
    }
  };

  const formatAnalysis = (analysis: string) => {
    const paragraphs = analysis.split("\n\n").filter((p) => p.trim());
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="mb-4 leading-relaxed">
        {paragraph.trim()}
      </p>
    ));
  };

  return (
    <>
      <div className="space-y-6 min-h-full">
      {/* V2 Research Data */}
      {isV2 && fullResult && (
        <V2ResearchData fullResult={fullResult} jobId={jobId || ''} />
      )}

      {/* V2 Avatar Tree */}
      {isV2 && (() => {
        // Use customerAvatars if available, otherwise transform from fullResult
        let avatarsToDisplay: TransformedAvatar[] | undefined = customerAvatars as TransformedAvatar[] | undefined;

        if ((!avatarsToDisplay || avatarsToDisplay.length === 0) && (fullResult as DeepCopyResult)?.results?.marketing_avatars) {
          // Transform V2 data on-the-fly
          avatarsToDisplay = transformV2ToExistingSchema(fullResult);
        }

        return avatarsToDisplay && avatarsToDisplay.length > 0 ? (
          <V2AvatarTree
            avatars={avatarsToDisplay}
            jobId={originalJobId}
            title="Customer Avatars & Marketing Angles"
            description="Deep research identified these customer avatars with their associated marketing angles"
            generatedAngles={generatedAngles}
            onGenerationStart={(angle) => updateGeneratingAngle(angle, "optimistic-loading")}
            onGenerationComplete={(angle) => {
              if (angle) removeGeneratingAngle(angle);
              refreshTemplates();
            }}
            onGenerationError={(angle) => removeGeneratingAngle(angle)}
            offerBrief={fullResult?.results?.offer_brief}
          />
        ) : null;
      })()}

      {/* Offer Brief */}
      {!isV2 && fullResult?.results?.offer_brief && (
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
                        <h2 className="text-2xl font-bold text-foreground">
                          Marketing Research
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Key elements of your marketing strategy
                        </p>
                        {salesPageUrl && (
                          <div className="flex items-center gap-2 mt-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a
                              href={salesPageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline break-all"
                            >
                              {salesPageUrl.length > 50 ? salesPageUrl.substring(0, 50) + "..." : salesPageUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    {(() => {
                      try {
                        // Parse offer_brief - it might be a string or already an object
                        const offerBrief =
                          typeof fullResult.results.offer_brief === "string"
                            ? JSON.parse(fullResult.results.offer_brief)
                            : fullResult.results.offer_brief;

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/*offerBrief.potential_product_names &&
                                offerBrief.potential_product_names.length >
                                  0 && (
                                  <div className="bg-muted/50 p-4 rounded-lg">
                                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-primary" />
                                      Potential Product Names
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {offerBrief.potential_product_names.map(
                                        (name: string, idx: number) => (
                                          <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {name}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )*/}

                              {offerBrief.stage_of_sophistication && (
                                <div className="bg-muted/50 p-4 rounded-lg col-span-2">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-accent" />
                                    Stage of Sophistication
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {offerBrief.stage_of_sophistication.level?.replace(
                                      /_/g,
                                      " "
                                    ) || "N/A"}
                                  </p>
                                  {offerBrief.stage_of_sophistication
                                    .rationale && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {
                                          offerBrief.stage_of_sophistication
                                            .rationale
                                        }
                                      </p>
                                    )}
                                </div>
                              )}
                              {offerBrief.level_of_consciousness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-accent" />
                                    Level of Consciousness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {offerBrief.level_of_consciousness}
                                  </p>
                                </div>
                              )}

                              {offerBrief.level_of_awareness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    Level of Awareness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {offerBrief.level_of_awareness.replace(
                                      /_/g,
                                      " "
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              {offerBrief.big_idea && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">
                                    Big Idea
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {offerBrief.big_idea}
                                  </p>
                                </div>
                              )}

                              {offerBrief.metaphors &&
                                offerBrief.metaphors.length > 0 && (
                                  <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
                                    <h4 className="font-medium text-foreground mb-2">
                                      Metaphors
                                    </h4>
                                    <div className="space-y-1">
                                      {offerBrief.metaphors.map(
                                        (metaphor: string, idx: number) => (
                                          <p
                                            key={idx}
                                            className="text-sm text-muted-foreground"
                                          >
                                            "{metaphor}"
                                          </p>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              {(offerBrief.potential_ump ||
                                offerBrief.potential_ums) && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {offerBrief.potential_ump &&
                                      offerBrief.potential_ump.length > 0 && (
                                        <div className="bg-muted/50 p-4 rounded-lg">
                                          <h4 className="font-medium text-foreground mb-2">
                                            Unique Mechanism (Problem)
                                          </h4>
                                          <ul className="space-y-1">
                                            {offerBrief.potential_ump.map(
                                              (ump: string, idx: number) => (
                                                <li
                                                  key={idx}
                                                  className="text-sm text-muted-foreground flex items-start gap-2"
                                                >
                                                  <span className="text-destructive mt-0.5">
                                                    •
                                                  </span>
                                                  <span>{ump}</span>
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {offerBrief.potential_ums &&
                                      offerBrief.potential_ums.length > 0 && (
                                        <div className="bg-muted/50 p-4 rounded-lg">
                                          <h4 className="font-medium text-foreground mb-2">
                                            Unique Mechanism (Solution)
                                          </h4>
                                          <ul className="space-y-1">
                                            {offerBrief.potential_ums.map(
                                              (ums: string, idx: number) => (
                                                <li
                                                  key={idx}
                                                  className="text-sm text-muted-foreground flex items-start gap-2"
                                                >
                                                  <span className="text-primary mt-0.5">
                                                    •
                                                  </span>
                                                  <span>{ums}</span>
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                )}

                              {/*{offerBrief.guru && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Guru / Discovery Story</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.guru}</p>
                                </div>
                              )}*/}

                              {offerBrief.discovery_story && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">
                                    Discovery Story
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {offerBrief.discovery_story}
                                  </p>
                                </div>
                              )}

                              {/*offerBrief.headline_ideas && offerBrief.headline_ideas.length > 0 && (
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
                              )*/}

                              {offerBrief.objections &&
                                offerBrief.objections.length > 0 && (
                                  <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                                    <h4 className="font-medium text-foreground mb-2">
                                      Key Objections
                                    </h4>
                                    <ul className="space-y-1">
                                      {offerBrief.objections.map(
                                        (objection: string, idx: number) => (
                                          <li
                                            key={idx}
                                            className="text-sm text-muted-foreground flex items-start gap-2"
                                          >
                                            <span className="text-destructive">
                                              •
                                            </span>
                                            <span>{objection}</span>
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}

                              {offerBrief.belief_chains &&
                                offerBrief.belief_chains.length > 0 && (
                                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                    <h4 className="font-medium text-foreground mb-2">
                                      Belief Chains
                                    </h4>
                                    <div className="space-y-3">
                                      {offerBrief.belief_chains.map(
                                        (chain: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="bg-background/50 p-3 rounded border border-primary/10"
                                          >
                                            <p className="text-sm font-medium text-foreground mb-2">
                                              {chain.outcome}
                                            </p>
                                            <ul className="space-y-1">
                                              {chain.steps?.map(
                                                (
                                                  step: string,
                                                  stepIdx: number
                                                ) => (
                                                  <li
                                                    key={stepIdx}
                                                    className="text-xs text-muted-foreground flex items-start gap-2"
                                                  >
                                                    <span className="text-primary mt-0.5">
                                                      ✓
                                                    </span>
                                                    <span>{step}</span>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              {/*offerBrief.funnel_architecture && offerBrief.funnel_architecture.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Funnel Architecture</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.funnel_architecture.join(' → ')}</p>
                                </div>
                              )*/}

                              {/*offerBrief.potential_domains && offerBrief.potential_domains.length > 0 && (
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
                              )*/}

                              {offerBrief.product && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">
                                    Product Information
                                  </h4>
                                  {offerBrief.product.name && (
                                    <p className="text-sm text-muted-foreground mb-1">
                                      <strong>Name:</strong>{" "}
                                      {offerBrief.product.name}
                                    </p>
                                  )}
                                  {offerBrief.product.description && (
                                    <p className="text-sm text-muted-foreground mb-1">
                                      <strong>Description:</strong>{" "}
                                      {offerBrief.product.description}
                                    </p>
                                  )}
                                  {offerBrief.product.details && (
                                    <p className="text-sm text-muted-foreground">
                                      <strong>Details:</strong>{" "}
                                      {offerBrief.product.details}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/*offerBrief.examples_swipes && offerBrief.examples_swipes.length > 0 && (
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
                              )*/}

                              {offerBrief.other_notes && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">
                                    Other Notes
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {offerBrief.other_notes}
                                  </p>
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
                              {typeof fullResult.results.offer_brief ===
                                "string"
                                ? fullResult.results.offer_brief
                                : JSON.stringify(
                                  fullResult.results.offer_brief,
                                  null,
                                  2
                                )}
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
      {(fullResult?.results?.avatar_sheet ||
        fullResult?.results?.marketing_angles) && (
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
                          <h2 className="text-2xl font-bold text-foreground">
                            Avatars & Marketing Angles
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Customer avatars and marketing angles
                          </p>
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
                              {customerAvatars?.[0]?.persona_name ||
                                "Customer Avatar"}
                            </h4>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                              {(() => {
                                try {
                                  const avatarData = JSON.parse(
                                    fullResult.results.avatar_sheet
                                  );

                                  // Build array of all available accordion items to open by default
                                  const defaultOpenItems = ["demographics"];
                                  if (
                                    avatarData.demographics
                                      ?.professional_backgrounds
                                  ) {
                                    defaultOpenItems.push(
                                      "professional-background"
                                    );
                                  }
                                  if (
                                    avatarData.demographics?.typical_identities
                                  ) {
                                    defaultOpenItems.push("identities");
                                  }
                                  if (avatarData.pain_points) {
                                    defaultOpenItems.push("pain-points");
                                  }
                                  if (avatarData.goals) {
                                    defaultOpenItems.push("goals");
                                  }

                                  return (
                                    <Accordion
                                      type="multiple"
                                      className="w-full"
                                      defaultValue={defaultOpenItems}
                                    >
                                      {/* Demographics */}
                                      <AccordionItem
                                        value="demographics"
                                        className="border-none"
                                      >
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-foreground text-sm">
                                              Demographics
                                            </span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                              <div>
                                                <p className="text-muted-foreground text-xs">
                                                  Age
                                                </p>
                                                <p className="font-medium text-foreground">
                                                  {avatarData.demographics
                                                    ?.age_range || "N/A"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground text-xs">
                                                  Gender
                                                </p>
                                                <p className="font-medium text-foreground">
                                                  {avatarData.demographics?.gender
                                                    ?.map((g: string) =>
                                                      capitalizeFirst(g)
                                                    )
                                                    .join(", ") || "N/A"}
                                                </p>
                                              </div>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs mb-1">
                                                Locations
                                              </p>
                                              <div className="flex flex-wrap gap-1">
                                                {avatarData.demographics?.locations?.map(
                                                  (
                                                    location: string,
                                                    index: number
                                                  ) => (
                                                    <Badge
                                                      key={index}
                                                      variant="secondary"
                                                      className="text-xs px-2 py-0.5"
                                                    >
                                                      {location}
                                                    </Badge>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>

                                      {/* Professional Background */}
                                      {avatarData.demographics
                                        ?.professional_backgrounds && (
                                          <AccordionItem
                                            value="professional-background"
                                            className="border-none"
                                          >
                                            <AccordionTrigger className="py-2 hover:no-underline">
                                              <div className="flex items-center gap-2">
                                                <Briefcase className="h-4 w-4 text-accent" />
                                                <span className="font-semibold text-foreground text-sm">
                                                  Professional Background
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2">
                                              <div className="flex flex-wrap gap-1">
                                                {avatarData.demographics.professional_backgrounds.map(
                                                  (bg: string, index: number) => (
                                                    <Badge
                                                      key={index}
                                                      variant="outline"
                                                      className="text-sm px-2 py-0.5"
                                                    >
                                                      {bg}
                                                    </Badge>
                                                  )
                                                )}
                                              </div>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )}

                                      {/* Identities */}
                                      {avatarData.demographics
                                        ?.typical_identities && (
                                          <AccordionItem
                                            value="identities"
                                            className="border-none"
                                          >
                                            <AccordionTrigger className="py-2 hover:no-underline">
                                              <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-accent" />
                                                <span className="font-semibold text-foreground text-sm">
                                                  Identities
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2">
                                              <div className="flex flex-wrap gap-1">
                                                {avatarData.demographics.typical_identities.map(
                                                  (
                                                    identity: string,
                                                    index: number
                                                  ) => (
                                                    <Badge
                                                      key={index}
                                                      variant="secondary"
                                                      className="text-sm px-2 py-0.5"
                                                    >
                                                      {identity}
                                                    </Badge>
                                                  )
                                                )}
                                              </div>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )}

                                      {/* Pain Points */}
                                      {avatarData.pain_points && (
                                        <AccordionItem
                                          value="pain-points"
                                          className="border-none"
                                        >
                                          <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex items-center gap-2">
                                              <AlertTriangle className="h-4 w-4 text-destructive" />
                                              <span className="font-semibold text-foreground text-sm">
                                                Pain Points
                                              </span>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="pt-2">
                                            <div className="space-y-2">
                                              {avatarData.pain_points
                                                .slice(0, 3)
                                                .map(
                                                  (
                                                    painPoint: any,
                                                    index: number
                                                  ) => (
                                                    <div
                                                      key={index}
                                                      className="bg-destructive/5 border border-destructive/20 p-2 rounded-lg"
                                                    >
                                                      <h6 className="font-medium text-foreground text-sm mb-1">
                                                        {painPoint.title}
                                                      </h6>
                                                      <ul className="space-y-0.5">
                                                        {painPoint.bullets
                                                          ?.slice(0, 2)
                                                          .map(
                                                            (
                                                              bullet: string,
                                                              bulletIndex: number
                                                            ) => (
                                                              <li
                                                                key={bulletIndex}
                                                                className="text-sm text-muted-foreground flex items-start gap-1"
                                                              >
                                                                <span className="text-destructive mt-0.5">
                                                                  •
                                                                </span>
                                                                <span className="break-words">
                                                                  {bullet}
                                                                </span>
                                                              </li>
                                                            )
                                                          )}
                                                      </ul>
                                                    </div>
                                                  )
                                                )}
                                            </div>
                                          </AccordionContent>
                                        </AccordionItem>
                                      )}

                                      {/* Goals */}
                                      {avatarData.goals && (
                                        <AccordionItem
                                          value="goals"
                                          className="border-none"
                                        >
                                          <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex items-center gap-2">
                                              <Star className="h-4 w-4 text-primary" />
                                              <span className="font-semibold text-foreground text-sm">
                                                Goals
                                              </span>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="pt-2">
                                            <div className="grid grid-cols-1 gap-2">
                                              <div>
                                                <h6 className="font-medium text-foreground text-sm mb-1">
                                                  Short Term
                                                </h6>
                                                <ul className="space-y-0.5">
                                                  {avatarData.goals.short_term
                                                    ?.slice(0, 2)
                                                    .map(
                                                      (
                                                        goal: string,
                                                        index: number
                                                      ) => (
                                                        <li
                                                          key={index}
                                                          className="text-sm text-muted-foreground flex items-start gap-1"
                                                        >
                                                          <span className="text-primary mt-0.5">
                                                            ✓
                                                          </span>
                                                          <span className="break-words">
                                                            {goal}
                                                          </span>
                                                        </li>
                                                      )
                                                    )}
                                                </ul>
                                              </div>
                                              <div>
                                                <h6 className="font-medium text-foreground text-sm mb-1">
                                                  Long Term
                                                </h6>
                                                <ul className="space-y-0.5">
                                                  {avatarData.goals.long_term
                                                    ?.slice(0, 2)
                                                    .map(
                                                      (
                                                        goal: string,
                                                        index: number
                                                      ) => (
                                                        <li
                                                          key={index}
                                                          className="text-sm text-muted-foreground flex items-start gap-1"
                                                        >
                                                          <span className="text-primary mt-0.5">
                                                            ✓
                                                          </span>
                                                          <span className="break-words">
                                                            {goal}
                                                          </span>
                                                        </li>
                                                      )
                                                    )}
                                                </ul>
                                              </div>
                                            </div>
                                          </AccordionContent>
                                        </AccordionItem>
                                      )}
                                    </Accordion>
                                  );
                                } catch (error) {
                                  return (
                                    <div className="bg-muted rounded-lg p-4">
                                      <pre className="text-sm whitespace-pre-wrap text-foreground">
                                        {fullResult.results.avatar_sheet}
                                      </pre>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        )}
                        {fullResult?.results?.marketing_angles && (
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold mb-4">
                              Marketing Angles
                            </h4>
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full space-y-3"
                              value={openMarketingAngle}
                              onValueChange={setOpenMarketingAngle}
                            >
                              {fullResult.results.marketing_angles.map(
                                (angle: string | Angle, index: number) => {
                                  const {
                                    angleObj,
                                    angleTitle,
                                    angleDescription,
                                    angleString,
                                  } = parseAngle(angle);
                                  const isGenerated =
                                    generatedAngles.has(angleString);
                                  const isGenerating =
                                    generatingAngles.has(angleString);
                                  const status = angleStatuses.get(angleString);
                                  const itemValue = `angle-${index}`;
                                  const isOpen = openMarketingAngle === itemValue;

                                  return (
                                    <AccordionItem
                                      key={index}
                                      value={itemValue}
                                      className="border-none"
                                    >
                                      <Card
                                        className={`p-0 transition-all hover:shadow-md cursor-pointer ${isGenerated
                                          ? "border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20"
                                          : "border border-border hover:border-primary/50"
                                          }`}
                                        onClick={() => {
                                          setOpenMarketingAngle(
                                            isOpen ? undefined : itemValue
                                          );
                                        }}
                                      >
                                        <div className="p-4">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1">
                                              <AngleStatusIcon
                                                isGenerated={isGenerated}
                                                isGenerating={isGenerating}
                                              />
                                              <div className="flex-1">
                                                {angleTitle && (
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge
                                                      variant="outline"
                                                      className="text-xs font-semibold bg-muted text-foreground border-border"
                                                    >
                                                      #{index + 1}
                                                    </Badge>
                                                    <h3 className="text-base font-semibold text-foreground">
                                                      {angleTitle}
                                                    </h3>
                                                  </div>
                                                )}
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {angleDescription}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {isGenerated && (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                                                >
                                                  Generated
                                                </Badge>
                                              )}
                                              {isGenerating && status && (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                                >
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
                                                  <h6 className="text-xs font-semibold text-foreground uppercase mb-1">
                                                    Target Age Range
                                                  </h6>
                                                  <p className="text-sm text-muted-foreground">
                                                    {angleObj.target_age_range}
                                                  </p>
                                                </div>
                                              )}
                                              {angleObj?.target_audience && (
                                                <div>
                                                  <h6 className="text-xs font-semibold text-foreground uppercase mb-1">
                                                    Target Audience
                                                  </h6>
                                                  <p className="text-sm text-muted-foreground">
                                                    {angleObj.target_audience}
                                                  </p>
                                                </div>
                                              )}
                                              <AngleListSection
                                                title="Pain Points"
                                                items={angleObj?.pain_points}
                                              />
                                              <AngleListSection
                                                title="Desires"
                                                items={angleObj?.desires}
                                              />
                                              <AngleListSection
                                                title="Common Objections"
                                                items={
                                                  angleObj?.common_objections
                                                }
                                              />
                                              <AngleListSection
                                                title="Failed Alternatives"
                                                items={
                                                  angleObj?.failed_alternatives
                                                }
                                              />
                                              <AngleListSection
                                                title="Copy Approach"
                                                items={angleObj?.copy_approach}
                                              />
                                            </div>
                                          )}
                                          <div className="flex justify-end pt-4 border-t border-border/50 mt-4">
                                            <Button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                if (
                                                  !originalJobId ||
                                                  isGenerated ||
                                                  isGenerating
                                                )
                                                  return;

                                                // Add to generating map
                                                updateGeneratingAngle(
                                                  angleString,
                                                  "pending"
                                                );
                                                updateAngleStatus(
                                                  angleString,
                                                  "SUBMITTED"
                                                );

                                                // Find the correct angle and avatar IDs from fullResult
                                                const { angleId, avatarId } = findAngleAndAvatarIds(angleString);
                                                
                                                if (!angleId || !avatarId) {
                                                  showError(
                                                    new Error("Could not find angle or avatar IDs"),
                                                    "Failed to generate pre-landers. Please try again."
                                                  );
                                                  removeGeneratingAngle(angleString);
                                                  removeAngleStatus(angleString);
                                                  return;
                                                }

                                                try {

                                                  const data =
                                                    (await internalApiClient.generateSwipeFiles(
                                                      {
                                                        original_job_id:
                                                          originalJobId,
                                                        angle_id: angleId, // Use the actual angle ID, not the descriptive string
                                                        avatar_id: avatarId, // Use the actual avatar ID, not 'default'
                                                      }
                                                    )) as { jobId?: string };

                                                  // Track this angle as generating
                                                  if (data.jobId) {
                                                    updateGeneratingAngle(
                                                      angleString,
                                                      data.jobId
                                                    );
                                                    // Start polling for this specific angle
                                                    pollSwipeFileStatus(
                                                      data.jobId,
                                                      angleString
                                                    );
                                                  }
                                                } catch (error: any) {
                                                  if (error.status === 402 && (error as any).code === "JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED") {
                                                    // Show toast notification about overage
                                                    const overageCredits = (error as any).overageCredits ?? 0;
                                                    const overageCostTotal = (error as any).overageCostTotal ?? 0;
                                                    const currency = (error as any).currency ?? "EUR";
                                                    
                                                    toast({
                                                      title: "Overage Charges Apply",
                                                      description: `This job requires ${overageCredits} extra credit${overageCredits === 1 ? '' : 's'}. Overage charges will be added to your next invoice.`,
                                                      variant: "default",
                                                    });

                                                    // Automatically retry with allowOverage=true
                                                    try {
                                                      const retryData = await internalApiClient.generateSwipeFiles({
                                                        original_job_id: originalJobId,
                                                        angle_id: angleId,
                                                        avatar_id: avatarId,
                                                        allowOverage: true,
                                                      }) as { jobId?: string };
                                                      
                                                      if (retryData.jobId) {
                                                        updateGeneratingAngle(
                                                          angleString,
                                                          retryData.jobId
                                                        );
                                                        pollSwipeFileStatus(
                                                          retryData.jobId,
                                                          angleString
                                                        );
                                                      }
                                                    } catch (retryError: any) {
                                                      toast({
                                                        title: "Error",
                                                        description: retryError.message || "Failed to generate pre-landers",
                                                        variant: "destructive",
                                                      });
                                                      // Only remove generating state if retry FAILED
                                                      removeGeneratingAngle(angleString);
                                                      removeAngleStatus(angleString);
                                                    }
                                                  } else {
                                                    logger.error(
                                                      "Error generating pre-landers:",
                                                      error
                                                    );
                                                    // Remove from generating map on error
                                                    removeGeneratingAngle(
                                                      angleString
                                                    );
                                                    removeAngleStatus(angleString);

                                                    // Show user-friendly error message
                                                    showError(
                                                      error,
                                                      "Failed to generate pre-landers. Please try again."
                                                    );
                                                  }
                                                }
                                              }}
                                              disabled={
                                                !originalJobId ||
                                                isGenerated ||
                                                isGenerating
                                              }
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
                                                "Generate Pre-Landers"
                                              )}
                                            </Button>
                                          </div>
                                        </AccordionContent>
                                      </Card>
                                    </AccordionItem>
                                  );
                                }
                              )}
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

      {/* Static Ads Generation */}
      {fullResult?.results?.marketing_angles &&
        fullResult.results.marketing_angles.length > 0 && (
          <GenerateStaticAds
            originalJobId={jobId || ""}
            marketingAngles={fullResult.results.marketing_angles}
            selectedAvatar={customerAvatars?.[0] || null}
            foundationalDocText={fullResult?.results?.deep_research_output}
          />
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
                            } catch (error: any) {
                              if (error.status === 402 && (error as any).code === "JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED") {
                                setPendingSwipeOverage({
                                  overageCredits: (error as any).overageCredits ?? 0,
                                  overageCostPerCredit: (error as any).overageCostPerCredit ?? 0.5,
                                  overageCostTotal: (error as any).overageCostTotal ?? 0,
                                  currency: (error as any).currency ?? "EUR",
                                  payload: {
                                    original_job_id: originalJobId,
                                    select_angle: selectedAngle,
                                    allowOverage: true,
                                  },
                                  angleKey: selectedAngle,
                                });
                                setShowSwipeOverageDialog(true);

                                setGeneratingAngles(prev => {
                                  const newMap = new Map(prev)
                                  newMap.delete(selectedAngle)
                                  return newMap
                                })
                              } else {
                                console.error('Error generating pre-landers:', error);
                                // Remove from generating map on error
                                setGeneratingAngles(prev => {
                                  const newMap = new Map(prev)
                                  newMap.delete(selectedAngle)
                                  return newMap
                                })

                                // Show user-friendly error message
                                showError(error, 'Failed to generate pre-landers. Please try again.');
                              }
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

      {/* Generated Pre-landers */}
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
                      <h2 className="text-2xl font-bold text-foreground">
                        Generated Pre-landers
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Generated marketing templates and angles
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-8 pb-8 border-t border-border/50 pt-6">
                  {templatesLoading ? (
                    <div className="flex justify-center">
                      {Array.from({ length: 1 }).map((_, index) => (
                        <Card
                          key={`skeleton-${index}`}
                          className="group p-0 overflow-hidden transition-all duration-200 flex flex-col h-full border-border/50 animate-pulse-subtle w-full max-w-md"
                        >
                          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                            {/* Preview Section Skeleton */}
                            <div className="relative h-48 bg-muted overflow-hidden border-b border-border/50">
                              <div className="absolute inset-0 bg-muted/50"></div>
                            </div>
                            {/* Content Section Skeleton */}
                            <div className="p-5 flex flex-col flex-1 min-h-0">
                              <div className="flex-1 space-y-2">
                                {/* Badges Skeleton */}
                                <div className="flex items-center gap-2 flex-wrap justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-5 w-16 bg-muted rounded-full"></div>
                                    <div className="h-5 w-20 bg-muted rounded-full"></div>
                                  </div>
                                  <div className="h-6 w-6 bg-muted rounded"></div>
                                </div>
                                {/* Title Skeleton */}
                                <div className="flex items-center gap-2">
                                  <div className="h-5 w-8 bg-muted rounded-full"></div>
                                  <div className="h-6 w-3/4 bg-muted rounded"></div>
                                </div>
                                {/* Description Skeleton */}
                                <div className="space-y-1.5">
                                  <div className="h-4 w-full bg-muted rounded"></div>
                                  <div className="h-4 w-2/3 bg-muted rounded"></div>
                                </div>
                                {/* Date Skeleton */}
                                <div className="flex items-center gap-1.5 pt-2">
                                  <div className="h-3.5 w-3.5 bg-muted rounded"></div>
                                  <div className="h-3.5 w-20 bg-muted rounded"></div>
                                  <div className="h-3.5 w-3.5 bg-muted rounded ml-1"></div>
                                  <div className="h-3.5 w-16 bg-muted rounded"></div>
                                </div>
                              </div>
                              {/* Action Buttons Skeleton */}
                              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                <div className="h-9 flex-1 bg-muted rounded"></div>
                                <div className="h-9 flex-1 bg-muted rounded"></div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : templates.length === 0 && generatingAngles.size === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        No templates generated yet. {isV2 ? 'Click "Explore More Templates" below to get started.' : 'Select a marketing angle above to generate templates.'}
                      </p>
                      {/* Explore More Templates Button for V2 jobs */}
                      {isV2 && (
                        <div className="mt-4">
                          <Button
                            onClick={() => setShowExploreTemplatesV2(true)}
                            disabled={availableTemplatesLoading}
                            size="lg"
                            className="w-full"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Explore More Templates ({JOB_CREDITS_BY_TYPE.pre_lander} Credits per angle)
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Coming Soon Feature Banner */}
                      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-center gap-3">
                        <div className="flex-shrink-0">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          {/* <p className="text-sm font-medium text-foreground">
                            Direct Export Integration is Coming..!
                          </p> */}
                          {/*<p className="text-xs text-muted-foreground mt-0.5">
                            We're working on a new feature to export your pre-landers directly to your favorite platforms.
                          </p>*/}
                        </div>
                      </div>

                      {generatingAngles.size > 0 && (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">
                            Generating templates for {generatingAngles.size}{" "}
                            angle{generatingAngles.size > 1 ? "s" : ""}...
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 id="generated-prelanders" className="text-lg font-semibold">
                            Generated Pre-landers
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Type Filter */}
                          {templates.length > 0 && (
                            <div className="w-[180px] min-w-0 max-w-[180px]">
                              <Select
                                value={selectedTypeFilter}
                                onValueChange={setSelectedTypeFilter}
                              >
                                <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(180px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                  <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  <SelectItem value="advertorial">
                                    Advertorial
                                  </SelectItem>
                                  <SelectItem value="listicle">
                                    Listical
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {/* Angle Filter */}
                          {(() => {
                            // If V2 and avatar is selected, get angles from that avatar (no grouping needed)
                            if (isV2 && selectedAvatarFilter !== "all" && fullResult?.results?.marketing_avatars) {
                              const avatarIndex = parseInt(selectedAvatarFilter);
                              if (!isNaN(avatarIndex) && fullResult.results.marketing_avatars[avatarIndex]) {
                                const avatarData = fullResult.results.marketing_avatars[avatarIndex];
                                const angles = avatarData.angles?.generated_angles || [];
                                
                                // Sort angles by overall_score (descending), preserving original data
                                const sortedAngles = [...angles]
                                  .map((angle: any) => ({
                                    angle,
                                    angleString: angle.angle_subtitle
                                      ? `${angle.angle_title}: ${angle.angle_subtitle}`
                                      : angle.angle_title
                                  }))
                                  .sort((a: any, b: any) => {
                                    const scoreA = a.angle.overall_score ?? 0;
                                    const scoreB = b.angle.overall_score ?? 0;
                                    return scoreB - scoreA; // Descending order (highest score first)
                                  });

                                if (sortedAngles.length > 0) {
                                  return (
                                    <div className="w-[220px] min-w-0 max-w-[220px]">
                                      <Select
                                        value={selectedAngleFilter}
                                        onValueChange={setSelectedAngleFilter}
                                      >
                                        <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(220px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                          <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                                          <SelectValue placeholder="Filter by angle" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                          <SelectItem value="all">
                                            All Angles
                                          </SelectItem>
                                          {sortedAngles.map((item, index) => {
                                            const angle = item.angleString;
                                            // Handle "Title: Description" format
                                            const displayText = angle.includes(": ") 
                                              ? angle.split(": ")[0] 
                                              : angle;
                                            const truncated = displayText.length > 35
                                              ? displayText.substring(0, 32) + "..."
                                              : displayText;
                                            
                                            return (
                                              <SelectItem key={angle} value={angle}>
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs font-semibold mr-2 bg-muted text-foreground border-border"
                                                >
                                                  #{index + 1}
                                                </Badge>
                                                {truncated}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                }
                              }
                            } else if (isV2 && fullResult?.results?.marketing_avatars) {
                              // V2 - group angles by avatar
                              // Get avatars for display names
                              let avatarsToDisplay: TransformedAvatar[] | undefined = customerAvatars as TransformedAvatar[] | undefined;
                              if ((!avatarsToDisplay || avatarsToDisplay.length === 0) && (fullResult as DeepCopyResult)?.results?.marketing_avatars) {
                                avatarsToDisplay = transformV2ToExistingSchema(fullResult as DeepCopyResult);
                              }

                              // Sort avatars by intensity (highest first), preserving original index
                              const sortedAvatarsWithData = [...fullResult.results.marketing_avatars]
                                .map((avatarData: any, originalIndex: number) => ({
                                  avatarData,
                                  originalIndex,
                                  intensity: avatarsToDisplay?.[originalIndex]?.v2_avatar_data?.overview?.intensity || 0
                                }))
                                .sort((a, b) => b.intensity - a.intensity); // Descending order (highest first)

                              // Build grouped angles structure
                              const groupedAngles: Array<{
                                avatarIndex: number;
                                avatarName: string;
                                angles: Array<{ angleString: string; angleTitle: string }>;
                              }> = [];

                              sortedAvatarsWithData.forEach(({ avatarData, originalIndex }) => {
                                const angles = avatarData.angles?.generated_angles || [];
                                if (angles.length > 0) {
                                  const avatarName = avatarsToDisplay?.[originalIndex]?.v2_avatar_data?.overview?.name || 
                                                    avatarsToDisplay?.[originalIndex]?.persona_name || 
                                                    avatarData.avatar?.name || 
                                                    `Avatar ${originalIndex + 1}`;
                                  
                                  // Sort angles by overall_score (descending)
                                  const sortedAngles = [...angles]
                                    .sort((a: any, b: any) => {
                                      const scoreA = a.overall_score ?? 0;
                                      const scoreB = b.overall_score ?? 0;
                                      return scoreB - scoreA; // Descending order (highest score first)
                                    });

                                  const angleList = sortedAngles.map((angle: any) => {
                                    const angleString = angle.angle_subtitle
                                      ? `${angle.angle_title}: ${angle.angle_subtitle}`
                                      : angle.angle_title;
                                    return {
                                      angleString,
                                      angleTitle: angle.angle_title
                                    };
                                  });

                                  groupedAngles.push({
                                    avatarIndex: originalIndex,
                                    avatarName,
                                    angles: angleList
                                  });
                                }
                              });

                              if (groupedAngles.length > 0) {
                                return (
                                  <div className="w-[220px] min-w-0 max-w-[220px]">
                                    <Select
                                      value={selectedAngleFilter}
                                      onValueChange={setSelectedAngleFilter}
                                    >
                                      <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(220px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                        <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <SelectValue placeholder="Filter by angle" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[300px]">
                                        <SelectItem value="all">
                                          All Angles
                                        </SelectItem>
                                        {groupedAngles.map((group, groupIndex) => (
                                          <SelectGroup key={group.avatarIndex}>
                                            {groupIndex > 0 && <SelectSeparator />}
                                            <SelectLabel className="font-semibold text-xs text-muted-foreground">
                                              {group.avatarName}
                                            </SelectLabel>
                                            {group.angles.map((angle, angleIndex) => {
                                              const displayText = angle.angleString.includes(": ") 
                                                ? angle.angleString.split(": ")[0] 
                                                : angle.angleString;
                                              const truncated = displayText.length > 35
                                                ? displayText.substring(0, 32) + "..."
                                                : displayText;
                                              
                                              return (
                                                <SelectItem key={angle.angleString} value={angle.angleString}>
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs font-semibold mr-2 bg-muted text-foreground border-border"
                                                  >
                                                    #{angleIndex + 1}
                                                  </Badge>
                                                  {truncated}
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectGroup>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              }
                            } else {
                              // V1 - show all unique angles from templates (flat list)
                              const uniqueAngles = Array.from(
                                new Set(
                                  templates
                                    .map(t => t.angle)
                                    .filter((angle): angle is string => !!angle)
                                )
                              );

                              if (uniqueAngles.length > 0) {
                                return (
                                  <div className="w-[220px] min-w-0 max-w-[220px]">
                                    <Select
                                      value={selectedAngleFilter}
                                      onValueChange={setSelectedAngleFilter}
                                    >
                                      <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(220px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                        <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <SelectValue placeholder="Filter by angle" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[300px]">
                                        <SelectItem value="all">
                                          All Angles
                                        </SelectItem>
                                        {uniqueAngles.map((angle, index) => {
                                          // Handle "Title: Description" format
                                          const displayText = angle.includes(": ") 
                                            ? angle.split(": ")[0] 
                                            : angle;
                                          const truncated = displayText.length > 35
                                            ? displayText.substring(0, 32) + "..."
                                            : displayText;
                                          
                                          return (
                                            <SelectItem key={angle} value={angle}>
                                              <Badge
                                                variant="outline"
                                                className="text-xs font-semibold mr-2 bg-muted text-foreground border-border"
                                              >
                                                #{index + 1}
                                              </Badge>
                                              {truncated}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                          {/* Avatar Filter - Only for V2 */}
                          {isV2 && (() => {
                            // Get avatars from V2 data
                            let avatarsToDisplay: TransformedAvatar[] | undefined = customerAvatars as TransformedAvatar[] | undefined;
                            if ((!avatarsToDisplay || avatarsToDisplay.length === 0) && (fullResult as DeepCopyResult)?.results?.marketing_avatars) {
                              avatarsToDisplay = transformV2ToExistingSchema(fullResult as DeepCopyResult);
                            }

                            if (avatarsToDisplay && avatarsToDisplay.length > 0) {
                              // Sort avatars by intensity (highest first), preserving original index
                              const sortedAvatars = [...avatarsToDisplay]
                                .map((avatar, originalIndex) => ({
                                  ...avatar,
                                  _originalIndex: originalIndex
                                }))
                                .sort((a, b) => {
                                  const aIntensity = a.v2_avatar_data?.overview?.intensity || 0;
                                  const bIntensity = b.v2_avatar_data?.overview?.intensity || 0;
                                  return bIntensity - aIntensity; // Descending order (highest first)
                                });

                              return (
                                <div className="w-[200px] min-w-0 max-w-[200px]">
                                  <Select
                                    value={selectedAvatarFilter}
                                    onValueChange={(value) => {
                                      setSelectedAvatarFilter(value);
                                      // Reset angle filter when avatar changes
                                      setSelectedAngleFilter("all");
                                    }}
                                  >
                                    <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(200px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                      <User className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <SelectValue placeholder="Filter by avatar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Avatars</SelectItem>
                                      {sortedAvatars.map((avatar, displayIndex) => {
                                        // Get avatar name from v2_avatar_data if available, otherwise use persona_name
                                        const avatarName = avatar.v2_avatar_data?.overview?.name || avatar.persona_name || `Avatar ${avatar._originalIndex + 1}`;
                                        
                                        return (
                                          <SelectItem key={avatar._originalIndex} value={avatar._originalIndex.toString()}>
                                            <Badge
                                              variant="outline"
                                              className="text-xs font-semibold mr-2 bg-muted text-foreground border-border"
                                            >
                                              #{displayIndex + 1}
                                            </Badge>
                                            {avatarName}
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
                          // Filter templates by selected angle, type, and avatar
                          let filteredTemplates = filterTemplates(
                            templates,
                            selectedAngleFilter,
                            selectedTypeFilter,
                            selectedAvatarFilter
                          );

                          // Sort templates by angle index to group same angles together and maintain order
                          filteredTemplates = [...filteredTemplates].sort(
                            (a, b) => {
                              // Helper to find angle index in marketing_angles array
                              const getAngleIndex = (
                                templateAngle: string | undefined
                              ): number => {
                                if (
                                  !templateAngle ||
                                  !fullResult?.results?.marketing_angles
                                )
                                  return 999;

                                return fullResult.results.marketing_angles.findIndex(
                                  (ma: any) => {
                                    if (typeof ma === "string") {
                                      return ma === templateAngle;
                                    }
                                    // Extract description from template.angle if it's in "Title: Description" format
                                    let templateAngleDesc = templateAngle;
                                    if (templateAngle.includes(": ")) {
                                      const parts = templateAngle.split(": ");
                                      if (parts.length >= 2) {
                                        templateAngleDesc = parts[1];
                                      }
                                    }
                                    return (
                                      ma.angle === templateAngleDesc ||
                                      ma.angle === templateAngle
                                    );
                                  }
                                );
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
                              const idA = a.templateId || "";
                              const idB = b.templateId || "";
                              return idA.localeCompare(idB);
                            }
                          );

                          if (filteredTemplates.length === 0 && generatingAngles.size === 0) {
                            return (
                              <div className="col-span-full text-center py-12">
                                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                  {selectedAngleFilter !== "all" ||
                                    selectedTypeFilter !== "all"
                                    ? "No templates found for the selected filters."
                                    : "No templates found for the selected angle."}
                                </p>
                              </div>
                            );
                          }

                          return filteredTemplates.map((template) => (
                            <Card
                              key={template.id || `${template.angle}-${template.templateId}-${template.timestamp}`}
                              className="group p-0 overflow-hidden transition-all duration-200 flex flex-col h-full border-border/50 hover:border-primary/50"
                            >
                              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                                {/* Preview Section */}
                                <div className="relative h-48 bg-background overflow-hidden border-b border-border/50">
                                  <div className="absolute inset-0 overflow-hidden">
                                    <iframe
                                      key={`preview-${template.id || template.name}-${template.angle || ""}`}
                                      srcDoc={
                                        templateIframeHTML[
                                        `${template.name}-${template.angle || ""
                                        }`
                                        ]
                                      }
                                      className="w-full h-full"
                                      style={{
                                        border: "none",
                                        transform: "scale(0.3)",
                                        transformOrigin: "top left",
                                        width: "333.33%",
                                        height: "333.33%",
                                        pointerEvents: "none",
                                      }}
                                      sandbox="allow-scripts"
                                      title={`Preview of ${getAngleTitle(
                                        template.angle,
                                        template.name
                                      )}`}
                                    />
                                  </div>
                                  {/* Active image generation indicator */}
                                  {template.id && activeImageJobs.has(template.id) && (
                                    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-primary/90 to-primary/70 px-3 py-2">
                                      <div className="flex items-center gap-2 text-primary-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span className="text-xs font-medium">Generating images...</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Content Section */}
                                <div className="p-5 flex flex-col flex-1 min-h-0">
                                  <div className="flex-1">
                                    {(() => {
                                      // Find the matching marketing angle to get its index
                                      let angleIndex = -1;
                                      let avatarBasedNumber = "";
                                      const templateAngle = template.angle;

                                      if (isV2 && fullResult?.results?.marketing_avatars && templateAngle) {
                                        // V2 logic - find avatar and angle indices
                                        for (let avIdx = 0; avIdx < fullResult.results.marketing_avatars.length; avIdx++) {
                                          const avatar = fullResult.results.marketing_avatars[avIdx];
                                          const angles = avatar.angles?.generated_angles || [];
                                          const foundAngleIdx = angles.findIndex((a: any) => {
                                            const angleFormatted = a.angle_subtitle 
                                              ? `${a.angle_title}: ${a.angle_subtitle}` 
                                              : a.angle_title;
                                            return angleFormatted === templateAngle || a.angle_title === templateAngle;
                                          });
                                          if (foundAngleIdx !== -1) {
                                            angleIndex = foundAngleIdx;
                                            avatarBasedNumber = getAvatarBasedNumber(avIdx, foundAngleIdx);
                                            break;
                                          }
                                        }
                                      } else if (
                                        fullResult?.results?.marketing_angles &&
                                        templateAngle
                                      ) {
                                        const matchingIndex =
                                          fullResult.results.marketing_angles.findIndex(
                                            (ma: any) => {
                                              if (typeof ma === "string") {
                                                return ma === templateAngle;
                                              }
                                              // Extract description from template.angle if it's in "Title: Description" format
                                              let templateAngleDesc =
                                                templateAngle;
                                              if (
                                                templateAngle.includes(": ")
                                              ) {
                                                const parts =
                                                  templateAngle.split(": ");
                                                if (parts.length >= 2) {
                                                  templateAngleDesc = parts[1];
                                                }
                                              }
                                              return (
                                                ma.angle ===
                                                templateAngleDesc ||
                                                ma.angle === templateAngle
                                              );
                                            }
                                          );
                                        if (matchingIndex >= 0) {
                                          angleIndex = matchingIndex;
                                        }
                                      }

                                      const fileType = getFileType(
                                        template.templateId,
                                        advertorialType
                                      );

                                      return (
                                        <div className="space-y-2">
                                          {/* Number Badge and File Type */}
                                          <div className="flex items-center gap-2 flex-wrap justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {/*angleIndex >= 0 && (
                                                <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border w-fit">
                                                  #{angleIndex + 1}
                                                </Badge>
                                              )*/}
                                              <Badge
                                                variant="outline"
                                                className="text-xs font-semibold bg-primary/10 text-primary border-primary/20 w-fit"
                                              >
                                                {formatFileType(fileType)}
                                              </Badge>
                                              {template.swipe_file_name && template.swipe_file_name.trim() !== '' && (
                                                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30">
                                                  {template.swipe_file_name}
                                                </Badge>
                                              )}
                                            </div>
                                            {template.id && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteTemplate(template.id!, template.angle || template.name)}
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                          {/* Title with Icon */}
                                          <div className="flex items-center gap-2">
                                            {/*angleIndex >= 0 && (
                                              <div className="bg-primary/10 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                                                <Target className="h-4 w-4 text-primary" />
                                              </div>
                                            )*/}
                                            <h4 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors flex-1">
                                              <span className="text-lg font-bold text-primary">
                                                {avatarBasedNumber ? `${avatarBasedNumber}. ` : (angleIndex >= 0 ? `${angleIndex + 1}. ` : '')}
                                              </span>
                                              {getAngleTitle(
                                                template.angle,
                                                template.name
                                              )}
                                            </h4>
                                          </div>
                                          {/* Description */}
                                          {template.angle && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                              {getAngleDescription(
                                                template.angle
                                              )}
                                            </p>
                                          )}
                                          {/* Creation Date and Time */}
                                          {template.timestamp && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
                                              <Calendar className="h-3.5 w-3.5" />
                                              <span>
                                                {new Date(
                                                  template.timestamp
                                                ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                })}
                                              </span>
                                              <Clock className="h-3.5 w-3.5 ml-1" />
                                              <span>
                                                {new Date(
                                                  template.timestamp
                                                ).toLocaleTimeString("en-US", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  hour12: true,
                                                })}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                    {/* Download Button - Commented out */}
                                    {/* <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const content = template.html;
                                        // Check if content already has proper HTML structure with Tailwind
                                        const hasTailwindCDN = /cdn\.tailwindcss\.com/i.test(content);
                                        const hasDoctype = content.includes('<!DOCTYPE html>');
                                        
                                        let finalContent = content;
                                        
                                        // If content doesn't have proper structure or Tailwind, wrap it
                                        if (!hasDoctype || !hasTailwindCDN) {
                                          // Extract body content - handle both cases:
                                          // 1. Proper HTML with <body> tag
                                          // 2. Malformed HTML starting with <style> tag (backward compatible)
                                          const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                                          let bodyContent: string;
                                          
                                          if (bodyMatch) {
                                            // Case 1: Has <body> tag - extract its content
                                            bodyContent = bodyMatch[1];
                                          } else {
                                            // Case 2: No <body> tag - find content after <style> tag
                                            const styleTagMatch = content.match(/<\/style>/i);
                                            if (styleTagMatch && styleTagMatch.index !== undefined) {
                                              // Content starts after </style> tag
                                              bodyContent = content.substring(styleTagMatch.index + styleTagMatch[0].length).trim();
                                            } else {
                                              // No style tag either - look for first HTML element
                                              const contentPatterns = [
                                                /<div[^>]*>/i,
                                                /<section[^>]*>/i,
                                                /<header[^>]*>/i,
                                                /<main[^>]*>/i,
                                                /<article[^>]*>/i
                                              ];
                                              
                                              let found = false;
                                              for (const pattern of contentPatterns) {
                                                const match = content.match(pattern);
                                                if (match && match.index !== undefined) {
                                                  bodyContent = content.substring(match.index).trim();
                                                  found = true;
                                                  break;
                                                }
                                              }
                                              
                                              if (!found) {
                                                // Last resort: use whole content
                                                bodyContent = content;
                                              }
                                            }
                                          }
                                          
                                          // Extract existing stylesheets and scripts from head
                                          const stylesheetLinks = content.match(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi) || [];
                                          const scriptTags = content.match(/<script[^>]*src\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi) || [];
                                          
                                          // Extract inline CSS from <style> tags
                                          const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
                                          const inlineCSS = styleMatches.map((m: string) => {
                                            const cssMatch = m.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
                                            return cssMatch ? cssMatch[1] : '';
                                          }).join('\n\n');
                                          
                                          // Extract title
                                          const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                                          const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Template';
                                          
                                          // Build proper HTML document
                                          finalContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
${stylesheetLinks.map((link: string) => `  ${link}`).join('\n')}
${scriptTags.filter((tag: string) => !tag.includes('tailwindcss')).map((tag: string) => `  ${tag}`).join('\n')}
${inlineCSS ? `  <style>\n${inlineCSS}\n  </style>` : ''}
</head>
<body>
${bodyContent}
</body>
</html>`;
                                        }
                                        
                                        const blob = new Blob([finalContent], {
                                          type: "text/html;charset=utf-8",
                                        });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `${template.name
                                          .replace(/[^a-z0-9]/gi, "_")
                                          .toLowerCase()}.html`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="flex-1"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </Button> */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // template.html is already a complete HTML document
                                        const templateKey = `${template.id || template.name}-${template.angle || ''}`;
                                        handleCopyHTML(template.html, templateKey);
                                      }}
                                      className="flex-1"
                                    >
                                      {copiedTemplateId === `${template.id || template.name}-${template.angle || ''}` ? (
                                        <>
                                          <Check className="h-4 w-4 mr-2" />
                                          Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-4 w-4 mr-2" />
                                          Copy
                                        </>
                                      )}
                                    </Button>
                                    {template.id && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          window.open(`/editor/${template.id}`, '_blank')
                                        }}
                                        className="flex-1"
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </Button>
                                    )}
                                    <Dialog
                                      onOpenChange={(open) => {
                                        const templateKey = `${template.name}-${template.angle || ''}`
                                        // Show floater when preview opens for new templates
                                        if (open && template.templateId && NEW_TEMPLATE_IDS.some(baseId => template.templateId?.startsWith(baseId))) {
                                          setShowImageGenFloater(prev => ({ ...prev, [templateKey]: true }))
                                        } else {
                                          setShowImageGenFloater(prev => ({ ...prev, [templateKey]: false }))
                                        }
                                      }}
                                    >
                                      <DialogTrigger asChild>
                                        <Button className="flex-1" size="sm">
                                          <Eye className="h-4 w-4 mr-2" />
                                          Preview
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden p-2">
                                        <DialogHeader className="pb-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                          <DialogTitle className="text-xl font-bold">
                                            {getAngleTitle(
                                              template.angle,
                                              template.name
                                            )}
                                          </DialogTitle>
                                          <DialogDescription>
                                            {template.timestamp
                                              ? new Date(
                                                template.timestamp
                                              ).toLocaleString()
                                              : "Generated"}
                                          </DialogDescription>
                                            </div>
                                          </div>
                                        </DialogHeader>
                                        <div className="h-[calc(98vh-120px)] border rounded-lg bg-background overflow-auto relative">
                                          {/* Floating button for image generation */}
                                          {showImageGenFloater[`${template.name}-${template.angle || ''}`] && (
                                            <ImageGenerationFloater
                                              onYes={() => {
                                                const templateKey = `${template.name}-${template.angle || ''}`
                                                setShowImageGenFloater(prev => ({ ...prev, [templateKey]: false }))
                                                setPreviewImageGenDialogOpen(prev => ({ ...prev, [templateKey]: true }))
                                              }}
                                              onNo={() => {
                                                const templateKey = `${template.name}-${template.angle || ''}`
                                                setShowImageGenFloater(prev => ({ ...prev, [templateKey]: false }))
                                              }}
                                            />
                                          )}
                                          <iframe
                                            key={`preview-iframe-${template.name}-${template.angle || ''}-${template.html.substring(0, 50)}`}
                                            srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${template.html}
</body>
</html>`}
                                            className="w-full h-full"
                                            sandbox="allow-scripts"
                                            style={{
                                              border: "none",
                                              width: "100%",
                                              height: "100%",
                                            }}
                                          />
                                        </div>
                                      </DialogContent>
                                    </Dialog>

                                    {(() => {
                                      const templateKey = `${template.name}-${template.angle || ''}`
                                      return (
                                        <>
                                          {template.templateId && NEW_TEMPLATE_IDS.some(baseId => template.templateId?.startsWith(baseId)) ? (
                                            <TemplateImageGenerationDialog
                                              isOpen={previewImageGenDialogOpen[templateKey] || false}
                                              onClose={() => setPreviewImageGenDialogOpen(prev => ({ ...prev, [templateKey]: false }))}
                                              templateId={template.templateId}
                                              injectedTemplateId={template.id || ''}
                                              configData={(template as any).config_data || {}}
                                              onImagesGenerated={async (images) => {
                                                // Replace images in HTML using utility function
                                                let updatedHtml = template.html
                                                updatedHtml = replaceTemplateImagesInHTML(updatedHtml, images, template.templateId)

                                                // Save to database
                                                if (template.id) {
                                                  try {
                                                    const authHeaders = getAuthorizationHeader()
                                                    const response = await fetch(`/api/templates/injected/${template.id}`, {
                                                      method: 'PATCH',
                                                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                                                      body: JSON.stringify({ html: updatedHtml }),
                                                    })
                                                    
                                                    if (!response.ok) {
                                                      console.warn('Failed to save updated HTML to database')
                                                    }
                                                  } catch (error) {
                                                    console.warn('Error saving updated HTML:', error)
                                                  }
                                                }

                                                // Update the template's HTML in state
                                                setTemplates((prev) =>
                                                  prev.map((t) =>
                                                    t.name === template.name && t.angle === template.angle
                                                      ? { ...t, html: updatedHtml }
                                                      : t
                                                  )
                                                )
                                                toast({
                                                  title: "Images generated",
                                                  description: `Successfully generated ${images.length} image${images.length !== 1 ? "s" : ""}. Preview updated.`,
                                                })
                                              }}
                                            />
                                          ) : (
                                          <PrelanderImageGenerationDialog
                                            isOpen={previewImageGenDialogOpen[templateKey] || false}
                                            onClose={() => setPreviewImageGenDialogOpen(prev => ({ ...prev, [templateKey]: false }))}
                                            html={template.html}
                                            jobId={jobId}
                                            onImagesGenerated={(count, updatedHtml) => {
                                              // Update the template's HTML in state
                                              setTemplates((prev) =>
                                                prev.map((t) =>
                                                  t.name === template.name && t.angle === template.angle
                                                    ? { ...t, html: updatedHtml }
                                                    : t
                                                )
                                              )
                                              toast({
                                                title: "Images generated",
                                                description: `Successfully generated ${count} image${count !== 1 ? "s" : ""}. Preview updated.`,
                                              })
                                            }}
                                          />
                                          )}
                                        </>
                                      )
                                    })()}
                                    {(() => {
                                      // Calculate angleIndex for this template
                                      let angleIndex = -1;
                                      const templateAngle = template.angle;
                                      if (
                                        fullResult?.results?.marketing_angles &&
                                        templateAngle
                                      ) {
                                        const matchingIndex =
                                          fullResult.results.marketing_angles.findIndex(
                                            (ma: any) => {
                                              if (typeof ma === "string") {
                                                return ma === templateAngle;
                                              }
                                              let templateAngleDesc = templateAngle;
                                              if (templateAngle.includes(": ")) {
                                                const parts = templateAngle.split(": ");
                                                if (parts.length >= 2) {
                                                  templateAngleDesc = parts[1];
                                                }
                                              }
                                              return (
                                                ma.angle === templateAngleDesc ||
                                                ma.angle === templateAngle
                                              );
                                            }
                                          );
                                        if (matchingIndex >= 0) {
                                          angleIndex = matchingIndex;
                                        }
                                      }

                                      return null; // Image generation is now handled via dialog when viewing preview/editor
                                    })()}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ));
                        })()}
                        {/* Skeleton loaders for generating angles */}
                        {Array.from({ length: generatingAngles.size }).map(
                          (_, i) => (
                            <Card
                              key={`skeleton-generating-${i}`}
                              className="group p-0 overflow-hidden transition-all duration-200 flex flex-col h-full border-border/50 animate-pulse-subtle"
                            >
                              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                                {/* Preview Section Skeleton */}
                                <div className="relative h-48 bg-muted overflow-hidden border-b border-border/50">
                                  <div className="absolute inset-0 bg-muted/50"></div>
                                </div>
                                {/* Content Section Skeleton */}
                                <div className="p-5 flex flex-col flex-1 min-h-0">
                                  <div className="flex-1 space-y-2">
                                    {/* Badges Skeleton */}
                                    <div className="flex items-center gap-2 flex-wrap justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-16 bg-muted rounded-full"></div>
                                        <div className="h-5 w-20 bg-muted rounded-full"></div>
                                      </div>
                                      <div className="h-6 w-6 bg-muted rounded"></div>
                                    </div>
                                    {/* Title Skeleton */}
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-full bg-muted rounded"></div>
                                    </div>
                                    {/* Description Skeleton */}
                                    <div className="space-y-1.5">
                                      <div className="h-4 w-full bg-muted rounded"></div>
                                      <div className="h-4 w-2/3 bg-muted rounded"></div>
                                    </div>
                                    {/* Date Skeleton */}
                                    <div className="flex items-center gap-1.5 pt-2">
                                      <div className="h-3.5 w-3.5 bg-muted rounded"></div>
                                      <div className="h-3.5 w-20 bg-muted rounded"></div>
                                      <div className="h-3.5 w-3.5 bg-muted rounded ml-1"></div>
                                      <div className="h-3.5 w-16 bg-muted rounded"></div>
                                    </div>
                                  </div>
                                  {/* Action Buttons Skeleton */}
                                  <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                    <div className="h-9 flex-1 bg-muted rounded"></div>
                                    <div className="h-9 flex-1 bg-muted rounded"></div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        )}
                      </div>
                      {/* Explore More Templates Button */}
                      <div className="mt-8">
                        {!isV2 && (
                          <div className="mb-4 p-4 bg-muted/50 border border-border rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              <strong>Note:</strong> This is a V1 job. V1 jobs are now read-only. You can view and download existing content, but cannot generate new templates or ads. Please create a new V2 job for full functionality.
                            </p>
                          </div>
                        )}
                        <Button
                          onClick={() => {
                            if (isV2) {
                              setShowExploreTemplatesV2(true);
                            } else {
                              // V1 flow - disabled for read-only
                              toast({
                                title: "V1 Job Read-Only",
                                description: "V1 jobs are read-only. Please create a new V2 job to generate templates.",
                                variant: "default",
                              });
                            }
                          }}
                          disabled={!isV2 || availableTemplatesLoading}
                          size="lg"
                          className="w-full"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Explore More Templates ({JOB_CREDITS_BY_TYPE.pre_lander} Credits per angle)
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

      {/* Generated Static Ads */}
      {(() => {
        // Use same transformation logic as V2AvatarTree
        let avatarsToDisplay: TransformedAvatar[] | undefined = customerAvatars as TransformedAvatar[] | undefined;

        if ((!avatarsToDisplay || avatarsToDisplay.length === 0) && (fullResult as DeepCopyResult)?.results?.marketing_avatars) {
          avatarsToDisplay = transformV2ToExistingSchema(fullResult as DeepCopyResult);
        }

        return (
          <GenerateStaticAds
            originalJobId={originalJobId || ""}
            marketingAngles={avatarsToDisplay || []}
            selectedAvatar={avatarsToDisplay && avatarsToDisplay.length > 0 ? avatarsToDisplay[0] : null}
            foundationalDocText={fullResult?.results?.deep_research_prompt}
            isV2={isV2}
          />
        );
      })()}


      {/* Template Preview Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="w-[95vw] max-h-[95vh] overflow-hidden !max-w-none sm:!max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              Template: {selectedTemplate?.name || "Template Preview"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description ||
                "Preview of the template used for this content"}
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
      <Dialog
        open={showTemplateModal}
        onOpenChange={(open) => {
          setShowTemplateModal(open);
          if (!open) {
            // Reset state when modal closes
            setSelectedTemplateForRefinement(null);
            setSelectedAngleForRefinement(null);
            setTemplateModalStep(1);
            setModalTypeFilter("all");
          }
        }}
      >
        <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <DialogTitle>
                  {templateModalStep === 1
                    ? "Step 1: Select a Template"
                    : "Step 2: Select Marketing Angle"}
                </DialogTitle>
                <DialogDescription>
                  {templateModalStep === 1
                    ? "Choose a template to generate a refined pre-lander"
                    : "Choose a marketing angle for your selected template"}
                </DialogDescription>
              </div>
              {templateModalStep === 1 && availableTemplates.length > 0 && (
                <div className="w-[180px] min-w-0 max-w-[180px] flex-shrink-0">
                  <Select
                    value={modalTypeFilter}
                    onValueChange={setModalTypeFilter}
                  >
                    <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(180px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
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
                    const filteredTemplates =
                      modalTypeFilter === "all"
                        ? availableTemplates
                        : availableTemplates.filter((template: Template) => {
                          const templateType =
                            template.category?.toLowerCase() === "listicle"
                              ? "listicle"
                              : "advertorial";
                          return (
                            templateType === modalTypeFilter.toLowerCase()
                          );
                        });

                    return (
                      <>
                        {selectedTemplateForRefinement && (
                          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-sm font-medium text-foreground mb-1">
                              1 template selected
                              {modalTypeFilter !== "all" && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({filteredTemplates.length}{" "}
                                  {formatFileType(modalTypeFilter)} template
                                  {filteredTemplates.length !== 1 ? "s" : ""}{" "}
                                  available)
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(() => {
                                const template = availableTemplates.find(
                                  (t: Template) =>
                                    t.id === selectedTemplateForRefinement
                                );
                                return (
                                  <Badge
                                    key={selectedTemplateForRefinement}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {template?.name ||
                                      selectedTemplateForRefinement}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                        {modalTypeFilter !== "all" && (
                          <div className="text-sm text-muted-foreground">
                            Showing {filteredTemplates.length} of{" "}
                            {availableTemplates.length} template
                            {availableTemplates.length !== 1 ? "s" : ""} (
                            {formatFileType(modalTypeFilter)})
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
                            [...filteredTemplates]
                              .sort((a, b) => {
                                const scoreA = selectedAnglePredictions?.find((p: any) => p.template_id === a.id)?.overall_fit_score || 0;
                                const scoreB = selectedAnglePredictions?.find((p: any) => p.template_id === b.id)?.overall_fit_score || 0;
                                return scoreB - scoreA;
                              })
                              .map((template: Template) => {
                                const prediction = selectedAnglePredictions?.find((p: any) => p.template_id === template.id);
                                return (
                                  <TemplatePreview
                                    key={template.id}
                                    template={template}
                                    isSelected={
                                      selectedTemplateForRefinement === template.id
                                    }
                                    onClick={() =>
                                      handleTemplateSelect(template.id)
                                    }
                                    prediction={prediction}
                                  />
                                );
                              })
                          )}
                        </div>
                      </>
                    );
                  })()}
                  {selectedTemplateForRefinement && (
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => {
                          // If angle is already selected (from ExploreTemplatesDialogV2), generate directly
                          if (selectedAngleForRefinement) {
                            handleGenerateRefinedTemplate(
                              [selectedTemplateForRefinement],
                              selectedAngleForRefinement
                            );
                          } else {
                            // Otherwise, go to step 2 to select angle
                            setTemplateModalStep(2);
                          }
                        }}
                        disabled={
                          !selectedTemplateForRefinement ||
                          isGeneratingRefined ||
                          (selectedAngleForRefinement ? generatingAngles.has(selectedAngleForRefinement) : false)
                        }
                      >
                        {selectedAngleForRefinement
                          ? "Generate Refined Pre-Lander"
                          : "Continue with selected template"}
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
              {selectedTemplateForRefinement && (
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selected Template
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const template = availableTemplates.find(
                        (t: Template) => t.id === selectedTemplateForRefinement
                      );
                      return (
                        <Badge
                          key={selectedTemplateForRefinement}
                          variant="secondary"
                          className="text-sm"
                        >
                          {template?.name || selectedTemplateForRefinement}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Marketing Angles in Accordion Format */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Select Marketing Angle
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a marketing angle to generate your refined template
                  </p>
                </div>

                {fullResult?.results?.marketing_angles &&
                  fullResult.results.marketing_angles.length > 0 ? (
                  <Accordion
                    type="single"
                    collapsible
                    className="w-full space-y-3"
                    value={openAngleItem}
                    onValueChange={setOpenAngleItem}
                  >
                    {fullResult.results.marketing_angles.map(
                      (angle: any, index: number) => {
                        const { angleObj, angleTitle, angleDescription } =
                          parseAngle(angle);
                        // Always prioritize the angle property for matching, not the title
                        const angleText =
                          typeof angle === "string"
                            ? angle
                            : angle.angle || angleDescription;
                        const isSelected =
                          selectedAngleForRefinement === angleText;
                        const itemValue = `angle-${index}`;

                        return (
                          <AccordionItem
                            key={index}
                            value={itemValue}
                            className="border-none"
                          >
                            <Card
                              className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                                ? "border-2 border-primary bg-primary/10"
                                : "border border-border hover:border-primary/50"
                                }`}
                              onClick={() => {
                                handleAngleToggle(angleText);
                                setOpenAngleItem((prev) =>
                                  prev === itemValue ? undefined : itemValue
                                );
                              }}
                            >
                              <div className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div
                                      className={`bg-primary/10 rounded-full p-1.5 flex-shrink-0 ${isSelected ? "bg-primary/20" : ""
                                        }`}
                                    >
                                      <Target className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                      {angleTitle && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge
                                            variant="outline"
                                            className="text-xs font-semibold bg-muted text-foreground border-border"
                                          >
                                            #{index + 1}
                                          </Badge>
                                          <h5 className="text-sm font-bold text-foreground">
                                            {angleTitle}
                                          </h5>
                                        </div>
                                      )}
                                      <p className="text-sm text-foreground font-medium leading-relaxed break-words mt-1">
                                        {angleDescription}
                                      </p>
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
                                        <span className="font-medium">
                                          Target Age Range:
                                        </span>
                                        <p className="text-muted-foreground">
                                          {angleObj.target_age_range}
                                        </p>
                                      </div>
                                    )}
                                    {angleObj?.target_audience && (
                                      <div>
                                        <span className="font-medium">
                                          Target Audience:
                                        </span>
                                        <p className="text-muted-foreground">
                                          {angleObj.target_audience}
                                        </p>
                                      </div>
                                    )}
                                    {angleObj?.pain_points &&
                                      angleObj.pain_points.length > 0 && (
                                        <div>
                                          <span className="font-medium">
                                            Pain Points:
                                          </span>
                                          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                            {(angleObj.pain_points || []).map(
                                              (point: string, idx: number) => (
                                                <li key={idx}>{point}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {angleObj?.desires &&
                                      angleObj.desires.length > 0 && (
                                        <div>
                                          <span className="font-medium">
                                            Desires:
                                          </span>
                                          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                            {(angleObj.desires || []).map(
                                              (desire: string, idx: number) => (
                                                <li key={idx}>{desire}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {angleObj?.common_objections &&
                                      angleObj.common_objections.length > 0 && (
                                        <div className="pt-2 border-t border-border">
                                          <span className="font-medium">
                                            Common Objections:
                                          </span>
                                          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                            {(
                                              angleObj.common_objections || []
                                            ).map(
                                              (
                                                objection: string,
                                                idx: number
                                              ) => (
                                                <li key={idx}>{objection}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {angleObj?.failed_alternatives &&
                                      angleObj.failed_alternatives.length >
                                      0 && (
                                        <div className="pt-2 border-t border-border">
                                          <span className="font-medium">
                                            Failed Alternatives:
                                          </span>
                                          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                            {(
                                              angleObj.failed_alternatives || []
                                            ).map(
                                              (
                                                alternative: string,
                                                idx: number
                                              ) => (
                                                <li key={idx}>{alternative}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {angleObj?.copy_approach &&
                                      angleObj.copy_approach.length > 0 && (
                                        <div className="pt-2 border-t border-border">
                                          <span className="font-medium">
                                            Copy Approach:
                                          </span>
                                          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                                            {(angleObj.copy_approach || []).map(
                                              (
                                                approach: string,
                                                idx: number
                                              ) => (
                                                <li key={idx}>{approach}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                )}
                              </AccordionContent>
                            </Card>
                          </AccordionItem>
                        );
                      }
                    )}
                  </Accordion>
                ) : (
                  <div className="p-4 bg-muted rounded-lg border border-border text-center">
                    <p className="text-sm text-muted-foreground">
                      No marketing angles available
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation and Generate Button */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTemplateModalStep(1);
                    setSelectedAngleForRefinement(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (
                      selectedTemplateForRefinement &&
                      selectedAngleForRefinement
                    ) {
                      handleGenerateRefinedTemplate(
                        [selectedTemplateForRefinement], // Convert single selection to array for the API
                        selectedAngleForRefinement
                      );
                    }
                  }}
                  disabled={
                    isGeneratingRefined ||
                    !selectedAngleForRefinement ||
                    !selectedTemplateForRefinement ||
                    generatingAngles.has(selectedAngleForRefinement)
                  }
                  className="min-w-[180px]"
                >
                  {isGeneratingRefined || generatingAngles.has(selectedAngleForRefinement || "") ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Refined Pre-Lander"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* V2 Explore Templates Dialog */}
      {isV2 && (() => {
        // Use same transformation logic as V2AvatarTree
        let avatarsToDisplay: TransformedAvatar[] | undefined = customerAvatars as TransformedAvatar[] | undefined;

        if ((!avatarsToDisplay || avatarsToDisplay.length === 0) && (fullResult as DeepCopyResult)?.results?.marketing_avatars) {
          avatarsToDisplay = transformV2ToExistingSchema(fullResult as DeepCopyResult);
        }

        return avatarsToDisplay && avatarsToDisplay.length > 0 ? (
          <ExploreTemplatesDialogV2
            open={showExploreTemplatesV2}
            onOpenChange={setShowExploreTemplatesV2}
            avatars={avatarsToDisplay}
            onConfirm={(avatarIndex, angleIndices) => {
              // Get selected avatar and angles
              const avatar = avatarsToDisplay![avatarIndex];
              const availableAngles = (avatar.marketing_angles as any[]) || avatar.v2_angles_data?.generated_angles || [];
              const selectedAngles = angleIndices.map(i =>
                availableAngles[i]
              ).filter(Boolean);

              // Close the V2 dialog
              setShowExploreTemplatesV2(false);

              // Open template selection modal with selected angles
              // For now, we'll generate for the first selected angle
              // TODO: Support multiple angle generation
              if (selectedAngles.length > 0) {
                const firstAngle = selectedAngles[0];
                const angleString = `${firstAngle.angle_title}: ${firstAngle.angle_subtitle}`;

                // Set the selected angle and open template modal at step 1 (template selection)
                setSelectedAngleForRefinement(angleString);
                // Capture predictions from the selected angle
                setSelectedAnglePredictions(firstAngle.template_predictions?.predictions);
                
                setTemplateModalStep(1); // Start at template selection, skip angle selection
                setShowTemplateModal(true);
              }
            }}
          />
        ) : null;
      })()}

      {/* Usage Limit Dialog */}
      {usageLimitData && (
        <UsageLimitDialog
          open={showUsageLimitDialog}
          onOpenChange={setShowUsageLimitDialog}
          usageType={usageLimitData.usageType}
          currentUsage={usageLimitData.currentUsage}
          limit={usageLimitData.limit}
        />
      )}
    </div>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const DeepCopyResults = memo(DeepCopyResultsComponent);
