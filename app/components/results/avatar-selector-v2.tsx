"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { User, Users, Zap } from "lucide-react";

interface AvatarSelectorV2Props {
    avatars: any[];
    selectedAvatarIndex: number | null;
    onSelectAvatar: (index: number) => void;
    title?: string;
    description?: string;
}

// Helper function to get red shade classes based on intensity (1-16)
const getIntensityColorClasses = (intensity: number) => {
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

export function AvatarSelectorV2({
    avatars,
    selectedAvatarIndex,
    onSelectAvatar,
    title = "Select Avatar",
    description = "Choose the customer avatar for your content"
}: AvatarSelectorV2Props) {
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
                    const avatarName = avatarData?.overview?.name || avatar.persona_name || `Avatar ${index + 1}`;
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
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    {angles.length} {angles.length === 1 ? 'Angle' : 'Angles'}
                                                </div>
                                            </div>
                                            {avatarDescription && (
                                                <p className="text-sm text-muted-foreground max-w-2xl">
                                                    {avatarDescription}
                                                </p>
                                            )}
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
                                                {avatarData?.overview?.intensity !== undefined && (() => {
                                                    const intensity = avatarData.overview.intensity;
                                                    const colors = getIntensityColorClasses(intensity);
                                                    return (
                                                        <div className="flex items-center gap-1.5">
                                                            <Zap className={cn("h-3.5 w-3.5", colors.icon)} />
                                                            <span className={cn("text-xs font-medium", colors.text)}>
                                                                Intensity: {intensity}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
