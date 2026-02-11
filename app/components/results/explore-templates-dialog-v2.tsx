"use client";

import { AvatarAngleSelectionDialog } from "./avatar-angle-selection-dialog";

interface ExploreTemplatesDialogV2Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    avatars: any[];
    onConfirm: (avatarIndex: number, angleIndices: number[]) => void;
}

export function ExploreTemplatesDialogV2({
    open,
    onOpenChange,
    avatars,
    onConfirm,
}: ExploreTemplatesDialogV2Props) {
    return (
        <AvatarAngleSelectionDialog
            open={open}
            onOpenChange={onOpenChange}
            avatars={avatars}
            onConfirm={onConfirm}
            dialogDescription={{
                avatar: "Choose the customer avatar you want to target with your content",
                angles: (avatarName) => `Select a marketing angle for ${avatarName || "this avatar"}`,
            }}
            confirmButtonLabel={{
                avatar: "Next: Select Angles",
                angles: () => "Continue to Templates",
            }}
            multiSelect={false}
            showTop3Angles={true}
        />
    );
}
