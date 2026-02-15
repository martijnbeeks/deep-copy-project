"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AngleDetailModal } from "./angle-detail-modal";

interface AngleSelectorV2Props {
    angles: any[];
    selectedAngles: number[];
    onToggleAngle: (index: number) => void;
    avatarName?: string;
    title?: string;
    description?: string;
    multiSelect?: boolean;
    top3Angles?: any; // top_3_angles from avatar data
    ranking?: number[]; // ranking array from avatar data
}



export function AngleSelectorV2({
    angles,
    selectedAngles,
    onToggleAngle,
    avatarName,
    title = "Select Marketing Angles",
    description,
    multiSelect = true,
    top3Angles,
    ranking
}: AngleSelectorV2Props) {
    const [openAngleModal, setOpenAngleModal] = useState<number | null>(null);



    // Sort angles by overall_score (descending), preserving original index
    const sortedAngles = [...angles]
        .map((angle: any, idx: number) => ({ ...angle, _originalIndex: idx }))
        .sort((a: any, b: any) => {
            const scoreA = a.overall_score ?? 0;
            const scoreB = b.overall_score ?? 0;
            return scoreB - scoreA; // Descending order (highest score first)
        });

    return (
        <div className="space-y-4">
            {title && (
                <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    )}
                    {avatarName && (
                        <p className="text-sm font-medium text-primary mt-2">
                            For avatar: {avatarName}
                        </p>
                    )}
                </div>
            )}

            <div className="space-y-2">
                {sortedAngles.map((angle: any, displayIndex: number) => {
                    const originalIndex = angle._originalIndex !== undefined ? angle._originalIndex : displayIndex;
                    const isSelected = selectedAngles.includes(originalIndex);
                    const angleTitle = angle.angle_title || angle.title || `Angle ${displayIndex + 1}`;
                    const angleSubtitle = angle.angle_subtitle || angle.subtitle || "";
                    
                    // Assign medal based on position in sorted array (top 3 by overall_score)
                    // First 3 positions (0, 1, 2) get medals (1, 2, 3)
                    const medal = displayIndex < 3
                        ? ((displayIndex + 1) as 1 | 2 | 3)
                        : undefined;

                    return (
                        <Card
                            key={originalIndex}
                            className={cn(
                                "border rounded-xl transition-all duration-300 overflow-hidden relative shadow-sm cursor-pointer p-2",
                                isSelected
                                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                    : medal
                                        ? cn(
                                            "border-2",
                                            medal === 1
                                                ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20 shadow-md shadow-amber-500/10"
                                                : medal === 2
                                                    ? "border-slate-400/50 bg-slate-50/30 dark:bg-slate-950/20 shadow-md shadow-slate-500/10"
                                                    : "border-amber-800/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-md shadow-amber-800/10"
                                        )
                                        : "bg-card border-border/60 hover:border-primary/20"
                            )}
                            onClick={() => onToggleAngle(originalIndex)}
                        >
                            {/* Modern Pill Badge in Corner with Tooltip */}
                            {medal && (
                                <div
                                    className={cn(
                                        "absolute -top-1 -right-0.5 z-10 group",
                                        "transform rotate-12" // Slight rotation for dynamic effect
                                    )}
                                >
                                    <div className={cn(
                                        "relative flex items-center justify-center gap-1 px-2.5 py-1 rounded-full shadow-lg",
                                        "border-2 border-white/30",
                                        medal === 1
                                            ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"
                                            : medal === 2
                                                ? "bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500"
                                                : "bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900"
                                    )}>
                                        <Trophy className="h-3 w-3 text-white drop-shadow-md" />
                                        <span className="text-xs font-bold text-white drop-shadow-md">
                                            #{medal}
                                        </span>
                                        {/* Subtle glow effect */}
                                        <div className={cn(
                                            "absolute inset-0 rounded-full blur-sm opacity-40 -z-10",
                                            medal === 1
                                                ? "bg-amber-400"
                                                : medal === 2
                                                    ? "bg-slate-400"
                                                    : "bg-amber-700"
                                        )} />
                                    </div>
                                    {/* Tooltip - positioned downward, counter-rotated, slightly left */}
                                    <div className="absolute right-4 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 transform -rotate-12">
                                        <div className="bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg relative">
                                            {medal === 1 ? "🏆 Top Pick" : medal === 2 ? "🥈 2nd Choice" : "🥉 3rd Choice"}
                                            {/* Arrow pointing up */}
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent border-b-foreground"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Active Indicator Bar */}
                            <div className={cn(
                                "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all duration-300 transform origin-left",
                                isSelected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
                            )} />

                            <div className="px-4 py-2">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="text-left space-y-1 flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg text-foreground">
                                                    <span className="text-lg font-bold text-primary">{displayIndex + 1}. </span>
                                                    {angleTitle}
                                                </h4>
                                            </div>
                                            {angleSubtitle && (
                                                <p className="text-sm text-muted-foreground max-w-2xl">
                                                    {angleSubtitle}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenAngleModal(originalIndex);
                                            }}
                                            className="flex-shrink-0 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                            More Info
                                        </Button>
                                        {isSelected && (
                                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                                Selected
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Angle Details Modals */}
            {sortedAngles.map((angle: any, displayIndex: number) => {
                const originalIndex = angle._originalIndex !== undefined ? angle._originalIndex : displayIndex;
                
                return (
                    <AngleDetailModal
                        key={`modal-${originalIndex}`}
                        angle={angle}
                        index={displayIndex}
                        isOpen={openAngleModal === originalIndex}
                        onOpenChange={(isOpen) => !isOpen && setOpenAngleModal(null)}
                        showActions={false}
                    />
                );
            })}
        </div>
    );
}
