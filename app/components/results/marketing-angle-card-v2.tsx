"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    CheckCircle2,
    Target,
    TrendingUp,
    Shield,
    Zap,
    Users,
    MessagesSquare,
    AlertCircle,
    ArrowRight,
    Loader2,
    FileText,
    Sparkles,
    HeartCrack,
    Quote,
    XCircle,
    Brain,
    Trophy,
    Star,
    BarChart3,
    Award,
    CheckCircle,
    Lightbulb,
    AlertTriangle,
    RotateCcw,
    Droplets,
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits";

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

interface QuoteItem {
    quote: string;
    source: string;
}

interface MarketingAngleV2 {
    angle_title: string;
    angle_subtitle: string;
    angle_type?: string;
    angle_mechanism?: string;
    emotional_driver?: string;
    risk_level?: string;
    core_argument?: string;
    why_selected?: string;
    primary_hook?: string;
    secondary_hooks?: string[];
    pain_points?: string[];
    desires?: string[];
    common_objections?: string[];
    failed_alternatives?: string[];
    copy_approach?: string[];
    target_audience?: string;
    target_age_range?: string;
    pain_quotes?: QuoteItem[];
    desire_quotes?: QuoteItem[];
    objection_quotes?: QuoteItem[];
    big_idea?: string;
    problem_mechanism_ump?: string;
    solution_mechanism_ums?: string;
    angle_problem_urgency?: number;
    novelty?: number;
    proof_strength?: number;
    avatar_fit?: number;
    ltv_potential?: number;
    saturation_level?: number;
    saturation?: string;
    overall_score?: number;
    market_size?: string;
    buying_readiness?: string;
}

interface MarketingAngleCardV2Props {
    angle: MarketingAngleV2;
    index: number;
    avatarBasedNumber?: number;
    isGenerated: boolean;
    isGenerating: boolean;
    onGenerate: () => void;
    onRegenerate: () => void;
    offerBrief?: any;
}

export function MarketingAngleCardV2({
    angle,
    index,
    avatarBasedNumber,
    isGenerated,
    isGenerating,
    onGenerate,
    onRegenerate,
    offerBrief
}: MarketingAngleCardV2Props) {
    const [isOpen, setIsOpen] = useState(false);

    // Helper functions for score descriptions
    const getProblemUrgencyDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Critical", description: "Life-altering, keeps them up at night, desperate" },
            4: { level: "High", description: "Daily frustration, significantly impacts quality of life" },
            3: { level: "Moderate", description: "Noticeable annoyance, motivated but can wait" },
            2: { level: "Low", description: "Aware of problem, not actively bothered" },
            1: { level: "Minimal", description: "Nice-to-fix, rarely thinks about it" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getNoveltyDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Breakthrough", description: "Never seen before, completely ownable" },
            4: { level: "Fresh", description: "Rarely used, feels new to audience" },
            3: { level: "Moderate", description: "Some competitors use similar messaging" },
            2: { level: "Common", description: "Frequently used, audience has seen it" },
            1: { level: "Exhausted", description: "Everyone says this, audience is numb" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getProofStrengthDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Iron-clad", description: "Clinical studies, third-party verification, expert endorsements" },
            4: { level: "Strong", description: "Solid testimonials, data points, mechanism explanation" },
            3: { level: "Moderate", description: "Logical argument, general research support" },
            2: { level: "Weak", description: "Anecdotal only, requires trust leap" },
            1: { level: "None", description: "Pure claim, no backing available" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getAvatarFitDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Perfect", description: "Mirrors their exact language, beliefs, situation" },
            4: { level: "Strong", description: "Resonates with core pain/desire, minor adaptation needed" },
            3: { level: "Moderate", description: "Relevant but not their primary concern" },
            2: { level: "Loose", description: "Tangential connection, may feel generic" },
            1: { level: "Mismatch", description: "Doesn't align with how they see themselves" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const getLTVPotentialDescription = (score: number): { level: string; description: string } => {
        const descriptions: Record<number, { level: string; description: string }> = {
            5: { level: "Excellent", description: "Attracts committed buyers, high repeat + referral" },
            4: { level: "Good", description: "Likely repeat customers, some referral behavior" },
            3: { level: "Moderate", description: "May repurchase, limited advocacy" },
            2: { level: "Low", description: "One-time buyers, price-sensitive" },
            1: { level: "Poor", description: "Bargain hunters, high refund risk" }
        };
        return descriptions[score] || { level: "Unknown", description: "" };
    };

    const hasQuotes = (
        (angle.pain_quotes?.length ?? 0) > 0 ||
        (angle.desire_quotes?.length ?? 0) > 0 ||
        (angle.objection_quotes?.length ?? 0) > 0
    );

    const renderList = (title: string, items: string[] | undefined, icon: React.ReactNode) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                    {icon}
                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h4>
                </div>
                <ul className="space-y-2">
                    {items.map((item, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex gap-2 leading-relaxed">
                            <span className="text-muted-foreground/40 flex-shrink-0 mt-1.5">•</span>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderQuoteSection = (title: string, quotes: QuoteItem[] | undefined, iconColor: string, icon: React.ReactNode) => {
        if (!quotes || quotes.length === 0) return null;
        return (
            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className={cn("h-4 w-4", iconColor)}>
                        {icon}
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h4>
                </div>
                <div className="space-y-3">
                    {quotes.map((item, i) => (
                        <div key={i} className="bg-card p-3 rounded-lg border border-border/50 text-sm">
                            <div className="flex items-start gap-2">
                                <Quote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 space-y-1">
                                    <div className="italic text-foreground/80 leading-relaxed">{item.quote}</div>
                                    {item.source && (
                                        <div className="text-xs text-muted-foreground">— {item.source}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <Card
                className={cn(
                    "border rounded-xl transition-all duration-300 overflow-hidden relative shadow-sm cursor-pointer p-2",
                    "bg-card border-border/60 hover:border-primary/20"
                )}
                onClick={() => setIsOpen(true)}
            >
                <div className="px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="text-left space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-lg text-foreground">
                                        <span className="text-lg font-bold text-primary">{avatarBasedNumber ? `${avatarBasedNumber}. ` : `${index + 1}. `}</span>
                                        {angle.angle_title}
                                    </h4>
                                </div>
                                {angle.angle_mechanism && (
                                    <div className="mt-2">
                                        <span className="text-xs font-medium text-white">Mechanism: </span>
                                        <span className="text-sm font-medium text-gray-400">{angle.angle_mechanism}</span>
                                    </div>
                                )}
                                <div className="mt-1">
                                    <span className="text-xs font-medium text-white">Outcome: </span>
                                    <span className="text-sm font-medium text-gray-400">{angle.angle_subtitle}</span>
                                </div>
                                
                                {/* Scoring Fields Section */}
                                {(angle.angle_problem_urgency !== undefined || angle.novelty !== undefined || 
                                  angle.proof_strength !== undefined || angle.avatar_fit !== undefined || 
                                  angle.ltv_potential !== undefined || angle.saturation_level !== undefined) && (
                                    <div className="flex items-center gap-4 flex-wrap mt-2">
                                        {angle.angle_problem_urgency !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Problem Urgency: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.angle_problem_urgency}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.novelty !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Novelty: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.novelty}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.proof_strength !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Proof Strength: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.proof_strength}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.avatar_fit !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <Target className="h-3.5 w-3.5 text-blue-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Avatar Fit: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.avatar_fit}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.ltv_potential !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        LTV Potential: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.ltv_potential}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.saturation_level !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-orange-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Saturation: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.saturation_level}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {angle.saturation && (
                                            <div className="flex items-center gap-1.5">
                                                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-white">
                                                        Saturation: 
                                                    </span>
                                                    <span className="text-xs font-bold text-primary">
                                                        {angle.saturation}/5
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* View Angle Information Button */}
                    <div className="flex justify-end mt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(true);
                            }}
                            className="flex-shrink-0 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            View Angle Information
                        </Button>
                    </div>
                    {/* Status badges positioned at bottom-right */}
                    {(isGenerated || isGenerating) && (
                        <div className="flex justify-end mt-2">
                            {isGenerated && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/50 shadow-sm">
                                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                    <span className="text-xs font-semibold text-green-700 dark:text-green-300">Generated</span>
                                </div>
                            )}
                            {isGenerating && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                                    <Loader2 className="h-3 w-3 text-blue-600 dark:text-blue-400 animate-spin" />
                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Generating...</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className={cn(
                        "px-6 pt-6 pb-4 border-b transition-colors duration-200",
                        isGenerated
                            ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200/50 dark:border-green-800/50"
                            : isGenerating
                                ? "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200/50 dark:border-blue-800/50"
                                : "border-border/50"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <DialogTitle className={cn(
                                    "text-xl font-bold flex items-center gap-2 transition-colors duration-200",
                                    isGenerated
                                        ? "text-green-900 dark:text-green-100"
                                        : isGenerating
                                            ? "text-blue-900 dark:text-blue-100"
                                            : "text-foreground"
                                )}>
                                    <span>
                                        <span className={cn(
                                            "text-lg font-bold",
                                            isGenerated
                                                ? "text-green-700 dark:text-green-300"
                                                : isGenerating
                                                    ? "text-blue-700 dark:text-blue-300"
                                                    : "text-primary"
                                        )}>{avatarBasedNumber ? `${avatarBasedNumber}. ` : `${index + 1}. `}</span>
                                        {angle.angle_title}
                                    </span>
                                </DialogTitle>
                                <p className={cn(
                                    "text-sm mt-1 italic transition-colors duration-200",
                                    isGenerated
                                        ? "text-green-700/80 dark:text-green-300/80"
                                        : isGenerating
                                            ? "text-blue-700/80 dark:text-blue-300/80"
                                            : "text-muted-foreground"
                                )}>
                                    "{angle.angle_subtitle}"
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isGenerating ? (
                                    <Button
                                        size="sm"
                                        variant="default"
                                        disabled
                                        className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white dark:border-blue-700"
                                    >
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                    </Button>
                                ) : isGenerated ? (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                // Close dialog first
                                                setIsOpen(false);
                                                // Use setTimeout to ensure dialog closes before opening accordion and scrolling
                                                setTimeout(() => {
                                                    // Find the accordion trigger button by looking for "Generated Pre-landers" text
                                                    const allButtons = Array.from(document.querySelectorAll('button'));
                                                    const accordionTrigger = allButtons.find(btn => {
                                                        const text = btn.textContent || '';
                                                        return text.includes('Generated Pre-landers') ||
                                                            text.includes('Generated marketing templates');
                                                    });

                                                    // If found and accordion is closed, click it to open
                                                    if (accordionTrigger) {
                                                        const state = accordionTrigger.getAttribute('data-state');
                                                        if (state === 'closed' || !state) {
                                                            accordionTrigger.click();
                                                        }
                                                    }

                                                    // Wait for accordion animation to complete, then scroll
                                                    setTimeout(() => {
                                                        const element = document.getElementById('generated-prelanders');
                                                        if (element) {
                                                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }
                                                    }, 500);
                                                }, 150);
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white border-green-600 dark:bg-green-700 dark:hover:bg-green-800 dark:text-white dark:border-green-700"
                                        >
                                            View Generated
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={onRegenerate}
                                        >
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                            Regenerate
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="default"
                                        onClick={onGenerate}
                                    >
                                        Generate ({JOB_CREDITS_BY_TYPE.pre_lander} Credits)
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="h-[calc(90vh-140px)] px-6 pb-6">
                        <div className="space-y-6 pt-4">
                            {/* Metadata Row */}
                            <div>
                                {/* {angle.emotional_driver && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap className="h-4 w-4 text-amber-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Emotional Driver</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">{angle.emotional_driver}</div>
                                    </div>
                                )} */}
                                {angle.target_audience && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-4 w-4 text-blue-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Target Audience</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                            {angle.target_audience} {angle.target_age_range && `(${angle.target_age_range})`}
                                        </div>
                                    </div>
                                )}
                                {/* {angle.angle_type && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="h-4 w-4 text-purple-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Angle Type</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">{angle.angle_type}</div>
                                    </div>
                                )} */}
                                {/* {angle.risk_level && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Risk Level</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">{angle.risk_level}</div>
                                    </div>
                                )} */}
                            </div>

                            {/* Scoring Metrics Grid */}
                            {(angle.overall_score !== undefined || angle.angle_problem_urgency !== undefined || angle.novelty !== undefined || 
                              angle.proof_strength !== undefined || angle.avatar_fit !== undefined || angle.ltv_potential !== undefined ||
                              angle.market_size || angle.buying_readiness) && (
                                <div className="space-y-4 border-t border-border/50 pt-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Scoring Metrics</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {angle.overall_score !== undefined && (
                                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <Award className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overall Score</span>
                                                </div>
                                                <div className="text-lg font-bold text-foreground">{angle.overall_score}/5</div>
                                            </div>
                                        )}
                                        {angle.angle_problem_urgency !== undefined && (() => {
                                            const desc = getProblemUrgencyDescription(angle.angle_problem_urgency);
                                            return (
                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Problem Urgency</span>
                                                        <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">{angle.angle_problem_urgency}/5</div>
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                </div>
                                            );
                                        })()}
                                        {angle.novelty !== undefined && (() => {
                                            const desc = getNoveltyDescription(angle.novelty);
                                            return (
                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novelty</span>
                                                        <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">{angle.novelty}/5</div>
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                </div>
                                            );
                                        })()}
                                        {angle.proof_strength !== undefined && (() => {
                                            const desc = getProofStrengthDescription(angle.proof_strength);
                                            return (
                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proof Strength</span>
                                                        <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">{angle.proof_strength}/5</div>
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                </div>
                                            );
                                        })()}
                                        {angle.avatar_fit !== undefined && (() => {
                                            const desc = getAvatarFitDescription(angle.avatar_fit);
                                            return (
                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="h-3.5 w-3.5 text-blue-500" />
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avatar Fit</span>
                                                        <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">{angle.avatar_fit}/5</div>
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                </div>
                                            );
                                        })()}
                                        {angle.ltv_potential !== undefined && (() => {
                                            const desc = getLTVPotentialDescription(angle.ltv_potential);
                                            return (
                                                <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">LTV Potential</span>
                                                        <span className="text-xs font-bold text-primary uppercase">{desc.level}</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-foreground">{angle.ltv_potential}/5</div>
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{desc.description}</div>
                                                </div>
                                            );
                                        })()}
                                        {angle.market_size && (
                                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Market Size</span>
                                                </div>
                                                <div className="text-lg font-bold text-foreground">{angle.market_size}/5</div>
                                            </div>
                                        )}
                                        {angle.saturation && (
                                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <Droplets className="h-3.5 w-3.5 text-blue-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saturation</span>
                                                </div>
                                                <div className="text-lg font-bold text-foreground">{angle.saturation}/5</div>
                                            </div>
                                        )}
                                        {angle.buying_readiness && (
                                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buying Readiness</span>
                                                </div>
                                                <div className="text-sm font-medium text-foreground capitalize">{angle.buying_readiness}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Core Argument */}
                                {angle.core_argument && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Brain className="h-4 w-4 text-indigo-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Strategic Argument</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                            {angle.core_argument}
                                        </div>
                                    </div>
                                )}

                                {/* Big Idea */}
                                {(angle.big_idea || offerBrief?.big_idea) && (
                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Big Idea</h4>
                                        </div>
                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                            {angle.big_idea || offerBrief?.big_idea}
                                        </div>
                                    </div>
                                )}

                                {/* UMP/UMS Section */}
                                {((angle.problem_mechanism_ump || offerBrief?.potential_ump?.[0]) || 
                                  (angle.solution_mechanism_ums || offerBrief?.potential_ums?.[0])) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(angle.problem_mechanism_ump || offerBrief?.potential_ump?.[0]) && (
                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Problem Mechanism (UMP)</h4>
                                                </div>
                                                <div className="text-sm text-foreground/80 leading-relaxed">
                                                    {angle.problem_mechanism_ump || offerBrief?.potential_ump?.[0] || offerBrief?.potential_ump?.join(' / ')}
                                                </div>
                                            </div>
                                        )}
                                        {(angle.solution_mechanism_ums || offerBrief?.potential_ums?.[0]) && (
                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Solution Mechanism (UMS)</h4>
                                                </div>
                                                <div className="text-sm text-foreground/80 leading-relaxed">
                                                    {angle.solution_mechanism_ums || offerBrief?.potential_ums?.[0] || offerBrief?.potential_ums?.join(' / ')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Hooks Section */}
                                {(angle.primary_hook || (angle.secondary_hooks?.length ?? 0) > 0) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {angle.primary_hook && (
                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Target className="h-4 w-4 text-red-500" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Primary Hook</h4>
                                                </div>
                                                <div className="text-sm italic text-foreground/80 leading-relaxed">
                                                    "{angle.primary_hook}"
                                                </div>
                                            </div>
                                        )}
                                        {angle.secondary_hooks && angle.secondary_hooks.length > 0 && (
                                            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <TrendingUp className="h-4 w-4 text-blue-500" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Secondary Hooks</h4>
                                                </div>
                                                <div className="space-y-2">
                                                    {angle.secondary_hooks.map((hook, i) => (
                                                        <div key={i} className="text-sm italic text-foreground/80 leading-relaxed">
                                                            "{hook}"
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Grid Lists Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {renderList("Pain Points", angle.pain_points, <AlertCircle className="h-4 w-4 text-red-500" />)}
                                {renderList("Desired Outcomes", angle.desires, <Sparkles className="h-4 w-4 text-emerald-500" />)}
                                {renderList("Key Objections", angle.common_objections, <Shield className="h-4 w-4 text-orange-500" />)}
                                {renderList("Failed Solutions", angle.failed_alternatives, <XCircle className="h-4 w-4 text-red-500" />)}
                            </div>

                            {/* Why Selected & Copy Approach */}
                            {/*<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 p-5 bg-muted/10 rounded-lg">
                            {renderList("Copy Strategy", angle.copy_approach, <FileText className="h-3 w-3 text-primary" />)}
                            {angle.why_selected && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                        Strategic Rationale
                                    </div>
                                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                                        {angle.why_selected}
                                    </p>
                                </div>
                            )}
                        </div>*/}

                            {/* Quotes Section - Voice of Customer */}
                            {hasQuotes && (
                                <div className="space-y-4 border-t border-border/50 pt-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MessagesSquare className="h-4 w-4 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Voice of Customer (Raw Research)</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderQuoteSection("Pain & Struggle", angle.pain_quotes, "text-red-500", <HeartCrack className="h-4 w-4" />)}
                                        {renderQuoteSection("Dreams & Desires", angle.desire_quotes, "text-amber-500", <Sparkles className="h-4 w-4" />)}
                                        {renderQuoteSection("Resistance & Objections", angle.objection_quotes, "text-orange-500", <Shield className="h-4 w-4" />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
