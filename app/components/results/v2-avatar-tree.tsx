"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/results/markdown-content";
import { AvatarDetailModal } from "@/components/results/avatar-detail-modal";
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
import { submitPreLanderGeneration } from "@/lib/services/prelander-generation";
import { getAvatarBasedNumber } from "@/lib/utils/avatar-utils";
import { MarketingAngleCardV2 } from "./marketing-angle-card-v2";
import { TemplateSelectionModal } from "./template-selection-modal";


// Detect and fix ALL CAPS text from AI-generated content
function normalizeCase(text: string): string {
    if (!text || text.length < 2) return text;
    const alpha = text.replace(/[^a-zA-Z]/g, '');
    const upper = alpha.replace(/[^A-Z]/g, '');
    if (alpha.length > 3 && upper.length / alpha.length > 0.7) {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return text;
}

function normalizeTitleCase(text: string): string {
    if (!text || text.length < 2) return text;
    const alpha = text.replace(/[^a-zA-Z]/g, '');
    const upper = alpha.replace(/[^A-Z]/g, '');
    if (alpha.length > 3 && upper.length / alpha.length > 0.7) {
        return text.toLowerCase().replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
    }
    return text;
}

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
                    <li key={idx}>{normalizeCase(item)}</li>
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

    // Sort avatars by overall score (highest first)
    const sortedAvatars = [...avatars].sort((a, b) => {
        const aScore = a.v2_avatar_data?.overall_score ?? 0;
        const bScore = b.v2_avatar_data?.overall_score ?? 0;
        return bScore - aScore; // Descending order (highest score first)
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
            const avatarId = selectedAvatar?.v2_avatar_data?.id || selectedAvatar?.id;
            const angleId = angle?.id;

            if (!avatarId || !angleId) {
                throw new Error('Missing avatar_id or angle_id. Please ensure you are using V2 job data.');
            }

            const { jobId: swipeFileJobId } = await submitPreLanderGeneration({
                original_job_id: jobId || "",
                avatar_id: avatarId,
                angle_id: angleId,
                swipe_file_ids: templateIds.length > 0 ? templateIds : undefined,
                toast,
            });

            toast({
                title: "Generation Started",
                description: `Creating content for "${angle.angle_title}"...`,
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
                                                                                            {normalizeTitleCase(avatarData?.overview?.name || avatar.persona_name || "")}
                                                                                        </h4>
                                                                                    </div>
                                                                                    <div className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                                                                                        {angles.length} {angles.length === 1 ? 'Angle' : 'Angles'}
                                                                                    </div>
                                                                                </div>
                                                                                {(avatarData?.overview?.description || avatar.description) && (
                                                                                    <p className="text-sm text-muted-foreground max-w-2xl">
                                                                                        {normalizeCase(avatarData?.overview?.description || avatar.description || "")}
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
                                                                                            More Info
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
                                        {sortedAvatars.map((avatar, avatarIndex) => (
                                            <AvatarDetailModal
                                                key={avatarIndex}
                                                avatar={avatar}
                                                index={avatarIndex}
                                                isOpen={openAvatarModal === avatarIndex}
                                                onOpenChange={(open) => !open && setOpenAvatarModal(null)}
                                            />
                                        ))}
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
