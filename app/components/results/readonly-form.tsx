"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { X, FileText, Globe, MapPin, Users, Sparkles } from "lucide-react";

interface ReadOnlyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: {
    title: string;
    sales_page_url: string;
    research_requirements?: string;
    gender?: string;
    location?: string;
    advertorial_type?: string;
  };
}

export function ReadOnlyForm({ open, onOpenChange, formData }: ReadOnlyFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="!max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <FileText className="h-5 w-5" />
            Project Input Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-blue-500" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold text-blue-500">
                  Project Title
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  readOnly
                  className="bg-muted/50 border-muted-foreground/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales_page_url" className="text-sm font-semibold text-blue-500">
                  Sales Page URL
                </Label>
                <Input
                  id="sales_page_url"
                  value={formData.sales_page_url}
                  readOnly
                  className="bg-muted/50 border-muted-foreground/20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Research Options Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Research Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="research_requirements" className="text-sm font-semibold text-blue-500">
                  Research Requirements
                </Label>
                <Textarea
                  id="research_requirements"
                  value={formData.research_requirements || "Not specified"}
                  readOnly
                  rows={3}
                  className="bg-muted/50 border-muted-foreground/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-sm font-semibold text-blue-500 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Target Gender
                  </Label>
                  <Input
                    id="gender"
                    value={formData.gender || "Not specified"}
                    readOnly
                    className="bg-muted/50 border-muted-foreground/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-semibold text-blue-500 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Target Location
                  </Label>
                  <Input
                    id="location"
                    value={formData.location || "Not specified"}
                    readOnly
                    className="bg-muted/50 border-muted-foreground/20"
                  />
                </div>
              </div>

              {/* <div className="space-y-2">
                <Label htmlFor="advertorial_type" className="text-sm font-semibold text-blue-500">
                  Advertorial Type
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                    {formData.advertorial_type || "Listicle"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Content generation format
                  </span>
                </div>
              </div> */}
            </CardContent>
          </Card>

          {/* Info Section */}
          {/* <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-2 text-primary">
                  AI-Powered Research
                </h4>
                <p className="text-sm text-muted-foreground">
                  This information was used to generate comprehensive research including customer avatars, 
                  marketing angles, and content tailored to your specific requirements.
                </p>
              </div>
            </div>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
