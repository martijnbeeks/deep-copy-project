"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
    User, Users, Wallet, Heart, HeartCrack, Sparkles, Zap, Shield, RotateCcw,
    Brain, XCircle, AlertCircle, Quote, Eye, Target, Layers, Award, Megaphone,
    CheckCircle2, MessagesSquare, Star
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

interface AvatarDetailModalProps {
    avatar: any;
    index: number;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AvatarDetailModal({
    avatar,
    index,
    isOpen,
    onOpenChange
}: AvatarDetailModalProps) {
    const avatarData = avatar.v2_avatar_data;
    const avatarName = avatarData?.overview?.name || avatar.persona_name || `Avatar ${index + 1}`;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
                    <div className="flex items-center gap-4">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <span className="text-lg font-bold text-primary">{index + 1}.</span>
                                {normalizeTitleCase(avatarName)}
                            </DialogTitle>
                            {(avatarData?.overview?.description || avatar.description) && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {normalizeCase(avatarData?.overview?.description || avatar.description || "")}
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
                                                    &ldquo;{normalizeCase(avatarData.overview.one_line_hook || avatarData.overview.description || "N/A")}&rdquo;
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
                                                    <div className="text-xs text-muted-foreground leading-relaxed pt-1">{normalizeCase(avatarData.overview.awareness_level_description)}</div>
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
                                                        <div className="text-xs text-muted-foreground leading-relaxed pt-1">{normalizeCase(sophistication.rationale || "")}</div>
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
                                                        {normalizeCase(avatarData.problem_experience.trigger_event)}
                                                    </div>
                                                </div>
                                            )}
                                            {avatarData.problem_experience.daily_life_impact && avatarData.problem_experience.daily_life_impact.length > 0 && (
                                                <div className="space-y-1.5 pt-2 border-t border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Life Impact</p>
                                                    <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 marker:text-primary">
                                                        {avatarData.problem_experience.daily_life_impact.map((impact: string, idx: number) => (
                                                            <li key={idx}>{normalizeCase(impact)}</li>
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
                                                        <ExpandableList items={avatarData.pain_desire.pain?.surface} uniqueKey={`${index}-surface-pain`} />
                                                    </div>
                                                    <div className="px-5 py-4">
                                                        {avatarData.pain_desire.desire?.surface ? (
                                                            Array.isArray(avatarData.pain_desire.desire.surface) ? (
                                                                <ExpandableList items={avatarData.pain_desire.desire.surface} uniqueKey={`${index}-surface-desire`} />
                                                            ) : (
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(avatarData.pain_desire.desire.surface)}</span>
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
                                                        <ExpandableList items={avatarData.pain_desire.pain?.emotional} uniqueKey={`${index}-emotional-pain`} />
                                                    </div>
                                                    <div className="px-5 py-4">
                                                        {avatarData.pain_desire.desire?.emotional ? (
                                                            Array.isArray(avatarData.pain_desire.desire.emotional) ? (
                                                                <ExpandableList items={avatarData.pain_desire.desire.emotional} uniqueKey={`${index}-emotional-desire`} />
                                                            ) : (
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(avatarData.pain_desire.desire.emotional)}</span>
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
                                                        <ExpandableList items={avatarData.pain_desire.pain?.identity} uniqueKey={`${index}-identity-pain`} />
                                                    </div>
                                                    <div className="px-5 py-4">
                                                        {avatarData.pain_desire.desire?.identity ? (
                                                            Array.isArray(avatarData.pain_desire.desire.identity) ? (
                                                                <ExpandableList items={avatarData.pain_desire.desire.identity} uniqueKey={`${index}-identity-desire`} />
                                                            ) : (
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(avatarData.pain_desire.desire.identity)}</span>
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
                                                        <ExpandableList items={avatarData.pain_desire.pain?.secret} uniqueKey={`${index}-secret-pain`} />
                                                    </div>
                                                    <div className="px-5 py-4">
                                                        {avatarData.pain_desire.desire?.secret ? (
                                                            Array.isArray(avatarData.pain_desire.desire.secret) ? (
                                                                <ExpandableList items={avatarData.pain_desire.desire.secret} uniqueKey={`${index}-secret-desire`} />
                                                            ) : (
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(avatarData.pain_desire.desire.secret)}</span>
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
                                                    <span className="text-sm font-medium text-foreground">{normalizeCase(avatarData.pain_desire.dominant_emotion)}</span>
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
                                                                <p className="text-sm font-medium text-foreground leading-relaxed">{normalizeCase(sol.solution_tried || "N/A")}</p>
                                                            </div>
                                                            <div className="px-5 py-4 border-r border-border/50">
                                                                <p className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(sol.why_it_failed || "N/A")}</p>
                                                            </div>
                                                            <div className="px-5 py-4">
                                                                <p className="text-sm text-foreground/90 font-medium leading-relaxed">{normalizeCase(sol.our_opportunity || "N/A")}</p>
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
                                                    <div className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(avatarData.failed_solutions.current_coping)}</div>
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
                                                        {normalizeCase(avatarData.objections_buying.primary_objection)}
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
                                                        {normalizeCase(avatarData.objections_buying.hidden_objection)}
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
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(item)}</span>
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
                                                                <span className="text-sm text-foreground/80 leading-relaxed">{normalizeCase(item)}</span>
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
                                                                        <div className="italic text-foreground/80 leading-relaxed">{normalizeCase(q.quote)}</div>
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
                                                                        <div className="italic text-foreground/80 leading-relaxed">{normalizeCase(q.quote)}</div>
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
                                                                        <div className="italic text-foreground/80 leading-relaxed">{normalizeCase(q.quote)}</div>
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
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
