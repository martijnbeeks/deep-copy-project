"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Image as ImageIcon, Upload, X, AlertCircle, Download, ExternalLink, Sparkles, Target, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { internalApiClient } from "@/lib/clients/internal-client";
import { logger } from "@/lib/utils/logger";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsageLimitDialog } from "@/components/ui/usage-limit-dialog";
import { useAuthStore } from "@/stores/auth-store";

interface GenerateStaticAdsProps {
  originalJobId: string;
  marketingAngles: any[];
  selectedAvatar: any; // Currently selected avatar from results page
  foundationalDocText?: string; // Deep research output
  onClose?: () => void;
}

interface ImageLibraryItem {
  id: number;
  library_id: string;
  url: string;
  created_at: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  angleIndex: number;
  variationNumber: number;
  angleName: string;
  status: string;
  createdAt: string;
  staticAdJobId?: string;
}

export function GenerateStaticAds({
  originalJobId,
  marketingAngles,
  selectedAvatar,
  foundationalDocText,
  onClose,
}: GenerateStaticAdsProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = angles, 2 = images, 3 = product image
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imageLibrary, setImageLibrary] = useState<ImageLibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [staticAdJobId, setStaticAdJobId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [jobStatus, setJobStatus] = useState<string>("pending");
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(true);
  const [currentAvatar, setCurrentAvatar] = useState<any>(selectedAvatar);
  const [generatingAngles, setGeneratingAngles] = useState<Set<string>>(new Set());
  // Track how many images are being generated per angle (angleString -> count)
  const [generatingCounts, setGeneratingCounts] = useState<Map<string, number>>(new Map());
  // Angle filter state (similar to prelanders)
  const [selectedAngleFilter, setSelectedAngleFilter] = useState<string>("all");
  
  // Ref for file input to control it properly
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Credit/Usage limit state
  const [credits, setCredits] = useState<{
    currentUsage: number;
    limit: number;
    allowed: boolean;
  } | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [showUsageLimitDialog, setShowUsageLimitDialog] = useState(false);

  const { toast } = useToast();
  const { user } = useAuthStore();

  const maxImages = selectedAngles.size * 2;

  // Helper function to download image
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      // Check if it's a Cloudflare CDN URL (imagedelivery.net)
      const isCloudflareUrl = imageUrl.includes('imagedelivery.net') || imageUrl.includes('cloudflare')
      
      // For Cloudflare URLs, try fetching with proper CORS settings
      // Cloudflare Images should support CORS, but we need to ensure proper headers
      const fetchOptions: RequestInit = {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit', // Don't send credentials for public images
      }
      
      const response = await fetch(imageUrl, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Validate that we got an image blob
      if (!blob.type.startsWith('image/')) {
        throw new Error('Response is not an image');
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
    } catch (error: any) {
      logger.error("Error downloading image:", error);
      
      // For Cloudflare URLs, try alternative method: create an img element and download via canvas
      if (imageUrl.includes('imagedelivery.net') || imageUrl.includes('cloudflare')) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Enable CORS for image
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) {
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                    }, 100);
                  }
                }, 'image/png');
              }
            } catch (canvasError) {
              logger.error("Canvas download failed:", canvasError);
              window.open(imageUrl, '_blank');
            }
          };
          
          img.onerror = () => {
            toast({
              title: "Download Failed",
              description: "Could not download image. Opening in new tab instead.",
              variant: "destructive",
            });
            window.open(imageUrl, '_blank');
          };
          
          img.src = imageUrl;
          return; // Exit early, download will happen in onload
        } catch (imgError) {
          logger.error("Image element download failed:", imgError);
        }
      }
      
      // Final fallback: open in new tab
      toast({
        title: "Download Failed",
        description: "Could not download image. Opening in new tab instead.",
        variant: "destructive",
      });
      window.open(imageUrl, '_blank');
    }
  };

  // Fetch avatar from original job if not provided
  useEffect(() => {
    const fetchAvatarFromJob = async () => {
      if (currentAvatar) return;

      try {
        const jobData = await internalApiClient.getJob(originalJobId);
        if (jobData) {
          let avatars = jobData.avatars;
          if (typeof avatars === 'string') {
            try {
              avatars = JSON.parse(avatars);
            } catch (e) {
              logger.error("Error parsing avatars JSON:", e);
              avatars = [];
            }
          }
          
          if (Array.isArray(avatars) && avatars.length > 0) {
            setCurrentAvatar(avatars[0]);
          }
        }
      } catch (error) {
        logger.error("Error fetching avatar from job:", error);
      }
    };

    fetchAvatarFromJob();
  }, [originalJobId, currentAvatar]);

  useEffect(() => {
    if (selectedAvatar) {
      setCurrentAvatar(selectedAvatar);
    }
  }, [selectedAvatar]);

  // Load previously generated images on mount
  useEffect(() => {
    const loadPreviousImages = async () => {
      setIsLoadingPrevious(true);
      try {
        const data = await internalApiClient.getStaticAdsByOriginalJob(originalJobId);
        
        if (data.generatedImages && data.generatedImages.length > 0) {
          setGeneratedImages(data.generatedImages);
        }
        
        // Find the most recent job
        const allJobs = data.jobs || [];
        const mostRecentJob = allJobs.length > 0 
          ? allJobs.sort((a: any, b: any) => 
              new Date(b.createdAt || b.updatedAt || 0).getTime() - 
              new Date(a.createdAt || a.updatedAt || 0).getTime()
            )[0]
          : null;
        
        if (mostRecentJob) {
          const status = (mostRecentJob.status || "").toLowerCase();
          const isActive = status !== "completed" && 
                          status !== "succeeded" && 
                          status !== "complete" && 
                          status !== "failed" &&
                          status !== "failure" &&
                          status !== "error";
          
          const normalizedJobStatus = (mostRecentJob.status || "pending").toLowerCase();
          const finalJobStatus = normalizedJobStatus === "completed" || normalizedJobStatus === "succeeded" || normalizedJobStatus === "complete" 
            ? "completed" 
            : normalizedJobStatus === "failed" || normalizedJobStatus === "failure" || normalizedJobStatus === "error"
            ? "failed"
            : normalizedJobStatus === "processing" || normalizedJobStatus === "running" || normalizedJobStatus === "in_progress"
            ? "processing"
            : "pending";
          
          setStaticAdJobId(mostRecentJob.id);
          setJobStatus(finalJobStatus);
          setJobProgress(mostRecentJob.progress || 0);
          
          // Restore generatingAngles and counts from job's selected_angles if job is active
          if (isActive && mostRecentJob.selectedAngles && Array.isArray(mostRecentJob.selectedAngles)) {
            setGeneratingAngles(new Set(mostRecentJob.selectedAngles));
            // Initialize counts: 2 images per angle per job
            const counts = new Map<string, number>();
            mostRecentJob.selectedAngles.forEach((angle: string) => {
              counts.set(angle, 2);
            });
            setGeneratingCounts(counts);
          }
        } else {
          setStaticAdJobId(null);
          setJobStatus("pending");
          setJobProgress(0);
        }
      } catch (error) {
        logger.error("Error loading previous static ads:", error);
      } finally {
        setIsLoadingPrevious(false);
      }
    };

    loadPreviousImages();
  }, [originalJobId]);

  // Fetch credits/usage limits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      setIsLoadingCredits(true);
      try {
        const response = await fetch(`/api/usage/check?type=static_ads`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.email || ''}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCredits({
            currentUsage: data.currentUsage || 0,
            limit: data.limit || 0,
            allowed: data.allowed !== false
          });
        } else {
          setCredits({
            currentUsage: 0,
            limit: Infinity,
            allowed: true
          });
        }
      } catch (error) {
        logger.error("Error fetching credits:", error);
        setCredits({
          currentUsage: 0,
          limit: Infinity,
          allowed: true
        });
      } finally {
        setIsLoadingCredits(false);
      }
    };

    fetchCredits();
  }, [user, showGenerateModal]);

  // Refresh credits when images are generated (after job completion)
  useEffect(() => {
    const refreshCredits = async () => {
      if (!user || jobStatus !== "completed") return;
      
      try {
        const response = await fetch(`/api/usage/check?type=static_ads`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.email || ''}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCredits({
            currentUsage: data.currentUsage || 0,
            limit: data.limit || 0,
            allowed: data.allowed !== false
          });
        }
      } catch (error) {
        logger.error("Error refreshing credits:", error);
      }
    };

    // Refresh credits when job completes
    if (jobStatus === "completed") {
      refreshCredits();
    }
  }, [user, jobStatus]);

  // Load image library
  useEffect(() => {
    const loadImageLibrary = async () => {
      setLoadingLibrary(true);
      try {
        const data = await internalApiClient.getImageLibrary();
        setImageLibrary(data.images || []);
      } catch (error) {
        logger.error("Error loading image library:", error);
        toast({
          title: "Error",
          description: "Failed to load image library",
          variant: "destructive",
        });
      } finally {
        setLoadingLibrary(false);
      }
    };

    if (step === 2) {
      loadImageLibrary();
    }
  }, [step, toast]);

  // Polling logic - works in background, not just in modal
  useEffect(() => {
    const normalizedStatus = (jobStatus || "").toLowerCase();
    
    // CRITICAL: Don't poll if no job ID is set - this prevents polling old jobs
    if (!staticAdJobId) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      return;
    }
    
    if (normalizedStatus === "completed" || normalizedStatus === "succeeded" || normalizedStatus === "complete" || normalizedStatus === "failed") {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      return;
    }

    const poll = async () => {
      try {
        const data = await internalApiClient.getStaticAdStatus(staticAdJobId);
        
        const normalizedStatus = (data.status || "pending").toLowerCase();
        const finalStatus = normalizedStatus === "completed" || normalizedStatus === "succeeded" || normalizedStatus === "complete" 
          ? "completed" 
          : normalizedStatus === "failed" || normalizedStatus === "failure" || normalizedStatus === "error"
          ? "failed"
          : normalizedStatus === "processing" || normalizedStatus === "running" || normalizedStatus === "in_progress"
          ? "processing"
          : "pending";
        
        setJobStatus(finalStatus);
        setJobProgress(data.progress || 0);
        setCurrentStep(data.currentStep || "");
        setError(data.error || null);
        
        // Update generated images - merge with existing to avoid duplicates
        if (data.generatedImages && Array.isArray(data.generatedImages)) {
          setGeneratedImages((prevImages) => {
            const existingUrls = new Set(prevImages.map(img => img.imageUrl));
            const newImages = data.generatedImages
              .filter((img: GeneratedImage) => !existingUrls.has(img.imageUrl))
              .map((img: GeneratedImage) => ({
                ...img,
                staticAdJobId: staticAdJobId
              }));
            const merged = [...prevImages, ...newImages];
            const sorted = merged.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            // Update generatingCounts as NEW images arrive - reduce count by 1 for each new image
            // This ensures skeleton loaders decrease as images are generated
            if (newImages.length > 0) {
              setGeneratingCounts((prevCounts) => {
                const updated = new Map(prevCounts);
                newImages.forEach((img) => {
                  const angleIdx = img.angleIndex || 1;
                  const marketingAngle = marketingAngles[angleIdx - 1];
                  if (marketingAngle) {
                    const parsed = parseAngle(marketingAngle);
                    const angleString = parsed.angleString;
                    const currentCount = updated.get(angleString) || 0;
                    if (currentCount > 0) {
                      updated.set(angleString, Math.max(0, currentCount - 1));
                    }
                  }
                });
                return updated;
              });
            }
            
            // Refresh credits when new images arrive (credits are deducted per image)
            if (newImages.length > 0 && user) {
              // Debounce credit refresh to avoid too many requests
              setTimeout(async () => {
                try {
                  const creditsResponse = await fetch(`/api/usage/check?type=static_ads`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${user.email || ''}`
                    }
                  });
                  if (creditsResponse.ok) {
                    const creditsData = await creditsResponse.json();
                    setCredits({
                      currentUsage: creditsData.currentUsage || 0,
                      limit: creditsData.limit || 0,
                      allowed: creditsData.allowed !== false
                    });
                  }
                } catch (error) {
                  logger.error("Error refreshing credits after new images:", error);
                }
              }, 1000); // Wait 1 second before refreshing to allow backend to process
            }
            
            return sorted;
          });
        }

        // Stop polling if completed or failed
        const statusLower = (data.status || "").toLowerCase();
        if (statusLower === "completed" || statusLower === "succeeded" || statusLower === "complete" || statusLower === "failed") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setPollingInterval(null);
          }
          
          if (statusLower === "completed" || statusLower === "succeeded" || statusLower === "complete") {
            setJobStatus("completed");
            setJobProgress(100);
            // Clear generating angles and counts when job is completed
            setGeneratingAngles(new Set());
            setGeneratingCounts(new Map());
            // Reload all images
            try {
              const previousData = await internalApiClient.getStaticAdsByOriginalJob(originalJobId);
              if (previousData.generatedImages && previousData.generatedImages.length > 0) {
                setGeneratedImages(previousData.generatedImages);
              }
            } catch (error) {
              logger.error("Error reloading images after completion:", error);
            }
            // Refresh credits after completion
            if (user) {
              try {
                const creditsResponse = await fetch(`/api/usage/check?type=static_ads`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${user.email || ''}`
                  }
                });
                if (creditsResponse.ok) {
                  const creditsData = await creditsResponse.json();
                  setCredits({
                    currentUsage: creditsData.currentUsage || 0,
                    limit: creditsData.limit || 0,
                    allowed: creditsData.allowed !== false
                  });
                }
              } catch (error) {
                logger.error("Error refreshing credits after completion:", error);
              }
            }
            toast({
              title: "Success",
              description: "Static ads generation completed!",
            });
          } else {
            setJobStatus("failed");
            // Clear generating angles and counts on failure too
            setGeneratingAngles(new Set());
            setGeneratingCounts(new Map());
            toast({
              title: "Error",
              description: data.error || "Static ads generation failed",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        logger.error("Error polling static ad status:", error);
      }
    };

    poll(); // Immediate poll
    const interval = setInterval(() => {
      poll();
    }, 5000);
    pollingIntervalRef.current = interval;
    setPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      pollingIntervalRef.current = null;
    };
  }, [staticAdJobId, jobStatus, originalJobId, toast, marketingAngles]);

  const handleAngleToggle = (angleString: string) => {
    setSelectedAngles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(angleString)) {
        newSet.delete(angleString);
      } else {
        newSet.add(angleString);
      }
      return newSet;
    });
    setSelectedImageIds(new Set());
  };

  const handleImageToggle = (libraryId: string) => {
    setSelectedImageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(libraryId)) {
        newSet.delete(libraryId);
      } else if (newSet.size < maxImages) {
        newSet.add(libraryId);
      } else {
        toast({
          title: "Limit reached",
          description: `You can select at most ${maxImages} images (${selectedAngles.size} angles × 2)`,
          variant: "destructive",
        });
      }
      return newSet;
    });
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Product image must be less than 50MB",
          variant: "destructive",
        });
        // Clear the input if file is too large
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setProductImage(file);
    } else {
      // If no file selected, clear the state
      setProductImage(null);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (selectedAngles.size === 0) {
        toast({
          title: "Selection required",
          description: "Please select at least one marketing angle",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      // Reset file input when entering step 3 to ensure it's fresh
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (fileInputRef.current && !productImage) {
          fileInputRef.current.value = '';
        }
      });
    }
  };

  const handleBack = () => {
    if (step === 1) {
      setShowGenerateModal(false);
    } else {
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate static ads",
        variant: "destructive",
      });
      return;
    }

    // Immediately show loading state to give instant feedback on click
    setIsGenerating(true);

    // Re-check credits before submission
    try {
      const response = await fetch(`/api/usage/check?type=static_ads`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.email || ''}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.allowed) {
          setShowUsageLimitDialog(true);
          setCredits({
            currentUsage: data.currentUsage || 0,
            limit: data.limit || 0,
            allowed: false
          });
          return;
        }
        setCredits({
          currentUsage: data.currentUsage || 0,
          limit: data.limit || 0,
          allowed: true
        });
      }
    } catch (error) {
      logger.error("Error checking credits before submit:", error);
    }

    const avatarToUse = currentAvatar || selectedAvatar;
    
    if (!avatarToUse) {
      toast({
        title: "Error",
        description: "No avatar available. Please ensure the job has customer avatars.",
        variant: "destructive",
      });
      setIsGenerating(false);
      return;
    }

    // CRITICAL: Clear old job state FIRST to prevent polling old job
    // Stop any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    // Clear old job ID and reset state BEFORE setting new skeletons
    setStaticAdJobId(null);
    setJobStatus("pending");
    setJobProgress(0);
    setError(null);
    
    // Save selected angles before resetting (needed for API call)
    const selectedAnglesArray = Array.from(selectedAngles);
    const selectedImageIdsArray = Array.from(selectedImageIds);
    const productImageFile = productImage;

    // OPTIMISTIC UI UPDATE: Set job status and skeleton loaders IMMEDIATELY
    // This ensures skeleton loaders appear right away, before the API call completes
    setJobStatus("processing");
    setJobProgress(0);
    
    // Set skeleton loaders immediately (optimistic UI update)
    selectedAnglesArray.forEach((angle) => {
      setGeneratingAngles(prev => new Set(prev).add(angle));
      // Track that we're generating 2 images per angle for this job
      setGeneratingCounts(prev => {
        const updated = new Map(prev);
        const currentCount = updated.get(angle) || 0;
        updated.set(angle, currentCount + 2); // 2 images per angle per job
        return updated;
      });
    });

    // Close modal and reset form immediately so skeleton loaders appear right away
    setShowGenerateModal(false);
    setStep(1);
    setSelectedAngles(new Set());
    setSelectedImageIds(new Set());
    setProductImage(null);

    // Show toast immediately so user knows action was taken
    toast({
      title: "Starting Generation",
      description: "Static ads generation is being started...",
    });

    try {
      const formData = new FormData();
      formData.append("original_job_id", originalJobId);
      
      const avatarDescription = avatarToUse.description || 
        `${avatarToUse.persona_name || ""}${avatarToUse.age_range ? `, ${avatarToUse.age_range}` : ""}${avatarToUse.gender ? `, ${avatarToUse.gender}` : ""}`;
      formData.append("selectedAvatar", avatarDescription);

      // Use saved selected angles array
      selectedAnglesArray.forEach((angle) => {
        formData.append("selectedAngles", angle);
      });

      if (foundationalDocText) {
        formData.append("foundationalDocText", foundationalDocText);
      }

      if (productImageFile) {
        formData.append("productImage", productImageFile);
      }

      selectedImageIdsArray.forEach((id) => {
        formData.append("forcedReferenceImageIds", id);
      });

      formData.append("language", "english");
      formData.append("enableVideoScripts", "false");

      const data = await internalApiClient.generateStaticAds(formData);
      
      if (data.jobId) {
        // Only set the new job ID AFTER successful creation
        // This will trigger the polling effect to start polling the NEW job
        setStaticAdJobId(data.jobId);
        // Job status is already set to "processing" above
        // Update toast to confirm job was created
        toast({
          title: "Job Submitted",
          description: "Static ads generation has been started successfully!",
        });
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error: any) {
      logger.error("Error generating static ads:", error);
      
      if (error.status === 429 || (error as any).status === 429) {
        const errorData = {
          currentUsage: (error as any).currentUsage || 0,
          limit: (error as any).limit || 0,
        };
        setCredits({
          currentUsage: errorData.currentUsage,
          limit: errorData.limit,
          allowed: false
        });
        setShowUsageLimitDialog(true);
        setError("Usage limit exceeded");
        setJobStatus("failed");
        // Clear skeleton loaders on usage limit error
        setGeneratingAngles(new Set());
        setGeneratingCounts(new Map());
        toast({
          title: "Usage Limit Reached",
          description: `You've reached your weekly limit of ${errorData.limit} Static Ads actions.`,
          variant: "destructive",
        });
        return;
      }
      
      setError(error.message || "Failed to start static ads generation");
      setJobStatus("failed");
      // Clear skeleton loaders on error
      setGeneratingAngles(new Set());
      setGeneratingCounts(new Map());
      toast({
        title: "Error",
        description: error.message || "Failed to start static ads generation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to parse angle (similar to prelanders)
  // This function handles both string and object angle formats
  const parseAngle = (angle: any): { angleObj: any; angleTitle: string | null; angleDescription: string; angleString: string } => {
    if (typeof angle === 'string') {
      const parts = angle.split(':');
      const title = parts[0]?.trim() || null;
      const description = parts.slice(1).join(':').trim() || angle;
      return {
        angleObj: null,
        angleTitle: title,
        angleDescription: description,
        angleString: angle
      };
    }
    
    const title = angle.title || null;
    const description = angle.angle || angle.description || '';
    const angleString = title ? `${title}: ${description}` : description;
    
    return {
      angleObj: angle,
      angleTitle: title,
      angleDescription: description,
      angleString: angleString
    };
  };

  // Filter images by selected angle
  const filteredImages = useMemo(() => {
    if (selectedAngleFilter === "all") {
      return generatedImages;
    }
    
    // Find matching angle index
    const angleIndex = marketingAngles.findIndex((angle: any) => {
      const parsed = parseAngle(angle);
      return parsed.angleString === selectedAngleFilter;
    });
    
    if (angleIndex === -1) {
      return generatedImages;
    }
    
    // Filter by angle index (1-based in UI, 0-based in array)
    return generatedImages.filter((img) => img.angleIndex === angleIndex + 1);
  }, [generatedImages, selectedAngleFilter, marketingAngles]);

  // Create flat list of all images with skeleton loaders
  const allDisplayItems = useMemo(() => {
    const items: Array<{ type: 'image' | 'skeleton'; data?: GeneratedImage; angleIndex: number; angleString: string }> = [];
    
    // Add existing images
    filteredImages.forEach((img) => {
      const angleString = marketingAngles[img.angleIndex - 1] 
        ? parseAngle(marketingAngles[img.angleIndex - 1]).angleString 
        : `Angle ${img.angleIndex}`;
      items.push({ type: 'image', data: img, angleIndex: img.angleIndex, angleString });
    });
    
    // Add skeleton loaders for generating angles
    if (jobStatus === "processing" || jobStatus === "pending") {
      marketingAngles.forEach((angle, angleIndex) => {
        const parsed = parseAngle(angle);
        const angleString = parsed.angleString;
        const angleNum = angleIndex + 1;
        
        // Check if this angle is being generated
        if (generatingAngles.has(angleString)) {
          // Check if we should show skeletons (if filter is "all" or matches this angle)
          if (selectedAngleFilter === "all" || selectedAngleFilter === angleString) {
            const skeletonsToShow = generatingCounts.get(angleString) || 2;
            const existingCount = filteredImages.filter(img => img.angleIndex === angleNum).length;
            
            // Only show skeletons if we don't have all images yet
            if (existingCount < skeletonsToShow) {
              for (let i = 0; i < skeletonsToShow - existingCount; i++) {
                items.push({ type: 'skeleton', angleIndex: angleNum, angleString });
              }
            }
          }
        }
      });
    }
    
    return items;
  }, [filteredImages, marketingAngles, generatingAngles, generatingCounts, jobStatus, selectedAngleFilter]);

  // Reset modal state when it opens
  const handleModalOpen = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate static ads",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingCredits(true);
    try {
      const response = await fetch(`/api/usage/check?type=static_ads`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.email || ''}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const creditData = {
          currentUsage: data.currentUsage || 0,
          limit: data.limit || 0,
          allowed: data.allowed !== false
        };
        setCredits(creditData);

        if (!creditData.allowed) {
          setShowUsageLimitDialog(true);
          setIsLoadingCredits(false);
          return;
        }
      }
    } catch (error) {
      logger.error("Error checking credits:", error);
    } finally {
      setIsLoadingCredits(false);
    }

    setStep(1);
    setSelectedAngles(new Set());
    setSelectedImageIds(new Set());
    setProductImage(null);
    setIsGenerating(false);
    setError(null);
    setCurrentStep("");
    // Reset file input when modal opens
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowGenerateModal(true);
  };

  const handleModalClose = (open: boolean) => {
    setShowGenerateModal(open);
    if (!open) {
      setStep(1);
      setSelectedAngles(new Set());
      setSelectedImageIds(new Set());
      setProductImage(null);
      setIsGenerating(false);
      setError(null);
      setCurrentStep("");
      // Reset file input when modal closes
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Multi-step form component (for modal)
  const GenerateForm = () => (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 ${
                    step > s ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Step {step} of 3
        </div>
      </div>

      {/* Step 1: Select Marketing Angles */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Select Marketing Angles</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select one or more marketing angles. You'll be able to select up to {selectedAngles.size * 2} reference images (2 per angle).
            </p>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {marketingAngles.map((angle, index) => {
              const { angleString, angleTitle, angleDescription } = parseAngle(angle);
              const isSelected = selectedAngles.has(angleString);

              return (
                <AccordionItem key={index} value={`angle-${index}`} className="border-none">
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? "border-2 border-primary bg-primary/10"
                        : "border border-border hover:border-primary/50"
                    }`}
                    onClick={() => handleAngleToggle(angleString)}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            {angleTitle && (
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="outline" className="text-xs">
                                  #{index + 1}
                                </Badge>
                                <h4 className="text-base font-semibold">{angleTitle}</h4>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">{angleDescription}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => handleModalClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleNext} disabled={selectedAngles.size === 0}>
              Next: Select Images ({selectedAngles.size} angle{selectedAngles.size !== 1 ? "s" : ""} selected)
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select Reference Images */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Select Reference Images</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select up to {maxImages} reference images ({selectedAngles.size} angles × 2). You can select fewer or none.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Selected: {selectedImageIds.size} / {maxImages}
            </p>
          </div>

          {loadingLibrary ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[500px] overflow-y-auto">
              {imageLibrary.map((image) => {
                const isSelected = selectedImageIds.has(image.library_id);
                const canSelect = selectedImageIds.size < maxImages;
                // Allow clicking if: already selected (to unselect) OR can select new one
                const canClick = isSelected || canSelect;

                return (
                  <Card
                    key={image.id}
                    className={`cursor-pointer transition-all hover:shadow-md relative ${
                      isSelected
                        ? "border-2 border-primary bg-primary/10"
                        : canSelect
                        ? "border border-border hover:border-primary/50"
                        : "border border-border opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => canClick && handleImageToggle(image.library_id)}
                  >
                    <div className="relative aspect-square w-full">
                      <img
                        src={image.url}
                        alt={`Image ${image.library_id}`}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-1">
                      <p className="text-xs text-center text-muted-foreground truncate">
                        Reference
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext}>
              Next: Upload Product Image
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Product Image & Generation */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Upload Product Image</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a product image to help generate better static ads. Max file size: 50MB
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-image">Product Image</Label>
            <Input
              ref={fileInputRef}
              id="product-image"
              type="file"
              accept="image/*,.pdf"
              onChange={handleProductImageChange}
              key={`product-image-input-${step}`} // Force re-render when step changes to ensure proper initialization
            />
            {productImage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 p-2 bg-muted rounded-md">
                <span className="font-medium">{productImage.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(productImage.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setProductImage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                "Generate Static Ads"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Main Accordion View: Show Generated Images */}
      <div className="mb-12">
        <Accordion type="single" collapsible>
          <AccordionItem value="static-ads">
            <Card className="bg-card/80 border-border/50">
              <AccordionTrigger className="p-8 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Generated Static Ads
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        AI-generated static ad images for your marketing angles
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-8 pb-8 border-t border-border/50 pt-6">
                  {isLoadingPrevious ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Show active job status if any */}
                      {(jobStatus === "processing" || jobStatus === "pending") && (
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Generation in Progress</span>
                            <Badge variant="secondary">{jobStatus}</Badge>
                          </div>
                          {jobProgress > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Progress: {jobProgress.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${jobProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {currentStep && (
                            <p className="text-xs text-muted-foreground mt-2">{currentStep}</p>
                          )}
                        </div>
                      )}

                      {/* Filter and Image Count */}
                      {generatedImages.length > 0 && (
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">
                              Generated Static Ads
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                const filteredCount = filteredImages.length;
                                const totalCount = generatedImages.length;
                                
                                if (totalCount === 0) {
                                  return "No images generated yet";
                                }
                                
                                if (selectedAngleFilter !== "all") {
                                  const selectedAngle = marketingAngles.find((ma: any) => {
                                    const parsed = parseAngle(ma);
                                    return parsed.angleString === selectedAngleFilter;
                                  });
                                  const angleTitle = selectedAngle 
                                    ? parseAngle(selectedAngle).angleTitle || selectedAngleFilter
                                    : selectedAngleFilter;
                                  return `${filteredCount} of ${totalCount} image${totalCount !== 1 ? 's' : ''} (${angleTitle})`;
                                }
                                
                                return `${totalCount} image${totalCount !== 1 ? 's' : ''} generated`;
                              })()}
                            </p>
                          </div>
                          {/* Angle Filter - Always show when there are any images */}
                          <div className="w-[220px] min-w-0 max-w-[220px]">
                            <Select
                              value={selectedAngleFilter}
                              onValueChange={setSelectedAngleFilter}
                            >
                              <SelectTrigger className="!w-full !max-w-full [&_[data-slot=select-value]]:!max-w-[calc(220px-3rem)] [&_[data-slot=select-value]]:!truncate [&_[data-slot=select-value]]:!block [&_[data-slot=select-value]]:!min-w-0">
                                <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                                <SelectValue placeholder="Filter by angle" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  All Angles
                                </SelectItem>
                                {marketingAngles.map((angle: any, index: number) => {
                                  const parsed = parseAngle(angle);
                                  const displayTitle = parsed.angleTitle 
                                    ? (parsed.angleTitle.length > 35 
                                        ? parsed.angleTitle.substring(0, 32) + "..." 
                                        : parsed.angleTitle)
                                    : parsed.angleDescription.substring(0, 35) + (parsed.angleDescription.length > 35 ? "..." : "");
                                  return (
                                    <SelectItem
                                      key={parsed.angleString}
                                      value={parsed.angleString}
                                    >
                                      {displayTitle}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Uniform Grid Display */}
                      {allDisplayItems.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {allDisplayItems.map((item, index) => {
                            if (item.type === 'image' && item.data) {
                              const img = item.data;
                              return (
                                <Card key={img.id} className="overflow-hidden group">
                                  <div className="relative aspect-[4/3] h-48 overflow-hidden">
                                    <img
                                      src={img.imageUrl}
                                      alt={`${img.angleName} - Variation ${img.variationNumber}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                          const filename = `${img.angleName.replace(/[^a-z0-9]/gi, '_')}_variation_${img.variationNumber}.png`;
                                          downloadImage(img.imageUrl, filename);
                                        }}
                                      >
                                        <Download className="w-4 h-4 mr-1" />
                                        Download
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => window.open(img.imageUrl, '_blank')}
                                      >
                                        <ExternalLink className="w-4 h-4 mr-1" />
                                        View Full
                                      </Button>
                                    </div>
                                  </div>
                                  <CardContent className="p-1.5 space-y-2">
                                    <div className="flex items-center justify-center">
                                      {/* Angle number badge - same style as prelanders */}
                                      <Badge
                                        variant="outline"
                                        className="text-xs font-semibold bg-muted text-foreground border-border w-fit"
                                      >
                                        <Target className="h-3 w-3 mr-1" />
                                        {img.angleIndex}
                                      </Badge>
                                    </div>
                                    {/* Creation Date */}
                                    {img.createdAt && (
                                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>
                                          {new Date(img.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                          })}
                                        </span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            } else if (item.type === 'skeleton') {
                              return (
                                <Card key={`skeleton-${item.angleIndex}-${index}`} className="overflow-hidden">
                                  <div className="relative aspect-[4/3] h-48 bg-muted animate-pulse">
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                  </div>
                                  <CardContent className="p-1.5 space-y-2">
                                    <div className="flex items-center justify-center">
                                      {/* Angle number badge - same style as prelanders */}
                                      <Badge
                                        variant="outline"
                                        className="text-xs font-semibold bg-muted text-foreground border-border w-fit"
                                      >
                                        <Target className="h-3 w-3 mr-1" />
                                        {item.angleIndex}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-center">
                                      <p className="text-xs text-center text-muted-foreground">
                                        Generating...
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ) : (
                        selectedAngleFilter !== "all" && (
                          <div className="text-center py-12">
                            <p className="text-sm text-muted-foreground">
                              No images found for the selected angle filter.
                            </p>
                          </div>
                        )
                      )}

                      {/* Empty state */}
                      {allDisplayItems.length === 0 && generatingAngles.size === 0 && (
                        <div className="text-center py-12">
                          <p className="text-sm text-muted-foreground mb-4">
                            No static ads generated yet. Click the button below to generate your first set of static ads.
                          </p>
                          <Button
                            onClick={handleModalOpen}
                            size="lg"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Static Ads
                          </Button>
                        </div>
                      )}

                      {/* Generate More Button */}
                      {(allDisplayItems.length > 0 || generatingAngles.size > 0) && (
                        <div className="pt-4 border-t">
                          <Button
                            onClick={handleModalOpen}
                            size="lg"
                            className="w-full"
                            disabled={jobStatus === "processing" || jobStatus === "pending"}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate More Ads
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={handleModalClose}>
        <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Generate Static Ads</DialogTitle>
                <DialogDescription>
                  Follow the steps below to generate new static ad images
                </DialogDescription>
              </div>
              {/* Credit Badge */}
              {credits && (
                <Badge 
                  variant={credits.allowed ? "secondary" : "destructive"}
                  className="ml-4"
                >
                  {isLoadingCredits ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <>
                      {credits.currentUsage} / {credits.limit === Infinity ? "∞" : credits.limit} Credits
                    </>
                  )}
                </Badge>
              )}
            </div>
          </DialogHeader>
          <GenerateForm />
        </DialogContent>
      </Dialog>

      {/* Usage Limit Dialog */}
      {credits && (
        <UsageLimitDialog
          open={showUsageLimitDialog}
          onOpenChange={setShowUsageLimitDialog}
          usageType="static_ads"
          currentUsage={credits.currentUsage}
          limit={credits.limit}
        />
      )}
    </>
  );
}

