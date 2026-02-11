"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
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
import { isV2Job } from "@/lib/utils/v2-data-transformer";
import { AvatarSelectorV2 } from "./avatar-selector-v2";
import { AngleSelectorV2 } from "./angle-selector-v2";
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits";


interface GenerateStaticAdsProps {
  originalJobId?: string;
  marketingAngles: any[];
  selectedAvatar: any; // Currently selected avatar from results page
  foundationalDocText?: string; // Deep research output
  isV2?: boolean; // Whether this is a V2 job
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

// Helper function to parse angle data
function parseAngle(angle: any) {
  let angleTitle = "";
  let angleDescription = "";
  let angleString = "";

  if (typeof angle === "string") {
    // Handle string format "Title: Description"
    if (angle.includes(": ")) {
      const parts = angle.split(": ");
      angleTitle = parts[0];
      angleDescription = parts.slice(1).join(": ");
      angleString = angle;
    } else {
      angleTitle = angle;
      angleString = angle;
    }
  } else if (typeof angle === "object" && angle !== null) {
    // Handle object format
    angleTitle = angle.angle_title || angle.title || "";
    angleDescription = angle.angle_subtitle || angle.angle || angle.description || "";

    // Construct standardized angle string
    if (angleTitle && angleDescription) {
      angleString = `${angleTitle}: ${angleDescription}`;
    } else {
      angleString = angleTitle || angleDescription || "";
    }
  }

  return { angleTitle, angleDescription, angleString };
}

export function GenerateStaticAds({
  originalJobId,
  marketingAngles,
  selectedAvatar,
  foundationalDocText,
  isV2: isV2Prop,
  onClose,
}: GenerateStaticAdsProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1 = avatar, 2 = angles, 3 = images, 4 = product image
  const [selectedAvatarIndex, setSelectedAvatarIndex] = useState<number | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string; id: string }[]>([]);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imageLibrary, setImageLibrary] = useState<ImageLibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [staticAdJobId, setStaticAdJobId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [jobStatus, setJobStatus] = useState<string>("completed");
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

  const imageLibraryScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const [sortBy, setSortBy] = useState<"latest" | "oldest" | "angle">("latest");

  // Ref for file input to control it properly
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

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

  // V2 job detection - use prop if provided, otherwise check avatar
  const isV2 = useMemo(() => {
    if (isV2Prop !== undefined) return isV2Prop;
    // Fallback to checking avatar
    const avatarToCheck = selectedAvatar ? [selectedAvatar] : [];
    return avatarToCheck.length > 0 && isV2Job(avatarToCheck);
  }, [isV2Prop, selectedAvatar]);

  // Calculate max images: 2 per selected angle, minimum 2
  const maxImages = Math.max(selectedAngles.size * 2, 2);
  const totalSelectedImages = selectedImageIds.size + uploadedImages.length;

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
        if (!originalJobId) return;
        const jobData = await internalApiClient.getJob(originalJobId) as any;
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
        if (!originalJobId) {
          setIsLoadingPrevious(false);
          return;
        }
        const data = await internalApiClient.getStaticAdsByOriginalJob(originalJobId) as any;

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
          setJobStatus("completed");
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
        setImageLibrary((data as any).images || data || []);
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
        const data = await internalApiClient.getStaticAdStatus(staticAdJobId) as any;

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
                newImages.forEach((img: any) => {
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
              if (originalJobId) {
                const previousData = await internalApiClient.getStaticAdsByOriginalJob(originalJobId) as any;
                if (previousData.generatedImages && previousData.generatedImages.length > 0) {
                  setGeneratedImages(previousData.generatedImages);
                }
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

  const handleImageToggle = useCallback((libraryId: string) => {
    // Save scroll position before state update
    if (imageLibraryScrollRef.current) {
      scrollPositionRef.current = imageLibraryScrollRef.current.scrollTop;
    }

    setSelectedImageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(libraryId)) {
        newSet.delete(libraryId);
      } else if (totalSelectedImages < maxImages) {
        newSet.add(libraryId);
      } else {
        toast({
          title: "Limit reached",
          description: `You can select at most ${maxImages} images total`,
          variant: "destructive",
        });
      }
      return newSet;
    });
  }, [totalSelectedImages, maxImages, toast]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 10MB",
        variant: "destructive",
      });
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = '';
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, JPEG, WebP)",
        variant: "destructive",
      });
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = '';
      }
      return;
    }

    // Check if we can add more images
    if (totalSelectedImages >= maxImages) {
      toast({
        title: "Limit reached",
        description: `You can select at most ${maxImages} images total`,
        variant: "destructive",
      });
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = '';
      }
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    const id = `uploaded-${Date.now()}-${Math.random()}`;

    setUploadedImages((prev) => [...prev, { file, preview, id }]);

    // Clear input
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = '';
    }
  }, [totalSelectedImages, maxImages, toast]);

  const handleRemoveUploadedImage = useCallback((id: string) => {
    setUploadedImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        // Revoke preview URL to prevent memory leaks
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

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
      // Reset scroll position when entering step 2
      scrollPositionRef.current = 0;
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

  const handleSubmit = async (allowOverage: boolean = false) => {
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
      description: uploadedImages.length > 0
        ? `Uploading ${uploadedImages.length} custom image${uploadedImages.length > 1 ? 's' : ''}...`
        : "Static ads generation is being started...",
    });

    // Prepare variables that will be needed in error handling
    const avatarDescription = avatarToUse.description ||
      `${avatarToUse.persona_name || ""}${avatarToUse.age_range ? `, ${avatarToUse.age_range}` : ""}${avatarToUse.gender ? `, ${avatarToUse.gender}` : ""}`;
    let productImageUrl: string | null = null;
    let uploadedImageUrls: string[] = [];

    try {
      // Upload custom images to Cloudflare first

      if (uploadedImages.length > 0) {
        for (let i = 0; i < uploadedImages.length; i++) {
          const uploadedImg = uploadedImages[i];

          try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', uploadedImg.file);

            const uploadResponse = await fetch('/api/upload-image', {
              method: 'POST',
              body: uploadFormData
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.error || 'Failed to upload image');
            }

            const uploadData = await uploadResponse.json();
            uploadedImageUrls.push(uploadData.url);

            // Update toast to show progress
            if (i < uploadedImages.length - 1) {
              toast({
                title: "Uploading Images",
                description: `Uploaded ${i + 1}/${uploadedImages.length} images...`,
              });
            }
          } catch (uploadError: any) {
            logger.error(`Error uploading custom image ${i + 1}:`, uploadError);

            // Clear skeleton loaders on upload error
            setGeneratingAngles(new Set());
            setGeneratingCounts(new Map());
            setJobStatus("failed");

            toast({
              title: "Upload Failed",
              description: uploadError.message || `Failed to upload image ${i + 1}`,
              variant: "destructive",
            });

            setIsGenerating(false);
            return;
          }
        }

        // Show success toast after all uploads complete
        toast({
          title: "Images Uploaded",
          description: `${uploadedImageUrls.length} custom image${uploadedImageUrls.length > 1 ? 's' : ''} uploaded successfully`,
        });
      }

      // Upload product image to Cloudflare if provided
      let productImageUrl = null;
      if (productImageFile) {
        try {
          const productUploadFormData = new FormData();
          productUploadFormData.append('file', productImageFile);

          const productUploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: productUploadFormData
          });

          if (!productUploadResponse.ok) {
            const errorData = await productUploadResponse.json();
            throw new Error(errorData.error || 'Failed to upload product image');
          }

          const productUploadData = await productUploadResponse.json();
          productImageUrl = productUploadData.url;

          toast({
            title: "Product Image Uploaded",
            description: "Product image uploaded successfully",
          });
        } catch (uploadError: any) {
          logger.error('Error uploading product image:', uploadError);

          // Clear skeleton loaders on upload error
          setGeneratingAngles(new Set());
          setGeneratingCounts(new Map());
          setJobStatus("failed");

          toast({
            title: "Upload Failed",
            description: uploadError.message || 'Failed to upload product image',
            variant: "destructive",
          });

          setIsGenerating(false);
          return;
        }
      }

      // Build FormData payload
      const formData = new FormData();
      formData.append("original_job_id", originalJobId || "");

      formData.append("selectedAvatar", avatarDescription);

      // Add selected angles
      selectedAnglesArray.forEach((angle) => {
        formData.append("selectedAngles", angle);
      });

      if (foundationalDocText) {
        formData.append("foundationalDocText", foundationalDocText);
      }

      // Add product image URL (Cloudflare URL, not file)
      if (productImageUrl) {
        formData.append("productImageUrl", productImageUrl);
      }

      // Add gallery image IDs
      selectedImageIdsArray.forEach((id) => {
        formData.append("forcedReferenceImageIds", id);
      });

      // Add uploaded reference image URLs
      uploadedImageUrls.forEach((url) => {
        formData.append("uploadedReferenceImageUrls", url);
      });

      formData.append("language", "english");
      formData.append("enableVideoScripts", "false");
      if (allowOverage) {
        formData.append("allowOverage", "true");
      }

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

      if (error.status === 402 && (error as any).code === "JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED") {
        // Show toast notification about overage
        const overageCredits = (error as any).overageCredits ?? 0;
        const overageCostTotal = (error as any).overageCostTotal ?? 0;
        const currency = (error as any).currency ?? "EUR";
        
        toast({
          title: "Overage Charges Apply",
          description: `This job requires ${overageCredits} extra credit${overageCredits === 1 ? '' : 's'} (${overageCostTotal.toFixed(2)} ${currency}). Overage charges will be added to your next invoice.`,
          variant: "default",
        });

        // Automatically retry with allowOverage=true
        await handleSubmit(true);
        return;
      }

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

  // Filter and sort images by selected angle and sort criteria
  const filteredImages = useMemo(() => {
    let filtered = generatedImages;

    // Filter by angle
    if (selectedAngleFilter !== "all") {
      const angleIndex = marketingAngles.findIndex((angle: any) => {
        const parsed = parseAngle(angle);
        return parsed.angleString === selectedAngleFilter;
      });

      if (angleIndex !== -1) {
        filtered = filtered.filter((img) => img.angleIndex === angleIndex + 1);
      }
    }

    // Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "latest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "angle":
          // Sort by angle index first, then by creation date
          if (a.angleIndex !== b.angleIndex) {
            return a.angleIndex - b.angleIndex;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [generatedImages, selectedAngleFilter, marketingAngles, sortBy]);

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
    // Clean up uploaded images
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
    setProductImage(null);
    setIsGenerating(false);
    setError(null);
    setCurrentStep("");
    // Reset file input when modal opens
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = '';
    }
    setShowGenerateModal(true);
  };

  const handleModalClose = (open: boolean) => {
    setShowGenerateModal(open);
    if (!open) {
      setStep(1);
      setSelectedAngles(new Set());
      setSelectedImageIds(new Set());
      // Clean up uploaded images
      uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
      setUploadedImages([]);
      setProductImage(null);
      setIsGenerating(false);
      setError(null);
      setCurrentStep("");
      // Reset file input when modal closes
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = '';
      }
    }
  };

  // Memoize image library items to prevent scroll reset
  const memoizedImageLibraryItems = useMemo(() => {
    return [...imageLibrary].reverse().map((image) => {
      const isSelected = selectedImageIds.has(image.library_id);
      const canSelect = totalSelectedImages < maxImages;
      const canClick = isSelected || canSelect;

      return {
        image,
        isSelected,
        canSelect,
        canClick,
      };
    });
  }, [imageLibrary, selectedImageIds, maxImages, totalSelectedImages]);

  // Save scroll position on scroll
  const handleScroll = useCallback(() => {
    if (imageLibraryScrollRef.current) {
      scrollPositionRef.current = imageLibraryScrollRef.current.scrollTop;
    }
  }, []);

  // Restore scroll position after selectedImageIds changes
  useLayoutEffect(() => {
    if (step === 3 && imageLibraryScrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (imageLibraryScrollRef.current) {
          const savedPosition = scrollPositionRef.current;
          if (savedPosition > 0) {
            imageLibraryScrollRef.current.scrollTop = savedPosition;
          }
        }
      });
    }
  }, [selectedImageIds, step]);

  // Multi-step form component (for modal)
  const GenerateForm = () => (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-12 h-1 ${step > s ? "bg-green-500" : "bg-muted"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Step {step} of 4
        </div>
      </div>

      {/* Step 1: Select Avatar (V2 only) */}
      {step === 1 && isV2 && (
        <div className="space-y-4">
          <AvatarSelectorV2
            avatars={marketingAngles || []}
            selectedAvatarIndex={selectedAvatarIndex}
            onSelectAvatar={(index) => {
              setSelectedAvatarIndex(index);
              // Reset angle selection when avatar changes
              setSelectedAngles(new Set());
            }}
            title="Select Customer Avatar"
            description="Choose the customer avatar you want to target with your content"
          />

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => onClose?.()}>
              Cancel
            </Button>
            <Button onClick={() => setStep(2)} disabled={selectedAvatarIndex === null}>
              Next: Select Angles
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select Marketing Angles */}
      {step === 2 && (() => {
        // Determine which angles to show based on V1 vs V2
        let anglesToShow: any[] = [];
        let selectedAvatar: any = null;

        if (isV2) {
          // For V2, use the selected avatar from Step 1
          selectedAvatar = selectedAvatarIndex !== null ? marketingAngles[selectedAvatarIndex] : null;
          if (selectedAvatar) {
            anglesToShow = selectedAvatar.v2_angles_data?.generated_angles || selectedAvatar.marketing_angles || [];
          }
        } else {
          // V1 behavior
          anglesToShow = marketingAngles || [];
        }

        // Helper to convert angle index to angle string
        const getAngleString = (angle: any, index: number): string => {
          if (isV2) {
            return angle.angle_subtitle
              ? `${angle.angle_title}: ${angle.angle_subtitle}`
              : angle.angle_title || `Angle ${index + 1}`;
          } else {
            const parsed = parseAngle(angle);
            return parsed.angleString;
          }
        };

        // Convert selectedAngles (Set<string>) to indices for display
        const currentIndices: number[] = [];
        anglesToShow.forEach((angle, index) => {
          const angleString = getAngleString(angle, index);
          if (selectedAngles.has(angleString)) {
            currentIndices.push(index);
          }
        });

        // Handler to sync indices back to selectedAngles
        const handleAngleToggle = (index: number) => {
          const angle = anglesToShow[index];
          if (!angle) return;

          const angleString = getAngleString(angle, index);
          const newSelectedAngles = new Set(selectedAngles);

          if (newSelectedAngles.has(angleString)) {
            newSelectedAngles.delete(angleString);
          } else {
            newSelectedAngles.add(angleString);
          }

          setSelectedAngles(newSelectedAngles);
        };

        return (
          <div className="space-y-4">
            <AngleSelectorV2
              angles={anglesToShow}
              selectedAngles={currentIndices}
              onToggleAngle={handleAngleToggle}
              avatarName={selectedAvatar?.persona_name || selectedAvatar?.v2_avatar_data?.overview?.name}
              title="Select Marketing Angles"
              description={`Select one or more marketing angles. You'll be able to select up to ${Math.max(selectedAngles.size * 2, 2)} reference images (2 per angle).`}
              multiSelect={true}
              top3Angles={selectedAvatar?.v2_angles_data?.top_3_angles}
              ranking={selectedAvatar?.v2_angles_data?.ranking}
            />
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => isV2 ? setStep(1) : onClose?.()}>
                {isV2 ? "Back to Avatar" : "Cancel"}
              </Button>
              <Button onClick={() => setStep(3)} disabled={selectedAngles.size === 0}>
                Next: Select Images ({selectedAngles.size} {selectedAngles.size === 1 ? "angle" : "angles"} selected)
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Step 3: Select Reference Images */}
      {
        step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Reference Images</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select exactly {maxImages} reference images ({selectedAngles.size} {selectedAngles.size === 1 ? "angle" : "angles"} × 2 images per angle). You can upload custom images or choose from the gallery below.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Selected: {totalSelectedImages}/{maxImages} images ({selectedAngles.size} {selectedAngles.size === 1 ? "angle" : "angles"} × 2 images)
              </p>
            </div>

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                ref={imageLibraryScrollRef}
                onScroll={handleScroll}
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-h-[500px] overflow-y-auto p-1"
              >
                {/* Upload Cards - Show upload slots */}
                {uploadedImages.map((uploadedImg) => (
                  <Card
                    key={uploadedImg.id}
                    className="cursor-default overflow-hidden rounded-lg border p-0 ring-2 ring-primary ring-offset-2"
                  >
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img
                        src={uploadedImg.preview}
                        alt="Uploaded reference"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveUploadedImage(uploadedImg.id)}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg hover:bg-destructive/90 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}

                {/* Upload button card - always visible but disabled when limit reached */}
                <Card
                  className={`overflow-hidden rounded-lg border p-0 transition-colors ${totalSelectedImages >= maxImages
                    ? "opacity-50 cursor-not-allowed border-border border-dashed border-2"
                    : "cursor-pointer border-dashed border-2 border-primary/50 hover:border-primary hover:bg-primary/5"
                    }`}
                  onClick={() => {
                    if (totalSelectedImages < maxImages && uploadFileInputRef.current) {
                      uploadFileInputRef.current.click();
                    }
                  }}
                >
                  <div className={`relative aspect-square w-full overflow-hidden flex flex-col items-center justify-center gap-2 p-4 ${totalSelectedImages >= maxImages ? "opacity-50" : ""
                    }`}>
                    <Upload className={`w-8 h-8 ${totalSelectedImages >= maxImages ? "text-muted-foreground" : "text-primary"}`} />
                    <p className="text-xs text-center text-muted-foreground">
                      Upload Image
                    </p>
                  </div>
                </Card>

                {/* Hidden file input */}
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {/* Gallery Images */}
                {memoizedImageLibraryItems.map(({ image, isSelected, canSelect, canClick }) => (
                  <Card
                    key={image.library_id}
                    className={`cursor-pointer transition-colors overflow-hidden rounded-lg border p-0 ${isSelected
                      ? "ring-2 ring-primary ring-offset-2"
                      : canSelect
                        ? "border-border hover:border-primary/50"
                        : "opacity-50 cursor-not-allowed border-border"
                      }`}
                    onClick={() => {
                      if (canClick) {
                        handleImageToggle(image.library_id);
                      }
                    }}
                  >
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img
                        src={image.url}
                        alt={`Reference image ${image.library_id}`}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to Angles
              </Button>
              <Button onClick={() => setStep(4)} disabled={totalSelectedImages !== maxImages}>
                Next: Upload Product Image {totalSelectedImages !== maxImages && `(${totalSelectedImages}/${maxImages} selected)`}
              </Button>
            </div>
          </div>
        )
      }

      {/* Step 4: Product Image & Generation */}
      {
        step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Upload Product Image</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a clear product image with white or transparent background. Max file size: 50MB. Allowed file types: PNG, JPG, JPEG.
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
              <Button variant="outline" onClick={() => setStep(3)}>
                Back to Images
              </Button>
              <Button onClick={() => handleSubmit()} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  `Generate Static Ads (${selectedAngles.size * 2 * JOB_CREDITS_BY_TYPE.static_ads} Credits)`
                )}
              </Button>
            </div>
          </div>
        )
      }
    </div >
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
                          {/* Filter and Download All */}
                          <div className="flex items-center gap-3">
                            {/* Download All Button */}
                            {filteredImages.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (filteredImages.length === 0) {
                                    toast({
                                      title: "No images to download",
                                      description: "There are no images available to download.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  toast({
                                    title: "Downloading...",
                                    description: `Downloading ${filteredImages.length} image${filteredImages.length !== 1 ? 's' : ''}...`,
                                  });

                                  // Download all filtered images with a small delay between each
                                  for (let i = 0; i < filteredImages.length; i++) {
                                    const img = filteredImages[i];
                                    const angleName = img.angleName.replace(/[^a-z0-9]/gi, '_');
                                    const filename = `${angleName}_angle_${img.angleIndex}_variation_${img.variationNumber}.png`;

                                    try {
                                      await downloadImage(img.imageUrl, filename);
                                      // Small delay to prevent browser from blocking multiple downloads
                                      if (i < filteredImages.length - 1) {
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                      }
                                    } catch (error) {
                                      logger.error(`Error downloading image ${i + 1}:`, error);
                                    }
                                  }

                                  toast({
                                    title: "Download Complete",
                                    description: `Successfully downloaded ${filteredImages.length} image${filteredImages.length !== 1 ? 's' : ''}.`,
                                  });
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download All ({filteredImages.length})
                              </Button>
                            )}
                            {/* Sort Dropdown */}
                            <Select value={sortBy} onValueChange={(value: "latest" | "oldest" | "angle") => setSortBy(value)}>
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Sort by..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="latest">Latest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="angle">By Angle #</SelectItem>
                              </SelectContent>
                            </Select>
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
                                  {marketingAngles
                                    .map((angle: any, index: number) => {
                                      const parsed = parseAngle(angle);
                                      // Skip angles with empty string values (not allowed by Radix UI)
                                      if (!parsed.angleString || parsed.angleString.trim() === "") {
                                        return null;
                                      }
                                      const displayTitle = parsed.angleTitle
                                        ? (parsed.angleTitle.length > 35
                                          ? parsed.angleTitle.substring(0, 32) + "..."
                                          : parsed.angleTitle)
                                        : parsed.angleDescription.substring(0, 35) + (parsed.angleDescription.length > 35 ? "..." : "");
                                      return (
                                        <SelectItem
                                          key={`angle-${index}-${parsed.angleString}`}
                                          value={parsed.angleString}
                                        >
                                          {displayTitle}
                                        </SelectItem>
                                      );
                                    })
                                    .filter(Boolean)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Uniform Grid Display */}
                      {allDisplayItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {allDisplayItems.map((item, index) => {
                            if (item.type === 'image' && item.data) {
                              const img = item.data;

                              // Calculate actual variation number dynamically
                              const imagesForThisAngle = generatedImages
                                .filter(gi => gi.angleIndex === img.angleIndex)
                                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                              const actualVariationNumber = imagesForThisAngle.findIndex(gi => gi.id === img.id) + 1;
                              const adNumber = `${img.angleIndex}.${actualVariationNumber}`;

                              return (
                                <Card key={img.id} className="overflow-hidden group rounded-xl border">
                                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                                    <img
                                      src={img.imageUrl}
                                      alt={`${img.angleName} - Variation ${actualVariationNumber}`}
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Ad Number Label */}
                                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-lg">
                                      {adNumber}
                                    </div>
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
                                  <CardContent className="p-4 space-y-3 bg-card">
                                    <div className="flex items-center justify-between gap-2">
                                      {/* Angle number badge */}
                                      <Badge
                                        variant="default"
                                        className="text-xs font-semibold bg-primary/10 text-primary border-primary/20 px-2 py-1"
                                      >
                                        <Target className="h-3 w-3 mr-1" />
                                        Angle {img.angleIndex}
                                      </Badge>
                                      {/* Creation Date */}
                                      {img.createdAt && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Calendar className="h-3.5 w-3.5" />
                                          <span>
                                            {new Date(img.createdAt).toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric"
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {/* Angle name */}
                                    {(() => {
                                      const angle = marketingAngles[img.angleIndex - 1];
                                      if (angle) {
                                        const parsed = parseAngle(angle);
                                        return (
                                          <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                                            {parsed.angleTitle || parsed.angleDescription}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </CardContent>
                                </Card>
                              );
                            } else if (item.type === 'skeleton') {
                              return (
                                <Card key={`skeleton-${item.angleIndex}-${index}`} className="overflow-hidden rounded-xl border">
                                  <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 animate-pulse">
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
                                    </div>
                                  </div>
                                  <CardContent className="p-4 space-y-3 bg-card">
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-xs font-semibold bg-muted/50 text-muted-foreground border-border px-2 py-1"
                                      >
                                        <Target className="h-3 w-3 mr-1" />
                                        Angle {item.angleIndex}
                                      </Badge>
                                    </div>
                                    {/* Angle name */}
                                    {(() => {
                                      const angle = marketingAngles[item.angleIndex - 1];
                                      if (angle) {
                                        const parsed = parseAngle(angle);
                                        return (
                                          <p className="text-sm text-muted-foreground/60 line-clamp-2">
                                            {parsed.angleTitle || parsed.angleDescription}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <div className="flex items-center justify-center pt-1">
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
                      ) : (<>
                        {selectedAngleFilter !== "all" && (
                          <div className="text-center py-12">
                            <p className="text-sm text-muted-foreground">
                              No images found for the selected angle filter.
                            </p>
                          </div>
                        )}

                        {selectedAngleFilter === "all" && (
                          <div className="space-y-4">
                            {!isV2 && (
                              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                  <strong>Note:</strong> This is a V1 job. V1 jobs are now read-only. You can view existing content, but cannot generate new static ads. Please create a new V2 job for full functionality.
                                </p>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground mb-4">
                              No static ads generated yet. Click the button below to generate your first set of static ads.
                            </p>
                            <div className="mt-4">
                              <Button
                                onClick={() => {
                                  if (!isV2) {
                                    toast({
                                      title: "V1 Job Read-Only",
                                      description: "V1 jobs are read-only. Please create a new V2 job to generate static ads.",
                                      variant: "default",
                                    });
                                    return;
                                  }
                                  handleModalOpen();
                                }}
                                size="lg"
                                className="w-full"
                                disabled={!isV2}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Static Ads (1 Credit per ad)
                              </Button>
                            </div>
                          </div>
                        )}
                      </>)}

                      {/* Generate More Button */}
                      {(allDisplayItems.length > 0 || generatingAngles.size > 0) && (
                        <div className="pt-4 border-t">
                          {!isV2 && (
                            <div className="mb-4 p-4 bg-muted/50 border border-border rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                <strong>Note:</strong> This is a V1 job. V1 jobs are now read-only. You can view existing static ads, but cannot generate new ones. Please create a new V2 job for full functionality.
                              </p>
                            </div>
                          )}
                          <Button
                            onClick={() => {
                              if (!isV2) {
                                toast({
                                  title: "V1 Job Read-Only",
                                  description: "V1 jobs are read-only. Please create a new V2 job to generate static ads.",
                                  variant: "default",
                                });
                                return;
                              }
                              handleModalOpen();
                            }}
                            size="lg"
                            className="w-full"
                            disabled={!isV2 || jobStatus === "processing" || jobStatus === "pending"}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate More Ads (1 Credit per ad)
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
              <div>
                <DialogTitle>Generate Static Ads</DialogTitle>
                <DialogDescription>
                  Follow the steps below to generate new static ad images
                </DialogDescription>
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

