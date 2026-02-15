"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User, Users, Award, Star, Eye } from "lucide-react";
import { AvatarDetailModal } from "./avatar-detail-modal";

interface AvatarSelectorV2Props {
    avatars: any[];
    selectedAvatarIndex: number | null;
    onSelectAvatar: (index: number) => void;
    title?: string;
    description?: string;
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

export function AvatarSelectorV2({
    avatars,
    selectedAvatarIndex,
    onSelectAvatar,
    title = "Select Avatar",
    description = "Choose the customer avatar for your content"
}: AvatarSelectorV2Props) {
    const [openAvatarModal, setOpenAvatarModal] = useState<number | null>(null);

    // Sort avatars by intensity (highest first)
    const sortedAvatars = [...avatars].map((avatar, originalIndex) => ({
        ...avatar,
        _originalIndex: originalIndex
    })).sort((a, b) => {
        const aIntensity = a.v2_avatar_data?.overview?.intensity || 0;
        const bIntensity = b.v2_avatar_data?.overview?.intensity || 0;
        return bIntensity - aIntensity; // Descending order (highest first)
    });

    return (
        <div className="space-y-4">
            {title && (
                <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
            )}

            <div className="space-y-2">
                {sortedAvatars.map((avatar, displayIndex) => {
                    const originalIndex = avatar._originalIndex;
                    const isSelected = selectedAvatarIndex === originalIndex;
                    const avatarData = avatar.v2_avatar_data;
                    const avatarName = avatarData?.overview?.name || avatar.persona_name || `Avatar ${displayIndex + 1}`;
                    const avatarDescription = avatarData?.overview?.description || avatar.description || "";
                    const ageRange = avatarData?.demographics?.age_range || avatar.age_range || "";
                    const gender = avatarData?.demographics?.gender || avatar.gender || "";
                    const angles = avatar.v2_angles_data?.generated_angles || avatar.marketing_angles || [];

                    return (
                        <Card
                            key={originalIndex}
                            className={cn(
                                "border rounded-xl transition-all duration-300 overflow-hidden relative shadow-sm cursor-pointer p-2",
                                isSelected
                                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                    : "bg-card border-border/60 hover:border-primary/20"
                            )}
                            onClick={() => onSelectAvatar(originalIndex)}
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
                                                    <span className="text-lg font-bold text-primary">{displayIndex + 1}.</span>
                                                    <h4 className="font-bold text-lg text-foreground">
                                                        {avatarName}
                                                    </h4>
                                                </div>
                                                <div className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                                                    {angles.length} {angles.length === 1 ? 'Angle' : 'Angles'}
                                                </div>
                                            </div>
                                            {avatarDescription && (
                                                <p className="text-sm text-muted-foreground max-w-2xl">
                                                    {avatarDescription}
                                                </p>
                                            )}
                                            <div className="grid grid-cols-2 gap-4 w-full mt-2">
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    {ageRange && (
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                                                {ageRange}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {gender && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                                            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                                                {gender}
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
                                                            setOpenAvatarModal(originalIndex);
                                                        }}
                                                        className="flex-shrink-0 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        More Info
                                                    </Button>
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

            {/* Avatar Details Modals */}
            {sortedAvatars.map((avatar, displayIndex) => {
                const originalIndex = avatar._originalIndex;
                
                return (
                    <AvatarDetailModal
                        key={`modal-${originalIndex}`}
                        avatar={avatar}
                        index={displayIndex}
                        isOpen={openAvatarModal === originalIndex}
                        onOpenChange={(isOpen) => !isOpen && setOpenAvatarModal(null)}
                    />
                );
            })}
        </div>
    );
}
