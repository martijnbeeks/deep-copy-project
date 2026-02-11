"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { internalApiClient } from "@/lib/clients/internal-client";
import { TemplatePreview } from "@/components/template-preview";
import { useToast } from "@/hooks/use-toast";

interface TemplateSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (selectedTemplateId: string) => void;
    onSkip: () => void;
    predictions?: any[];
}

export function TemplateSelectionModal({
    open,
    onOpenChange,
    onConfirm,
    onSkip,
    predictions
}: TemplateSelectionModalProps) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            loadTemplates();
            setSelectedId(null); // Reset selection on open
        }
    }, [open]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await internalApiClient.getTemplates() as any;
            if (data && data.templates) {
                setTemplates(data.templates);
            } else if (Array.isArray(data)) {
                setTemplates(data);
            } else if (data && data.data) {
                setTemplates(data.data);
            } else {
                setTemplates([]);
            }
        } catch (error) {
            console.error("Failed to load templates:", error);
            toast({
                title: "Error",
                description: "Failed to load templates. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedId) {
            onConfirm(selectedId);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select a Template</DialogTitle>
                    <DialogDescription>
                        Choose a template to use as a base for your content generation, or skip to generate without one.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 pt-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No templates available.
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4 pt-4">
                                {[...templates]
                                    .sort((a, b) => {
                                        const scoreA = predictions?.find(p => p.template_id === a.id)?.overall_fit_score || 0;
                                        const scoreB = predictions?.find(p => p.template_id === b.id)?.overall_fit_score || 0;
                                        return scoreB - scoreA;
                                    })
                                    .map((template) => {
                                    const prediction = predictions?.find(p => p.template_id === template.id);
                                    return (
                                        <TemplatePreview
                                            key={template.id}
                                            template={{
                                                id: template.id,
                                                name: template.name,
                                                description: template.description || template.type,
                                                html_content: template.html || template.html_content || "",
                                                category: template.type
                                            }}
                                            isSelected={selectedId === template.id}
                                            onClick={() => setSelectedId(template.id)}
                                            prediction={prediction}
                                        />
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="p-6 pt-2 border-t mt-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                            {selectedId ? "1 template selected" : "No template selected"}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onSkip}>
                                Skip & Generate Anyway
                            </Button>
                            <Button 
                                onClick={handleConfirm} 
                                disabled={!selectedId}
                            >
                                Generate with Selected Template
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
