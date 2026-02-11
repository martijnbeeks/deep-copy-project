"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvatarSelectorV2 } from "./avatar-selector-v2";
import { AngleSelectorV2 } from "./angle-selector-v2";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits";

interface AvatarAngleSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    avatars: any[];
    onConfirm: (avatarIndex: number, angleIndices: number[]) => void;
    
    // Customization options
    multiSelect?: boolean;
    dialogTitle?: {
        avatar?: string;
        angles?: string;
    };
    dialogDescription?: {
        avatar?: string;
        angles?: (avatarName?: string) => string;
    };
    confirmButtonLabel?: {
        avatar?: string;
        angles?: (count: number) => string;
    };
    cancelButtonLabel?: string;
    backButtonLabel?: string;
    dialogContentClassName?: string;
    showTop3Angles?: boolean;
}

export function AvatarAngleSelectionDialog({
    open,
    onOpenChange,
    avatars,
    onConfirm,
    multiSelect = false,
    dialogTitle = {
        avatar: "Select Customer Avatar",
        angles: "Select Marketing Angles",
    },
    dialogDescription,
    confirmButtonLabel = {
        avatar: "Next: Select Angles",
        angles: (count) => `Continue (${count} ${count === 1 ? "angle" : "angles"} selected)`,
    },
    cancelButtonLabel = "Cancel",
    backButtonLabel = "Back to Avatars",
    dialogContentClassName = "!max-w-[95vw] max-h-[90vh] overflow-y-auto",
    showTop3Angles = false,
}: AvatarAngleSelectionDialogProps) {
    // Set default dialogDescription after multiSelect is available
    const defaultDialogDescription = {
        avatar: "Choose the customer avatar you want to target with your content",
        angles: (avatarName?: string) => `Select ${multiSelect ? "one or more" : "a"} marketing angle${multiSelect ? "s" : ""} for ${avatarName || "this avatar"}`,
    };
    
    const finalDialogDescription = dialogDescription || defaultDialogDescription;
    const [step, setStep] = useState<"avatar" | "angles">("avatar");
    const [selectedAvatarIndex, setSelectedAvatarIndex] = useState<number | null>(null);
    const [selectedAngleIndices, setSelectedAngleIndices] = useState<number[]>([]);

    const handleAvatarSelect = (index: number) => {
        setSelectedAvatarIndex(index);
        // Reset angle selection when avatar changes
        setSelectedAngleIndices([]);
    };

    const handleAngleToggle = (index: number) => {
        if (multiSelect) {
            setSelectedAngleIndices((prev) =>
                prev.includes(index)
                    ? prev.filter((i) => i !== index)
                    : [...prev, index]
            );
        } else {
            // Single-select mode: replace the selection
            setSelectedAngleIndices([index]);
        }
    };

    const handleNext = () => {
        if (step === "avatar" && selectedAvatarIndex !== null) {
            setStep("angles");
        }
    };

    const handleBack = () => {
        if (step === "angles") {
            setStep("avatar");
            setSelectedAngleIndices([]);
        }
    };

    const handleConfirm = () => {
        if (selectedAvatarIndex !== null && selectedAngleIndices.length > 0) {
            onConfirm(selectedAvatarIndex, selectedAngleIndices);
            handleClose();
        }
    };

    const handleClose = () => {
        setStep("avatar");
        setSelectedAvatarIndex(null);
        setSelectedAngleIndices([]);
        onOpenChange(false);
    };

    const selectedAvatar = selectedAvatarIndex !== null ? avatars[selectedAvatarIndex] : null;
    const availableAngles = selectedAvatar?.marketing_angles || selectedAvatar?.v2_angles_data?.generated_angles || [];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={dialogContentClassName}>
                <DialogHeader>
                    <DialogTitle>
                        {step === "avatar" ? dialogTitle.avatar : dialogTitle.angles}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "avatar"
                            ? finalDialogDescription.avatar
                            : finalDialogDescription.angles?.(selectedAvatar?.persona_name)}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {step === "avatar" ? (
                        <AvatarSelectorV2
                            avatars={avatars}
                            selectedAvatarIndex={selectedAvatarIndex}
                            onSelectAvatar={handleAvatarSelect}
                            title=""
                            description=""
                        />
                    ) : (
                        <AngleSelectorV2
                            angles={availableAngles}
                            selectedAngles={selectedAngleIndices}
                            onToggleAngle={handleAngleToggle}
                            avatarName={selectedAvatar?.persona_name}
                            title=""
                            description=""
                            multiSelect={multiSelect}
                            top3Angles={showTop3Angles ? selectedAvatar?.v2_angles_data?.top_3_angles : undefined}
                            ranking={showTop3Angles ? selectedAvatar?.v2_angles_data?.ranking : undefined}
                        />
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    <div className="flex gap-2">
                        {step === "angles" && (
                            <Button variant="outline" onClick={handleBack}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                {backButtonLabel}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClose}>
                            {cancelButtonLabel}
                        </Button>
                        {step === "avatar" ? (
                            <Button
                                onClick={handleNext}
                                disabled={selectedAvatarIndex === null}
                            >
                                {confirmButtonLabel.avatar}
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleConfirm}
                                disabled={selectedAngleIndices.length === 0}
                            >
                                {confirmButtonLabel.angles?.(selectedAngleIndices.length)} ({selectedAngleIndices.length * JOB_CREDITS_BY_TYPE.pre_lander} Credits)
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
