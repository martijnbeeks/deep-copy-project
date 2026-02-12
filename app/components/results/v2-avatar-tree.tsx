"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/results/markdown-content";
import { cn } from "@/lib/utils";
import {
    Target,
    TrendingUp,
    FileText,
    Loader2,
    CheckCircle2,
    User,
    Briefcase,
    MapPin,
    GraduationCap,
    Users,
    Wallet,
    Heart,
    HeartCrack,
    Sparkles,
    Zap,
    AlertTriangle,
    Shield,
    Crown,
    Lightbulb,
    ArrowRight,
    X,
    MessagesSquare,
    RotateCcw,
    Brain,
    XCircle,
    AlertCircle,
    Quote,
    Eye,
    Trophy,
    Badge as BadgeIcon,
    Layers,
    Award,
    Megaphone,
    Star
} from "lucide-react";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { internalApiClient } from "@/lib/clients/internal-client";
import { MarketingAngleCardV2 } from "./marketing-angle-card-v2";
import { TemplateSelectionModal } from "./template-selection-modal";


// Star component for displaying ratings
function StarRating({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
    const starSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
    const starColor = "text-amber-500";
    
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((starNumber) => (
                <Star
                    key={starNumber}
                    className={cn(
                        starSize,
                        starNumber <= score ? starColor : "text-gray-300 dark:text-gray-600"
                    )}
                    fill={starNumber <= score ? "currentColor" : "none"}
                />
            ))}
        </div>
    );
}

interface V2AvatarTreeProps {
    avatars: any[];
    jobId?: string;
    title?: string;
    description?: string;
    generatedAngles?: Set<string>;
    onGenerationComplete?: (angle?: string) => void;
    onGenerationStart?: (angle: string) => void;
    onGenerationError?: (angle: string) => void;
    offerBrief?: any;
}

// Component for expandable lists (max 2 items initially)
function ExpandableList({ items, uniqueKey }: { items: string[] | undefined; uniqueKey: string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!items || items.length === 0) {
        return <span className="text-muted-foreground/30 italic text-xs">—</span>;
    }

    const maxInitialItems = 2;
    const hasMore = items.length > maxInitialItems;
    const displayItems = isExpanded ? items : items.slice(0, maxInitialItems);

    return (
        <div className="space-y-2">
            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 marker:text-primary">
                {displayItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                ))}
            </ul>
            {hasMore && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    {isExpanded ? "Show Less" : `Show More (${items.length - maxInitialItems} more)`}
                </Button>
            )}
        </div>
    );
}

export function V2AvatarTree({
    avatars,
    jobId,
    title = "Customer Avatars & Marketing Angles",
    generatedAngles = new Set(),
    onGenerationComplete,
    onGenerationStart,
    onGenerationError,
    offerBrief
}: V2AvatarTreeProps) {
    const [generatingAngles, setGeneratingAngles] = useState<Set<string>>(new Set());
    const [selectedAvatarIndex, setSelectedAvatarIndex] = useState<number>(0);
    const [openAvatarModal, setOpenAvatarModal] = useState<number | null>(null);
    const { toast } = useToast();


    if (!avatars || avatars.length === 0) {
        return null;
    }

    // Helper function to get red shade classes based on intensity (1-16)
    const getIntensityColorClasses = (intensity: number) => {
        // Map intensity to red shades: lighter for low, darker for high
        // Light mode: red-400 (light) -> red-950 (dark)
        // Dark mode: red-200 (light) -> red-900 (dark)
        if (intensity <= 2) {
            return {
                icon: "text-red-400 dark:text-red-200",
                text: "text-red-500 dark:text-red-300"
            };
        } else if (intensity <= 4) {
            return {
                icon: "text-red-500 dark:text-red-300",
                text: "text-red-600 dark:text-red-400"
            };
        } else if (intensity <= 6) {
            return {
                icon: "text-red-600 dark:text-red-500",
                text: "text-red-700 dark:text-red-600"
            };
        } else if (intensity <= 8) {
            return {
                icon: "text-red-700 dark:text-red-600",
                text: "text-red-800 dark:text-red-700"
            };
        } else if (intensity <= 12) {
            return {
                icon: "text-red-800 dark:text-red-700",
                text: "text-red-900 dark:text-red-800"
            };
        } else {
            return {
                icon: "text-red-900 dark:text-red-800",
                text: "text-red-950 dark:text-red-900"
            };
        }
    };

    // Helper functions for avatar score descriptions
    const getAvatarProblemUrgencyDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Critical", description: "Daily frustration, heavy emotional weight, actively searching" },
            4: { level: "High", description: "Significant life impact, strong motivation to solve" },
            3: { level: "Moderate", description: "Noticeable problem, willing to act but not desperate" },
            2: { level: "Low", description: "Aware of issue, low emotional charge" },
            1: { level: "Minimal", description: "Problem barely registers, no urgency" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getPurchasingPowerDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Premium", description: "High disposable income, price is no obstacle" },
            4: { level: "Comfortable", description: "Employed or stable retirement, can afford without strain" },
            3: { level: "Moderate", description: "Can afford but needs value justification" },
            2: { level: "Stretched", description: "Budget-conscious, needs discounts or payment plans" },
            1: { level: "Limited", description: "Significant financial barrier" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getSaturationLevelDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Blue Ocean", description: "Almost no competitors targeting this avatar" },
            4: { level: "Low", description: "Few competitors, plenty of room" },
            3: { level: "Moderate", description: "Some competition, unique angles still available" },
            2: { level: "High", description: "Crowded space, hard to differentiate" },
            1: { level: "Saturated", description: "Extremely competitive, severe ad fatigue" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getAudienceSizeDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Massive", description: "40%+ of total market" },
            4: { level: "Large", description: "25-40% of total market" },
            3: { level: "Medium", description: "15-25% of total market" },
            2: { level: "Small", description: "5-15% of total market" },
            1: { level: "Tiny", description: "<5% of total market" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    // Sort avatars by intensity (highest first)
    const sortedAvatars = [...avatars].sort((a, b) => {
        const aIntensity = a.v2_avatar_data?.overview?.intensity || 0;
        const bIntensity = b.v2_avatar_data?.overview?.intensity || 0;
        return bIntensity - aIntensity; // Descending order (highest first)
    });

    // Get the currently selected avatar's data
    const selectedAvatar = sortedAvatars[selectedAvatarIndex];
    const rawAngles = selectedAvatar?.v2_angles_data?.generated_angles || [];
    const ranking = selectedAvatar?.v2_angles_data?.ranking;

    // Sort angles by overall_score (descending), preserving original index
    const selectedAngles = [...rawAngles]
        .map((angle: any, idx: number) => ({ ...angle, _originalIndex: idx }))
        .sort((a: any, b: any) => {
            const scoreA = a.overall_score ?? 0;
            const scoreB = b.overall_score ?? 0;
            return scoreB - scoreA; // Descending order (highest score first)
        });

    const selectedTopAngles = selectedAvatar?.v2_angles_data?.top_3_angles;
    const selectedNecessaryBeliefs = selectedAvatar?.v2_necessary_beliefs;

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [pendingAngle, setPendingAngle] = useState<{ angle: any, angleIndex: number } | null>(null);

    // Initial click handler - opens modal instead of generating immediately
    const handleGenerateAngle = useCallback(async (angle: any, angleIndex: number) => {
        setPendingAngle({ angle, angleIndex });
        setShowTemplateModal(true);
    }, []);

    // Actual generation logic
    const executeGeneration = useCallback(async (angle: any, angleIndex: number, templateIds: string[] = []) => {
        const angleKey = `${selectedAvatarIndex}-${angleIndex}`;
        const angleString = angle.angle_subtitle
            ? `${angle.angle_title}: ${angle.angle_subtitle}`
            : angle.angle_title;

        // Add to generating set
        setGeneratingAngles(prev => new Set(prev).add(angleKey));

        if (onGenerationStart) {
            onGenerationStart(angleString);
        }

        try {
            // Extract avatar_id and angle_id from the data structures
            const avatarId = selectedAvatar?.v2_avatar_data?.id || selectedAvatar?.id;
            const angleId = angle?.id;

            if (!avatarId || !angleId) {
                throw new Error('Missing avatar_id or angle_id. Please ensure you are using V2 job data.');
            }

            const response = await internalApiClient.generateSwipeFiles({
                original_job_id: jobId || "",
                avatar_id: avatarId,
                angle_id: angleId,
                swipe_file_ids: templateIds.length > 0 ? templateIds : undefined
            }) as any;

            const swipeFileJobId =
                response?.jobId ||
                response?.job_id ||
                response?.data?.jobId ||
                response?.data?.job_id ||
                response?.id ||
                response?.execution_id ||
                response?.data?.id ||
                response?.data?.execution_id;

            if (!swipeFileJobId) {
                throw new Error(`Failed to start generation. No job ID received.`);
            }

            toast({
                title: "Generation Started",
                description: `Creating content for "${angle.angle_title}"...`,
            });

            // Poll for status
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await internalApiClient.getSwipeFileStatus(swipeFileJobId) as any;
                    const status = statusRes.status || statusRes.data?.status;

                    if (status === 'SUCCEEDED') {
                        clearInterval(pollInterval);

                        setGeneratingAngles(prev => {
                            const next = new Set(prev);
                            next.delete(angleKey);
                            return next;
                        });

                        const result = await internalApiClient.getSwipeFileResult(swipeFileJobId) as any;

                        await internalApiClient.processSwipeFile({
                            jobId: jobId || "",
                            angle: angleString,
                            swipeFileResponse: result
                        });

                        toast({
                            title: "Generation Complete",
                            description: `Content for "${angle.angle_title}" is ready!`,
                        });

                        if (onGenerationComplete) {
                            onGenerationComplete(angleString);
                        }
                    } else if (status === 'FAILED') {
                        clearInterval(pollInterval);

                        setGeneratingAngles(prev => {
                            const next = new Set(prev);
                            next.delete(angleKey);
                            return next;
                        });

                        toast({
                            title: "Failed",
                            description: "Generation failed on server.",
                            variant: "destructive"
                        });

                        if (onGenerationError) {
                            onGenerationError(angleString);
                        }
                    }
                } catch (error) {
                    console.error('Error polling status:', error);
                    // Don't clear interval here to allow retries on network blips
                }
            }, 5000);

        } catch (error: any) {
            console.error("Error generating swipe files:", error);
            
            // Handle overage confirmation (402)
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

                // Set generating state again for retry
                setGeneratingAngles(prev => new Set(prev).add(angleKey));
                
                // Automatically retry with allowOverage=true
                try {
                    const response = await internalApiClient.generateSwipeFiles({
                        original_job_id: jobId || "",
                        avatar_id: selectedAvatar?.v2_avatar_data?.id || selectedAvatar?.id,
                        angle_id: angle?.id,
                        swipe_file_ids: templateIds.length > 0 ? templateIds : undefined,
                    }) as any;
                    
                    const swipeFileJobId =
                        response?.jobId ||
                        response?.job_id ||
                        response?.data?.jobId ||
                        response?.data?.job_id ||
                        response?.id ||
                        response?.execution_id ||
                        response?.data?.id ||
                        response?.data?.execution_id;

                    if (swipeFileJobId) {
                        toast({
                            title: "Generation Started",
                            description: `Creating content...`,
                        });

                        const pollInterval = setInterval(async () => {
                            try {
                                const statusRes = await internalApiClient.getSwipeFileStatus(swipeFileJobId) as any;
                                const status = statusRes.status || statusRes.data?.status;

                                if (status === 'SUCCEEDED') {
                                    clearInterval(pollInterval);
                                    setGeneratingAngles(prev => {
                                        const next = new Set(prev);
                                        next.delete(angleKey);
                                        return next;
                                    });
                                    if (onGenerationComplete) onGenerationComplete();
                                } else if (status === 'FAILED') {
                                    clearInterval(pollInterval);
                                    setGeneratingAngles(prev => {
                                        const next = new Set(prev);
                                        next.delete(angleKey);
                                        return next;
                                    });
                                    if (onGenerationError) onGenerationError("");
                                }
                            } catch (err) {
                                console.error('Error polling:', err);
                            }
                        }, 5000);
                    }
                } catch (retryError: any) {
                    toast({
                        title: "Error",
                        description: retryError.message || "Failed to generate pre-landers",
                        variant: "destructive",
                    });
                    setGeneratingAngles(prev => {
                        const next = new Set(prev);
                        next.delete(angleKey);
                        return next;
                    });
                }

                return;
            }

            toast({
                title: "Generation Failed",
                description: error.message || "Failed to start generation. Please try again.",
                variant: "destructive",
            });
            setGeneratingAngles(prev => {
                const newSet = new Set(prev);
                newSet.delete(angleKey);
                return newSet;
            });
            if (onGenerationError) {
                onGenerationError(angleString);
            }
        }
    }, [selectedAvatarIndex, selectedAvatar, jobId, onGenerationStart, onGenerationComplete, onGenerationError, toast]);

    const handleConfirmGeneration = (selectedTemplateId: string) => {
        if (pendingAngle) {
            executeGeneration(pendingAngle.angle, pendingAngle.angleIndex, [selectedTemplateId]);
            setShowTemplateModal(false);
            setPendingAngle(null);
        }
    };

    // Helper function to generate avatar-based numbering (1a, 1b, 1c... for first avatar, 2a, 2b... for second avatar, etc.)
    const getAvatarBasedNumber = (avatarIndex: number, angleIndex: number) => {
        const avatarNumber = avatarIndex + 1;
        const angleLetter = String.fromCharCode(97 + angleIndex); // 97 = 'a' in ASCII
        return `${avatarNumber}${angleLetter}`;
    };

    const handleSkipTemplates = () => {
        if (pendingAngle) {
            executeGeneration(pendingAngle.angle, pendingAngle.angleIndex, []);
            setShowTemplateModal(false);
            setPendingAngle(null);
        }
    };







            // Poll for status




    return (
        <div className="mb-12">
            <Accordion type="single" collapsible>
                <AccordionItem value="avatars-section">
                    <Card className="bg-card/80 border-border/50">
                        <AccordionTrigger className="p-8 hover:no-underline">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground">
                                            {title}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {"Data-driven avatars and marketing angles based on real customer language"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="px-8 pb-8 border-t border-border/50 pt-6">

                                {/* Two-Column Layout */}
                                <div className="grid grid-cols-1 lg:grid-cols-[50%_50%] gap-6">
                                    {/* Left Column: Avatar List */}
                                    <div className="space-y-2">
                                        <Card className="border border-border/60 bg-card">
                                            <CardHeader className="pb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                                                        <Users className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg">Customer Avatars</CardTitle>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="space-y-2">
                                                    {sortedAvatars.map((avatar, avatarIndex) => {
                                                        const angles = avatar.v2_angles_data?.generated_angles || [];
                                                        const avatarData = avatar.v2_avatar_data;
                                                        const isSelected = selectedAvatarIndex === avatarIndex;

                                                        return (
                                                            <Card
                                                                key={avatarIndex}
                                                                className={cn(
                                                                    "border rounded-xl transition-all duration-300 overflow-hidden relative shadow-sm cursor-pointer p-2",
                                                                    isSelected
                                                                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                                                        : "bg-card border-border/60 hover:border-primary/20"
                                                                )}
                                                                onClick={() => {
                                                                    setSelectedAvatarIndex(avatarIndex);
                                                                }}
                                                            >
                                                                {/* Active Indicator Bar */}
                                                                <div className={cn(
                                                                    "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all duration-300 transform origin-left",
                                                                    isSelected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
                                                                )} />

                                                                <div className="px-4 py-2">
                                                                    <div className="flex items-center justify-between w-full">
                                                                        <div className="flex items-center gap-4 flex-1">
                                                                            <div className="text-left space-y-1 flex-1">
                                                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-lg font-bold text-primary">{avatarIndex + 1}.</span>
                                                                                        <h4 className="font-bold text-lg text-foreground">
                                                                                            {avatarData?.overview?.name || avatar.persona_name}
                                                                                        </h4>
                                                                                    </div>
                                                                                    <div className="text-xs font-medium text-muted-foreground">
                                                                                        {angles.length} {angles.length === 1 ? 'Angle' : 'Angles'}
                                                                                    </div>
                                                                                </div>
                                                                                {(avatarData?.overview?.description || avatar.description) && (
                                                                                    <p className="text-sm text-muted-foreground max-w-2xl">
                                                                                        {avatarData?.overview?.description || avatar.description}
                                                                                    </p>
                                                                                )}
                                                                                {/* 2-Row 2-Column Grid Layout */}
                                                                                <div className="grid grid-cols-2 gap-4 w-full mt-2">
                                                                                    {/* Row 1: Age, Gender, Overall Score */}
                                                                                    <div className="flex items-center gap-4 flex-wrap">
                                                                                        {avatarData?.demographics?.age_range && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                                                                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                                                                                    {avatarData.demographics.age_range}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                        {avatarData?.demographics?.gender && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                                                                                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                                                                                    {avatarData.demographics.gender}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                        {avatarData?.overall_score !== undefined && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Award className="h-3.5 w-3.5 text-amber-500" />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                                                                                        {avatarData.overall_score}/5
                                                                                                    </span>
                                                                                                    <StarRating score={avatarData.overall_score} size="sm" />
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center justify-end">
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setOpenAvatarModal(avatarIndex);
                                                                                            }}
                                                                                            className="flex-shrink-0 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                                                        >
                                                                                            <Eye className="h-3.5 w-3.5" />
                                                                                            View Avatar Information
                                                                                        </Button>
                                                                                    </div>
                                                                                    {/* Row 2: Problem Urgency, Purchasing Power, Saturation Level, Audience Size */}
                                                                                    <div className="col-span-2 flex items-center gap-4 flex-wrap">
                                                                                        {/* {avatarData?.problem_urgency !== undefined && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs font-medium text-foreground">
                                                                                                        Problem Urgency: 
                                                                                                    </span>
                                                                                                    <span className="text-xs font-bold text-primary">
                                                                                                        {avatarData.problem_urgency}/5
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )} */}
                                                                                        {avatarData?.purchasing_power !== undefined && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Wallet className="h-3.5 w-3.5 text-green-500" />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs font-medium text-foreground">
                                                                                                        Purchasing Power: 
                                                                                                    </span>
                                                                                                    <span className="text-xs font-bold text-primary">
                                                                                                        {avatarData.purchasing_power}/5
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {avatarData?.saturation_level !== undefined && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Users className="h-3.5 w-3.5 text-blue-500" />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs font-medium text-foreground">
                                                                                                        Saturation Level: 
                                                                                                    </span>
                                                                                                    <span className="text-xs font-bold text-primary">
                                                                                                        {avatarData.saturation_level}/5
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {avatarData?.audience_size !== undefined && (
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-xs font-medium text-foreground">
                                                                                                        Audience Size: 
                                                                                                    </span>
                                                                                                    <span className="text-xs font-bold text-primary">
                                                                                                        {avatarData.audience_size}/5
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </Card>

                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Avatar Details Modal */}
                                        {sortedAvatars.map((avatar, avatarIndex) => {
                                            const avatarData = avatar.v2_avatar_data;

                                            return (
                                                <Dialog
                                                    key={avatarIndex}
                                                    open={openAvatarModal === avatarIndex}
                                                    onOpenChange={(open) => !open && setOpenAvatarModal(null)}
                                                >
                                                    <DialogContent className="max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                                                        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                                                            <div className="flex items-center gap-4">
                                                                <div>
                                                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                                                        <span className="text-lg font-bold text-primary">{avatarIndex + 1}.</span>
                                                                        {avatarData?.overview?.name || avatar.persona_name}
                                                                    </DialogTitle>
                                                                    {(avatarData?.overview?.description || avatar.description) && (
                                                                        <p className="text-sm text-muted-foreground mt-1">
                                                                            {avatarData?.overview?.description || avatar.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </DialogHeader>

                                                        <ScrollArea className="h-[calc(90vh-120px)] px-6 pb-6">
                                                            <div className="space-y-6 pt-4">
                                                                {/* Section 1: Avatar Overview & Complete Profile */}
                                                                <div className="border-border/50 pb-6">
                                                                    <div className="flex items-center gap-3 mb-4">
                                                                        <User className="h-4 w-4 text-primary" />
                                                                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                                            Avatar Overview & Complete Profile
                                                                        </h3>
                                                                    </div>
                                                                    <div className="space-y-6">
                                                                        {/* Overview */}
                                                                        {avatarData?.overview && (
                                                                            <div className="space-y-4">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <Target className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Overview</h4>
                                                                                </div>
                                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                                    {/* Description Box */}
                                                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                        <div className="text-sm italic text-foreground/80 leading-relaxed">
                                                                                            "{avatarData.overview.one_line_hook || avatarData.overview.description || "N/A"}"
                                                                                        </div>
                                                                                    </div>
                                                                                    
                                                                                    {/* Awareness Level Box */}
                                                                                    <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Eye className="h-3.5 w-3.5 text-emerald-500" />
                                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Awareness Level</span>
                                                                                        </div>
                                                                                        <div className="text-sm font-medium text-foreground">{avatarData.overview.awareness_level || "N/A"}</div>
                                                                                        {avatarData.overview.awareness_level_description && (
                                                                                            <div className="text-xs text-muted-foreground leading-relaxed pt-1">{avatarData.overview.awareness_level_description}</div>
                                                                                        )}
                                                                                    </div>
                                                                                    
                                                                                    {/* Market Sophistication Box */}
                                                                                    {avatarData.overview.market_sophistication && (() => {
                                                                                        const sophistication = avatarData.overview.market_sophistication;
                                                                                        return (
                                                                                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Brain className="h-3.5 w-3.5 text-purple-500" />
                                                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Market Sophistication</span>
                                                                                                    <span className="text-xs font-bold text-primary uppercase">{sophistication.level}</span>
                                                                                                </div>
                                                                                                <div className="text-xs text-muted-foreground leading-relaxed pt-1">{sophistication.rationale}</div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                                
                                                                                {/* Scoring Metrics Section */}
                                                                                {(avatarData.problem_urgency !== undefined || avatarData.purchasing_power !== undefined || 
                                                                                  avatarData.audience_size !== undefined || 
                                                                                  avatarData.overall_score !== undefined) && (
                                                                                    <div className="space-y-4 border-t border-border/50 pt-6">
                                                                                        <div className="flex items-center gap-2 mb-3">
                                                                                            <Award className="h-4 w-4 text-primary" />
                                                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Scoring Metrics</h4>
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                                            {avatarData.overall_score !== undefined && (
                                                                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <Award className="h-3.5 w-3.5 text-amber-500" />
                                                                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overall Score</span>
                                                                                                    </div>
                                                                                                    <div className="text-lg font-bold text-foreground">{avatarData.overall_score}/5</div>
                                                                                                </div>
                                                                                            )}
                                                                                            {avatarData.problem_urgency !== undefined && (() => {
                                                                                                const desc = getAvatarProblemUrgencyDescription(avatarData.problem_urgency);
                                                                                                return (
                                                                                                    <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Problem Urgency</span>
                                                                                                            <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                                                                        </div>
                                                                                                        <div className="text-lg font-bold text-foreground">{avatarData.problem_urgency}/5</div>
                                                                                                        <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                                                                    </div>
                                                                                                );
                                                                                            })()}
                                                                                            {avatarData.purchasing_power !== undefined && (() => {
                                                                                                const desc = getPurchasingPowerDescription(avatarData.purchasing_power);
                                                                                                return (
                                                                                                    <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <Wallet className="h-3.5 w-3.5 text-green-500" />
                                                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchasing Power</span>
                                                                                                            <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                                                                        </div>
                                                                                                        <div className="text-lg font-bold text-foreground">{avatarData.purchasing_power}/5</div>
                                                                                                        <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                                                                    </div>
                                                                                                );
                                                                                            })()}
                                                                                            {avatarData.audience_size !== undefined && (() => {
                                                                                                const desc = getAudienceSizeDescription(avatarData.audience_size);
                                                                                                return (
                                                                                                    <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <Users className="h-3.5 w-3.5 text-purple-500" />
                                                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience Size</span>
                                                                                                            <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                                                                        </div>
                                                                                                        <div className="text-lg font-bold text-foreground">{avatarData.audience_size}/5</div>
                                                                                                        <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                                                                    </div>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* Demographics */}
                                                                        {avatarData?.demographics && (
                                                                            <div className="space-y-4 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <Users className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Demographics</h4>
                                                                                </div>
                                                                                <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                    <div className="grid grid-cols-2 gap-6">
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Age Range</p>
                                                                                            <div className="text-sm font-medium text-foreground">{avatarData.demographics.age_range || "N/A"}</div>
                                                                                        </div>
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gender</p>
                                                                                            <div className="text-sm font-medium text-foreground">{avatarData.demographics.gender || "N/A"}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="space-y-1.5">
                                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Locations</p>
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {avatarData.demographics.locations && avatarData.demographics.locations.length > 0 ? (
                                                                                                avatarData.demographics.locations.map((loc: string, idx: number) => (
                                                                                                    <span key={idx} className="px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-medium rounded border border-blue-500/20">
                                                                                                        {loc}
                                                                                                    </span>
                                                                                                ))
                                                                                            ) : (
                                                                                                <span className="text-sm font-medium text-foreground/80">
                                                                                                    {avatarData.demographics.location_type || "N/A"}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="space-y-1.5">
                                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Professional Background</p>
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {avatarData.demographics.professional_background && avatarData.demographics.professional_background.length > 0 ? (
                                                                                                avatarData.demographics.professional_background.map((prof: string, idx: number) => (
                                                                                                    <span key={idx} className="px-2.5 py-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-medium rounded border border-purple-500/20">
                                                                                                        {prof}
                                                                                                    </span>
                                                                                                ))
                                                                                            ) : (
                                                                                                <span className="text-sm font-medium text-foreground/80">
                                                                                                    {avatarData.demographics.occupation || "N/A"}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="space-y-1.5">
                                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identities</p>
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {avatarData.demographics.identities && avatarData.demographics.identities.length > 0 ? (
                                                                                                avatarData.demographics.identities.map((identity: string, idx: number) => (
                                                                                                    <span key={idx} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-medium rounded border border-indigo-500/20">
                                                                                                        {identity}
                                                                                                    </span>
                                                                                                ))
                                                                                            ) : (
                                                                                                <span className="text-sm font-medium text-muted-foreground/30 italic text-xs">N/A</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Problem Experience */}
                                                                        {avatarData?.problem_experience && (
                                                                            <div className="space-y-4 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <Zap className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Problem Experience</h4>
                                                                                </div>
                                                                                <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                    <div className="grid grid-cols-2 gap-6">
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</p>
                                                                                            <div className="text-sm font-medium text-foreground">{avatarData.problem_experience.duration || "N/A"}</div>
                                                                                        </div>
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Severity</p>
                                                                                            <div className="text-sm font-medium text-foreground">{avatarData.problem_experience.severity || "N/A"}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                    {avatarData.problem_experience.trigger_event && (
                                                                                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger Event</p>
                                                                                            <div className="text-sm italic text-foreground/80 leading-relaxed">
                                                                                                {avatarData.problem_experience.trigger_event}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                    {avatarData.problem_experience.daily_life_impact && avatarData.problem_experience.daily_life_impact.length > 0 && (
                                                                                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Life Impact</p>
                                                                                            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 marker:text-primary">
                                                                                                {avatarData.problem_experience.daily_life_impact.map((impact: string, idx: number) => (
                                                                                                    <li key={idx}>{impact}</li>
                                                                                                ))}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Pain & Desire - Tabular Format */}
                                                                        {avatarData?.pain_desire && (
                                                                            <div className="space-y-4 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <Heart className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Pain & Desire</h4>
                                                                                </div>

                                                                                <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                                                    {/* Table Headers */}
                                                                                    <div className="grid grid-cols-[180px_1fr_1fr] bg-muted/20 border-b border-border/50">
                                                                                        <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                                            <Layers className="h-4 w-4 text-blue-500" />
                                                                                            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Cluster Type</span>
                                                                                        </div>
                                                                                        <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                                            <HeartCrack className="h-4 w-4 text-red-500" />
                                                                                            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Pain Clusters</span>
                                                                                        </div>
                                                                                        <div className="px-5 py-3.5 flex items-center gap-2">
                                                                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                                                                            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Desire Clusters</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Table Rows */}
                                                                                    <div className="divide-y divide-border/50">
                                                                                        {/* Surface Row */}
                                                                                        <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                                            <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                                                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Surface</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-4 border-r border-border/50">
                                                                                                <ExpandableList items={avatarData.pain_desire.pain?.surface} uniqueKey={`${avatarIndex}-surface-pain`} />
                                                                                            </div>
                                                                                            <div className="px-5 py-4">
                                                                                                {avatarData.pain_desire.desire?.surface ? (
                                                                                                    Array.isArray(avatarData.pain_desire.desire.surface) ? (
                                                                                                        <ExpandableList items={avatarData.pain_desire.desire.surface} uniqueKey={`${avatarIndex}-surface-desire`} />
                                                                                                    ) : (
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{avatarData.pain_desire.desire.surface}</span>
                                                                                                    )
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Emotional Row */}
                                                                                        <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                                            <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                                                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Emotional</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-4 border-r border-border/50">
                                                                                                <ExpandableList items={avatarData.pain_desire.pain?.emotional} uniqueKey={`${avatarIndex}-emotional-pain`} />
                                                                                            </div>
                                                                                            <div className="px-5 py-4">
                                                                                                {avatarData.pain_desire.desire?.emotional ? (
                                                                                                    Array.isArray(avatarData.pain_desire.desire.emotional) ? (
                                                                                                        <ExpandableList items={avatarData.pain_desire.desire.emotional} uniqueKey={`${avatarIndex}-emotional-desire`} />
                                                                                                    ) : (
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{avatarData.pain_desire.desire.emotional}</span>
                                                                                                    )
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Identity Row */}
                                                                                        <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                                            <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                                                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Identity</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-4 border-r border-border/50">
                                                                                                <ExpandableList items={avatarData.pain_desire.pain?.identity} uniqueKey={`${avatarIndex}-identity-pain`} />
                                                                                            </div>
                                                                                            <div className="px-5 py-4">
                                                                                                {avatarData.pain_desire.desire?.identity ? (
                                                                                                    Array.isArray(avatarData.pain_desire.desire.identity) ? (
                                                                                                        <ExpandableList items={avatarData.pain_desire.desire.identity} uniqueKey={`${avatarIndex}-identity-desire`} />
                                                                                                    ) : (
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{avatarData.pain_desire.desire.identity}</span>
                                                                                                    )
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Secret Row */}
                                                                                        <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                                            <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                                                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Secret</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-4 border-r border-border/50">
                                                                                                <ExpandableList items={avatarData.pain_desire.pain?.secret} uniqueKey={`${avatarIndex}-secret-pain`} />
                                                                                            </div>
                                                                                            <div className="px-5 py-4">
                                                                                                {avatarData.pain_desire.desire?.secret ? (
                                                                                                    Array.isArray(avatarData.pain_desire.desire.secret) ? (
                                                                                                        <ExpandableList items={avatarData.pain_desire.desire.secret} uniqueKey={`${avatarIndex}-secret-desire`} />
                                                                                                    ) : (
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{avatarData.pain_desire.desire.secret}</span>
                                                                                                    )
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Footer - Dominant Emotion */}
                                                                                    {avatarData.pain_desire.dominant_emotion && (
                                                                                        <div className="bg-muted/20 border-t border-border/50 p-4 px-6 flex items-center gap-2">
                                                                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dominant Emotion:</span>
                                                                                            <span className="text-sm font-medium text-foreground">{avatarData.pain_desire.dominant_emotion}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Failed Solutions */}
                                                                        {avatarData?.failed_solutions && (
                                                                            <div className="space-y-4 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <RotateCcw className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Failed Solutions</h4>
                                                                                </div>

                                                                                {avatarData.failed_solutions.solutions && avatarData.failed_solutions.solutions.length > 0 && (
                                                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                                                        {/* Table Header */}
                                                                                        <div className="grid grid-cols-[1fr_1.2fr_1.2fr] bg-muted/20 border-b border-border/50">
                                                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Solution Tried</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Why It Failed</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                                                <Target className="h-4 w-4 text-emerald-500" />
                                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Our Opportunity</span>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Table Content */}
                                                                                        <div className="divide-y divide-border/50">
                                                                                            {avatarData.failed_solutions.solutions.map((sol: any, idx: number) => (
                                                                                                <div key={idx} className="grid grid-cols-[1fr_1.2fr_1.2fr] hover:bg-muted/5 transition-colors">
                                                                                                    <div className="px-5 py-4 border-r border-border/50">
                                                                                                        <p className="text-sm font-medium text-foreground leading-relaxed">{sol.solution_tried || "N/A"}</p>
                                                                                                    </div>
                                                                                                    <div className="px-5 py-4 border-r border-border/50">
                                                                                                        <p className="text-sm text-foreground/80 leading-relaxed">{sol.why_it_failed || "N/A"}</p>
                                                                                                    </div>
                                                                                                    <div className="px-5 py-4">
                                                                                                        <p className="text-sm text-foreground/90 font-medium leading-relaxed">{sol.our_opportunity || "N/A"}</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                                    {avatarData.failed_solutions.money_already_spent && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Wallet className="h-4 w-4 text-orange-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Money Already Spent</h4>
                                                                                            </div>
                                                                                            <div className="text-sm text-foreground/80 leading-relaxed">{avatarData.failed_solutions.money_already_spent}</div>
                                                                                        </div>
                                                                                    )}
                                                                                    {avatarData.failed_solutions.current_coping && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Shield className="h-4 w-4 text-blue-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Current Coping</h4>
                                                                                            </div>
                                                                                            <div className="text-sm text-foreground/80 leading-relaxed">{avatarData.failed_solutions.current_coping}</div>
                                                                                        </div>
                                                                                    )}
                                                                                    {avatarData.failed_solutions.belief_about_failure && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Belief About Failure</h4>
                                                                                            </div>
                                                                                            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{avatarData.failed_solutions.belief_about_failure}</div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Objections & Buying */}
                                                                        {avatarData?.objections_buying && (
                                                                            <div className="space-y-6 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <Shield className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Objections & Buying Behavior</h4>
                                                                                </div>

                                                                                {/* Objections Boxes */}
                                                                                <div className="space-y-4">
                                                                                    {avatarData.objections_buying.primary_objection && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Primary Objection</h4>
                                                                                            </div>
                                                                                            <div className="text-sm italic text-foreground/80 leading-relaxed">
                                                                                                {avatarData.objections_buying.primary_objection}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {avatarData.objections_buying.hidden_objection && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Hidden Objection</h4>
                                                                                            </div>
                                                                                            <div className="text-sm italic text-foreground/80 leading-relaxed">
                                                                                                {avatarData.objections_buying.hidden_objection}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Decision Stats */}
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                    {avatarData.objections_buying.decision_style && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Brain className="h-4 w-4 text-indigo-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Decision Style</h4>
                                                                                            </div>
                                                                                            <div className="text-sm text-foreground/80 leading-relaxed">{avatarData.objections_buying.decision_style}</div>
                                                                                        </div>
                                                                                    )}
                                                                                    {avatarData.objections_buying.price_range && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Wallet className="h-4 w-4 text-emerald-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Price Range</h4>
                                                                                            </div>
                                                                                            <div className="text-sm text-foreground/80 leading-relaxed">{avatarData.objections_buying.price_range}</div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Buy/Walk Table */}
                                                                                {(avatarData.objections_buying.what_makes_them_buy || avatarData.objections_buying.what_makes_them_walk) && (
                                                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                                                        {/* Table Header */}
                                                                                        <div className="grid grid-cols-2 bg-muted/20 border-b border-border/50">
                                                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">What Makes Them Buy</span>
                                                                                            </div>
                                                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">What Makes Them Walk</span>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Table Content */}
                                                                                        <div className="grid grid-cols-2 divide-x divide-border/50">
                                                                                            {/* Buy Column */}
                                                                                            <div className="p-4 space-y-2">
                                                                                                {avatarData.objections_buying.what_makes_them_buy?.map((item: string, idx: number) => (
                                                                                                    <div key={idx} className="flex items-start gap-2">
                                                                                                        <span className="text-emerald-500 shrink-0">•</span>
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                                {!avatarData.objections_buying.what_makes_them_buy?.length && (
                                                                                                    <div className="text-muted-foreground/30 italic text-xs">N/A</div>
                                                                                                )}
                                                                                            </div>
                                                                                            {/* Walk Column */}
                                                                                            <div className="p-4 space-y-2">
                                                                                                {avatarData.objections_buying.what_makes_them_walk?.map((item: string, idx: number) => (
                                                                                                    <div key={idx} className="flex items-start gap-2">
                                                                                                        <span className="text-red-500 shrink-0">•</span>
                                                                                                        <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                                {!avatarData.objections_buying.what_makes_them_walk?.length && (
                                                                                                    <div className="text-muted-foreground/30 italic text-xs">N/A</div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* Raw Language */}
                                                                        {avatarData?.raw_language && (
                                                                            <div className="space-y-6 border-t border-border/50 pt-6">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <MessagesSquare className="h-4 w-4 text-primary" />
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Raw Language</h4>
                                                                                </div>

                                                                                {/* Quote Sections */}
                                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                                    {/* Pain Quotes */}
                                                                                    {avatarData.raw_language.pain_quotes && avatarData.raw_language.pain_quotes.length > 0 && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <HeartCrack className="h-4 w-4 text-red-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Pain Quotes</h4>
                                                                                            </div>
                                                                                            <div className="space-y-3">
                                                                                                {avatarData.raw_language.pain_quotes.map((q: any, idx: number) => (
                                                                                                    <div key={idx} className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                                                                                                        <div className="flex items-start gap-2">
                                                                                                            <Quote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                                                            <div className="flex-1 space-y-1">
                                                                                                                <div className="italic text-foreground/80 leading-relaxed">{q.quote}</div>
                                                                                                                {q.source && <div className="text-xs text-muted-foreground">— {q.source}</div>}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Desire Quotes */}
                                                                                    {avatarData.raw_language.desire_quotes && avatarData.raw_language.desire_quotes.length > 0 && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Sparkles className="h-4 w-4 text-amber-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Desire Quotes</h4>
                                                                                            </div>
                                                                                            <div className="space-y-3">
                                                                                                {avatarData.raw_language.desire_quotes.map((q: any, idx: number) => (
                                                                                                    <div key={idx} className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                                                                                                        <div className="flex items-start gap-2">
                                                                                                            <Quote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                                                            <div className="flex-1 space-y-1">
                                                                                                                <div className="italic text-foreground/80 leading-relaxed">{q.quote}</div>
                                                                                                                {q.source && <div className="text-xs text-muted-foreground">— {q.source}</div>}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Objection Quotes */}
                                                                                    {avatarData.raw_language.objection_quotes && avatarData.raw_language.objection_quotes.length > 0 && (
                                                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <Shield className="h-4 w-4 text-orange-500" />
                                                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Objection Quotes</h4>
                                                                                            </div>
                                                                                            <div className="space-y-3">
                                                                                                {avatarData.raw_language.objection_quotes.map((q: any, idx: number) => (
                                                                                                    <div key={idx} className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                                                                                                        <div className="flex items-start gap-2">
                                                                                                            <Quote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                                                            <div className="flex-1 space-y-1">
                                                                                                                <div className="italic text-foreground/80 leading-relaxed">{q.quote}</div>
                                                                                                                {q.source && <div className="text-xs text-muted-foreground">— {q.source}</div>}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Advertising Platforms */}
                                                                                {avatarData.advertising_platforms && (
                                                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                        <div className="flex items-center gap-2 mb-2">
                                                                                            <Megaphone className="h-4 w-4 text-blue-500" />
                                                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Advertising Platforms</h4>
                                                                                        </div>
                                                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                                                            {avatarData.advertising_platforms}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Use/Avoid Words */}
                                                                                {/*{(avatarData.raw_language.words_they_use || avatarData.raw_language.words_they_avoid) && (
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                        {/* Words They Use 
                                                                                        {avatarData.raw_language.words_they_use && (
                                                                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Words They Use</h4>
                                                                                                </div>
                                                                                                <div className="flex flex-wrap gap-2">
                                                                                                    {avatarData.raw_language.words_they_use.map((word: string, idx: number) => (
                                                                                                        <span key={idx} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded border border-emerald-500/20">
                                                                                                            {word}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Words They Avoid 
                                                                                        {avatarData.raw_language.words_they_avoid && (
                                                                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Words They Avoid</h4>
                                                                                                </div>
                                                                                                <div className="flex flex-wrap gap-2">
                                                                                                    {avatarData.raw_language.words_they_avoid.map((word: string, idx: number) => (
                                                                                                        <span key={idx} className="px-2.5 py-1 bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-medium rounded border border-red-500/20">
                                                                                                            {word}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}*/}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </ScrollArea>
                                                    </DialogContent>
                                                </Dialog>
                                            );
                                        })}
                                    </div>
                                    {/* Right Column: Marketing Angles for Selected Avatar */}
                                    <div className="space-y-6">
                                        <Card className="border border-border/60 bg-card">
                                            <CardHeader className="pb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                                                        <TrendingUp className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg">Marketing Angles</CardTitle>
                                                        <CardDescription>Click any angle to generate your pre-lander</CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                {/* Section 2: Necessary Beliefs */}
                                                {/*{selectedNecessaryBeliefs && (
                                                    <div className="space-y-4">
                                                        <Accordion type="single" collapsible className="w-full">
                                                            <AccordionItem value="necessary-beliefs" className="border-none">
                                                                <AccordionTrigger className="px-0 py-3 hover:no-underline">
                                                                    <div className="flex items-center gap-3">
                                                                        <Shield className="h-4 w-4 text-primary" />
                                                                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                                                            Necessary Beliefs
                                                                        </h3>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="px-0 pb-4 pt-0">
                                                                    <div className="bg-muted/10 border border-border/40 rounded p-4 text-sm text-foreground/80 leading-relaxed">
                                                                        <MarkdownContent content={selectedNecessaryBeliefs} />
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        </Accordion>
                                                    </div>
                                                )}*/}

                                                {/* Section 3: All Marketing Angles */}
                                                {(() => {
                                                    if (selectedAngles.length === 0) return null;

                                                    return (
                                                        <div className="space-y-4">
                                                            {/* <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                <Lightbulb className="h-4 w-4 text-primary" />
                                                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                                                All Marketing Angles
                                                                </h3>
                                                                <Badge variant="outline" className="bg-background">{selectedAngles.length} Total</Badge>
                                                                </div>
                                                            </div> */}


                                                            <div className="space-y-3">
                                                                {selectedAngles.map((angle: any, displayIndex: number) => {
                                                                    const originalIndex = angle._originalIndex !== undefined ? angle._originalIndex : displayIndex;
                                                                    const angleString = angle.angle_subtitle
                                                                        ? `${angle.angle_title}: ${angle.angle_subtitle}`
                                                                        : angle.angle_title;

                                                                    const isGenerated = generatedAngles.has(angleString) ||
                                                                        generatedAngles.has(angle.angle_title) ||
                                                                        (angle.angle_subtitle && generatedAngles.has(angle.angle_subtitle));

                                                                    const angleKey = `${selectedAvatarIndex}-${originalIndex}`;
                                                                    const isGenerating = generatingAngles.has(angleKey);

                                                                    // Assign medal based on position in sorted array (top 3 by overall_score)
                                                                    // First 3 positions (0, 1, 2) get medals (1, 2, 3)
                                                                    const medal = displayIndex < 3
                                                                        ? ((displayIndex + 1) as 1 | 2 | 3)
                                                                        : undefined;
                                                                    
                                                                    // Generate avatar-based numbering
                                                                    const avatarBasedNumber = getAvatarBasedNumber(selectedAvatarIndex, displayIndex);
                                                                    
                                                                    return (
                                                                        <MarketingAngleCardV2
                                                                            key={originalIndex}
                                                                            angle={angle}
                                                                            index={displayIndex}
                                                                            avatarBasedNumber={avatarBasedNumber}
                                                                            isGenerated={isGenerated}
                                                                            isGenerating={isGenerating}
                                                                            onGenerate={() => handleGenerateAngle(angle, originalIndex)}
                                                                            onRegenerate={() => handleGenerateAngle(angle, originalIndex)}
                                                                            medal={medal}
                                                                            offerBrief={offerBrief}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            </Accordion>
            {/* Template Selection Modal */}
            <TemplateSelectionModal
                open={showTemplateModal}
                onOpenChange={setShowTemplateModal}
                onConfirm={handleConfirmGeneration}
                onSkip={handleSkipTemplates}
                predictions={pendingAngle?.angle?.template_predictions?.predictions}
            />
        </div>
    );
}
