"use client";

import { AvatarAngleSelectionDialog } from "./avatar-angle-selection-dialog";

interface StaticAdsDialogV2Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    avatars: any[];
    onConfirm: (avatarIndex: number, angleIndices: number[]) => void;
}

export function StaticAdsDialogV2({
    open,
    onOpenChange,
    avatars,
    onConfirm,
}: StaticAdsDialogV2Props) {
    return (
        <AvatarAngleSelectionDialog
            open={open}
            onOpenChange={onOpenChange}
            avatars={avatars}
            onConfirm={onConfirm}
            dialogContentClassName="max-w-4xl max-h-[90vh] overflow-y-auto"
            dialogDescription={{
                avatar: "Choose the customer avatar for your static ads",
                angles: (avatarName) => `Select one or more marketing angles for ${avatarName || "this avatar"}`,
            }}
            confirmButtonLabel={{
                avatar: "Next: Select Angles",
                angles: (count) => `Generate Static Ads (${count} angle${count !== 1 ? "s" : ""} selected)`,
            }}
            multiSelect={true}
        />
    );
}
