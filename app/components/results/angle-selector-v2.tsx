"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Star, Eye } from "lucide-react";
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
                    


                    return (
                        <Card
                            key={originalIndex}
                            className={cn(
                                "border rounded-xl transition-all duration-300 overflow-hidden relative shadow-sm cursor-pointer p-2",
                                isSelected
                                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                    : "bg-card border-border/60 hover:border-primary/20"
                            )}
                            onClick={() => onToggleAngle(originalIndex)}
                        >


                            {/* Active Indicator Bar */}
                            <div className={cn(
                                "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all duration-300 transform origin-left",
                                isSelected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
                            )} />

                            <div className="px-4 py-2">
                                <div className="text-left space-y-1 w-full min-w-0">
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

                                    <div className="grid grid-cols-2 gap-4 w-full mt-2">
                                        <div className="flex items-center gap-4 flex-wrap">
                                            {angle.overall_score !== undefined && (
                                                <div className="flex items-center gap-1.5">
                                                    <Award className="h-3.5 w-3.5 text-amber-500" />
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                                            {angle.overall_score}/5
                                                        </span>
                                                        <StarRating score={angle.overall_score} size="sm" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
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
