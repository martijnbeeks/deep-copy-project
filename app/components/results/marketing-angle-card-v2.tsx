"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Star, AlertCircle, Sparkles, Target, TrendingUp, Users, Droplets, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits";
import { AngleDetailModal } from "./angle-detail-modal";

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
    avatarBasedNumber?: string;
    isGenerated: boolean;
    isGenerating: boolean;
    onGenerate: () => void;
    onRegenerate: () => void;
    offerBrief?: any;
    medal?: 1 | 2 | 3 | undefined;
}

export function MarketingAngleCardV2({
    angle,
    index,
    avatarBasedNumber,
    isGenerated,
    isGenerating,
    onGenerate,
    onRegenerate,
    offerBrief,
    medal
}: MarketingAngleCardV2Props) {
    const [isOpen, setIsOpen] = useState(false);

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
                                        <span className="text-xs font-medium text-foreground">Mechanism: </span>
                                        <span className="text-sm font-medium text-gray-400">{angle.angle_mechanism}</span>
                                    </div>
                                )}
                                <div className="mt-1">
                                    <span className="text-xs font-medium text-foreground">Outcome: </span>
                                    <span className="text-sm font-medium text-gray-400">{angle.angle_subtitle}</span>
                                </div>
                                
                                {/* Scoring Fields Section */}
                                {(angle.angle_problem_urgency !== undefined || angle.novelty !== undefined || 
                                  angle.proof_strength !== undefined || angle.avatar_fit !== undefined || 
                                  angle.ltv_potential !== undefined || angle.saturation_level !== undefined) && (
                                    <div className="grid grid-cols-3 gap-y-2 gap-x-4 mt-3">
                                        {angle.angle_problem_urgency !== undefined && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-foreground">
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
                                                    <span className="text-xs font-medium text-foreground">
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
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs font-medium text-foreground">
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
                                                    <span className="text-xs font-medium text-foreground">
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
                                                    <span className="text-xs font-medium text-foreground">
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
                                                    <span className="text-xs font-medium text-foreground">
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
                                                    <span className="text-xs font-medium text-foreground">
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
                            More Info
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

            <AngleDetailModal
                angle={angle}
                index={index}
                avatarBasedNumber={avatarBasedNumber}
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                isGenerated={isGenerated}
                isGenerating={isGenerating}
                onGenerate={onGenerate}
                onRegenerate={onRegenerate}
                showActions={true}
            />
        </>
    );
}
