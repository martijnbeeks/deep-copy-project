import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload as UploadIcon, FileText, Target, Clock, Users, Zap, CheckCircle, Brain, Edit3, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Upload = () => {
  const { toast } = useToast();
  const [audienceType, setAudienceType] = useState<"known" | "explore">("explore");
  const [showUrlWarning, setShowUrlWarning] = useState(false);
  const [formData, setFormData] = useState({
    projectName: "",
    productPage: "",
    persona: "",
    ageRange: "",
    gender: "",
    companyType: "",
    productDescription: "",
    selectedAvatar: "broad"
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingDialog, setShowLoadingDialog] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  const [showResearchLoading, setShowResearchLoading] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchStage, setResearchStage] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState({
    productType: "",
    mainFunction: "",
    customerSegments: [] as string[],
    isAnalyzing: false
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Show URL warning popup when user starts typing in the product page field
    if (field === 'productPage' && value.length > 0 && !showUrlWarning) {
      setShowUrlWarning(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a project name.",
        variant: "destructive"
      });
      return;
    }
    if (!formData.productPage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide product page URL.",
        variant: "destructive"
      });
      return;
    }

    if (audienceType === "known" && !formData.persona.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a persona.",
        variant: "destructive"
      });
      return;
    }

    setShowLoadingDialog(true);
    setLoadingProgress(0);
    setLoadingStage(0);
    
    // Animate progress over 10 seconds with stages
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    // Change stages at specific intervals
    setTimeout(() => setLoadingStage(1), 2000);   // Stage 1 at 2s
    setTimeout(() => setLoadingStage(2), 4000);   // Stage 2 at 4s
    setTimeout(() => setLoadingStage(3), 6500);   // Stage 3 at 6.5s
    setTimeout(() => setLoadingStage(4), 8500);   // Stage 4 at 8.5s
    
    // Show verification after 10 seconds
    setTimeout(() => {
      clearInterval(progressInterval);
      setShowLoadingDialog(false);
      setShowVerification(true);
      setLoadingProgress(0);
      setLoadingStage(0);
      analyzeProduct();
    }, 10000);
  };

  const analyzeProduct = async () => {
    setAiAnalysis(prev => ({ ...prev, isAnalyzing: true }));
    
    // Simulate AI analysis based on product description
    setTimeout(() => {
      // Mock AI analysis - in real app this would call an AI service
      const analysis = generateMockAnalysis(formData.productPage);
      setAiAnalysis({
        ...analysis,
        isAnalyzing: false
      });
    }, 2000);
  };

  const generateMockAnalysis = (productDescription: string) => {
    // Simple keyword-based analysis for demo purposes
    const keywords = productDescription.toLowerCase();
    
    let productType = "Digital Service";
    let mainFunction = "foot pain relief device";
    let customerSegments = ["General consumers"];

    if (keywords.includes("saas") || keywords.includes("software") || keywords.includes("platform")) {
      productType = "SaaS";
      mainFunction = "project management software";
      customerSegments = ["Business professionals", "Small to medium enterprises", "Tech-savvy entrepreneurs"];
    } else if (keywords.includes("course") || keywords.includes("training") || keywords.includes("education")) {
      productType = "eCommerce";
      mainFunction = "online marketing course";
      customerSegments = ["Career-focused individuals", "Students and professionals", "Skill-upgrade seekers"];
    } else if (keywords.includes("ecommerce") || keywords.includes("shop") || keywords.includes("product")) {
      productType = "eCommerce";
      mainFunction = "foot pain relief device";
      customerSegments = ["Online shoppers", "Product enthusiasts", "Value-conscious buyers"];
    } else if (keywords.includes("fitness") || keywords.includes("health") || keywords.includes("wellness") || keywords.includes("pain") || keywords.includes("relief")) {
      productType = "D2C";
      mainFunction = "foot pain relief device";
      customerSegments = ["Health-conscious individuals", "Fitness enthusiasts", "Wellness seekers"];
    } else if (keywords.includes("agency") || keywords.includes("service") || keywords.includes("consulting")) {
      productType = "Agency";
      mainFunction = "digital marketing services";
      customerSegments = ["Business owners", "Entrepreneurs", "Companies seeking expertise"];
    }

    // Set the company type and product description in formData
    setFormData(prev => ({
      ...prev,
      companyType: productType,
      productDescription: mainFunction
    }));

    return {
      productType,
      mainFunction,
      customerSegments
    };
  };

  const handleAnalysisEdit = (field: string, value: string | string[]) => {
    setAiAnalysis(prev => ({ ...prev, [field]: value }));
  };

  const handleStartResearch = async () => {
    setShowVerification(false);
    setShowResearchLoading(true);
    setResearchProgress(0);
    setResearchStage(0);
    
    // Animate progress over 10 seconds with stages
    const progressInterval = setInterval(() => {
      setResearchProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    // Change stages at specific intervals
    setTimeout(() => setResearchStage(1), 2000);   // Stage 1 at 2s
    setTimeout(() => setResearchStage(2), 4000);   // Stage 2 at 4s
    setTimeout(() => setResearchStage(3), 6500);   // Stage 3 at 6.5s
    setTimeout(() => setResearchStage(4), 8500);   // Stage 4 at 8.5s
    
    // Complete after 10 seconds
    setTimeout(() => {
      clearInterval(progressInterval);
      setShowResearchLoading(false);
      setResearchProgress(0);
      setResearchStage(0);
      toast({
        title: "Research Complete!",
        description: "Your market analysis is ready to view.",
      });
      // Redirect to research results
      window.location.href = "/research";
    }, 10000);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">AI</span>
              </div>
              <span className="text-xl font-bold text-foreground">DeepCopy</span>
            </div>
            <Button variant="ghost" asChild>
              <a href="/">← Back to Home</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary">
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">Step 1: Input</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Tell Us About Your Product
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Help our AI understand your product, target audience, and goals to create 
            the most effective landing pages for your specific market.
          </p>
        </div>

        {/* Form */}
        <Card className="p-8 bg-card/80 border-border/50 shadow-elegant">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Product Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Product Information</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-base font-medium">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectName"
                  placeholder="e.g., Foot Pain Relief Campaign Q1"
                  value={formData.projectName}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Give your project a name to easily identify it later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productPage" className="text-base font-medium">
                  Product Page URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="productPage"
                  placeholder="https://example.com/product"
                  value={formData.productPage}
                  onChange={(e) => handleInputChange('productPage', e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter the URL to your existing product page.
                </p>
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent-foreground" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Target Audience</h2>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">
                  Choose Your Approach <span className="text-destructive">*</span>
                </Label>
                <RadioGroup value={audienceType} onValueChange={(value: "known" | "explore") => setAudienceType(value)}>
                  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="explore" id="explore" />
                    <Label htmlFor="explore" className="flex-1 cursor-pointer">
                      I want to explore new avatars that I can do research on
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="known" id="known" />
                    <Label htmlFor="known" className="flex-1 cursor-pointer">
                      I know exactly who my customer is
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {audienceType === "known" && (
                <>
                  <div className="space-y-2 mb-6 mt-6">
                    <Label htmlFor="persona" className="text-base font-medium">
                      Persona <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="persona"
                      placeholder="e.g., Diabetic neuropathy, anxious caffeine drinker"
                      value={formData.persona}
                      onChange={(e) => handleInputChange('persona', e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Describe your target customer persona or condition.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="ageRange" className="text-base font-medium">
                        Age Range <span className="text-muted-foreground text-sm">(Optional)</span>
                      </Label>
                      <Select onValueChange={(value) => handleInputChange('ageRange', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select age range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18-24">18-24 years</SelectItem>
                          <SelectItem value="25-34">25-34 years</SelectItem>
                          <SelectItem value="35-44">35-44 years</SelectItem>
                          <SelectItem value="45-54">45-54 years</SelectItem>
                          <SelectItem value="55-64">55-64 years</SelectItem>
                          <SelectItem value="65+">65+ years</SelectItem>
                          <SelectItem value="all">All ages</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-base font-medium">
                        Gender Targeting <span className="text-muted-foreground text-sm">(Optional)</span>
                      </Label>
                      <Select onValueChange={(value) => handleInputChange('gender', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender focus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="na">N/A (No preference)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              
              {audienceType === "explore" && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <Brain className="w-4 h-4 inline mr-2" />
                    Our AI will analyze your product and generate 5 different customer personas for you to explore and choose from.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-border/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Research typically takes 3-5 minutes
                </div>
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg"
                  disabled={isLoading}
                  className="text-lg px-8 py-6 h-auto min-w-[200px]"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      Starting Analysis...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-5 h-5 mr-2" />
                      Start AI Research
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-6 h-6 text-primary" />
              <h3 className="font-semibold text-foreground">Deep Analysis</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll analyze your competitors, target audience behavior, and market trends to identify winning strategies.
            </p>
          </Card>

          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-6 h-6 text-accent" />
              <h3 className="font-semibold text-foreground">Custom Copy</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Our AI will generate multiple versions of high-converting copy tailored to your specific audience and goals.
            </p>
          </Card>

          <Card className="p-6 bg-card/50 border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-6 h-6 text-primary" />
              <h3 className="font-semibold text-foreground">Ready to Launch</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Get complete landing pages with optimized layouts, compelling copy, and conversion-focused design elements.
            </p>
          </Card>
        </div>
      </main>

      {/* Verification Dialog */}
      <Dialog open={showVerification} onOpenChange={setShowVerification}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-primary" />
              Verify Your Research Parameters
            </DialogTitle>
            <DialogDescription>
              Please review the information below to ensure our AI research will be conducted for the correct product and audience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Product Page URL */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Product Page URL
              </h3>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-all">
                {formData.productPage}
              </p>
            </div>

            {/* Product Analysis */}
            {!aiAnalysis.isAnalyzing && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Product Analysis
                </h3>
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-type" className="text-sm font-medium flex items-center gap-2">
                      Company Type
                      <Edit3 className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="edit-company-type"
                      value={formData.companyType}
                      onChange={(e) => handleInputChange('companyType', e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-product-description" className="text-sm font-medium flex items-center gap-2">
                      Product Description
                      <Edit3 className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="edit-product-description"
                      value={formData.productDescription}
                      onChange={(e) => handleInputChange('productDescription', e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Product Description */}
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Your Product Summary
              </h3>
              <p className="text-base">
                We are a <span className="font-semibold text-primary">{formData.companyType}</span> company 
                selling <span className="font-semibold text-primary">{formData.productDescription}</span> to{" "}
                {audienceType === "known" ? (
                  <span className="font-semibold text-primary">{formData.persona}</span>
                ) : (
                  <span className="font-semibold text-primary">
                    {formData.selectedAvatar === "broad" ? "50+ individuals" : formData.selectedAvatar}
                  </span>
                )}
              </p>

              {/* Avatar Selection for Explore Mode */}
              {audienceType === "explore" && !aiAnalysis.isAnalyzing && (
                <div className="space-y-4 mt-4 p-5 bg-primary/5 border-2 border-primary/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <h4 className="text-base font-semibold text-foreground">
                      🎯 AI-Generated Target Avatars
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Our AI analyzed your product and identified these high-converting customer profiles. Select one for more targeted research:
                  </p>

                  {/* Avatar Cards */}
                  <Accordion type="single" collapsible className="w-full">
                    <div className="space-y-3">
                    {/* Keep it Broad Option */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "broad" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "broad")}
                    >
                      <AccordionItem value="broad" className="border-none">
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">🌐</span>
                              <div>
                                <div className="font-semibold text-base">Keep it broad (50+ individuals)</div>
                                <div className="text-xs text-muted-foreground">Age 18-55 • TAM: 5%</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {formData.selectedAvatar === "broad" && (
                                <CheckCircle className="w-5 h-5 text-primary" />
                              )}
                              <AccordionTrigger />
                            </div>
                          </div>
                        </div>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Pain Point:</span>
                              <p className="text-muted-foreground">General foot discomfort and fatigue from daily activities.</p>
                            </div>
                            <div>
                              <span className="font-medium">Emotion:</span>
                              <p className="text-muted-foreground">Wants relief but unsure which specific solution fits their needs.</p>
                            </div>
                            <div>
                              <span className="font-medium">Desire:</span>
                              <p className="text-muted-foreground">A versatile solution that works for various foot-related issues.</p>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <span className="font-medium">Objections:</span>
                              <p className="text-muted-foreground">• Is this really necessary for casual use?<br />• Will it work for my specific situation?<br />• Are there more targeted solutions available?</p>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <span className="font-medium">Failed Alternatives:</span>
                              <p className="text-muted-foreground">• Over-the-counter pain relief that only masks symptoms<br />• Generic foot massagers without specific benefits<br />• Ignoring the problem until it worsens</p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Card>

                    {/* The Exhausted Worker */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "The Exhausted Worker" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "The Exhausted Worker")}
                    >
                      <AccordionItem value="worker" className="border-none">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-lg">💼</span>
                                <div>
                                  <div className="font-semibold text-base">The Exhausted Worker</div>
                                  <div className="text-xs text-muted-foreground">Age 35-55 • Stands all day • TAM: 28%</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.selectedAvatar === "The Exhausted Worker" && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                                <AccordionTrigger />
                              </div>
                            </div>
                          </div>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Pain Point:</span>
                                <p className="text-muted-foreground">Stands all day at work (nurses, retail staff, warehouse workers). Feet ache, swell, and feel heavy every evening.</p>
                              </div>
                              <div>
                                <span className="font-medium">Emotion:</span>
                                <p className="text-muted-foreground">Feels drained and defeated when coming home, wants relief to enjoy family time instead of collapsing on the couch.</p>
                              </div>
                              <div>
                                <span className="font-medium">Desire:</span>
                                <p className="text-muted-foreground">Quick daily solution that soothes feet and restores energy without expensive spa visits.</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Objections:</span>
                                <p className="text-muted-foreground">• Will this actually help after a long shift?<br />• Can I afford another wellness expense?<br />• Do I have time to use this daily?</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Failed Alternatives:</span>
                                <p className="text-muted-foreground">• Compression socks that don't provide enough relief<br />• Soaking feet in warm water (temporary relief only)<br />• Pain medication with unwanted side effects</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                    </Card>

                    {/* The Active Senior */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "The Active Senior" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "The Active Senior")}
                    >
                        <AccordionItem value="senior" className="border-none">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-lg">🚶</span>
                                <div>
                                  <div className="font-semibold text-base">The Active Senior</div>
                                  <div className="text-xs text-muted-foreground">Age 55-75 • Circulation & arthritis • TAM: 22%</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.selectedAvatar === "The Active Senior" && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                                <AccordionTrigger />
                              </div>
                            </div>
                          </div>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Pain Point:</span>
                                <p className="text-muted-foreground">Struggles with circulation issues, arthritis, or nerve pain. Walking is stiff and uncomfortable.</p>
                              </div>
                              <div>
                                <span className="font-medium">Emotion:</span>
                                <p className="text-muted-foreground">Fears losing independence, dreads becoming "slowed down" or reliant on others.</p>
                              </div>
                              <div>
                                <span className="font-medium">Desire:</span>
                                <p className="text-muted-foreground">A simple, safe, at-home therapy that helps them stay mobile, independent, and confident.</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Objections:</span>
                                <p className="text-muted-foreground">• Is this safe for my medical conditions?<br />• Will it be too complicated to use?<br />• Can I use it with my current medications?</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Failed Alternatives:</span>
                                <p className="text-muted-foreground">• Prescription medications with side effects<br />• Physical therapy that's expensive and inconvenient<br />• Supportive shoes that provide minimal improvement</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                    </Card>

                    {/* The Fitness Enthusiast */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "The Fitness Enthusiast" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "The Fitness Enthusiast")}
                    >
                        <AccordionItem value="fitness" className="border-none">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-lg">🏃</span>
                                <div>
                                  <div className="font-semibold text-base">The Fitness Enthusiast</div>
                                  <div className="text-xs text-muted-foreground">Age 25-45 • Active lifestyle • TAM: 18%</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.selectedAvatar === "The Fitness Enthusiast" && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                                <AccordionTrigger />
                              </div>
                            </div>
                          </div>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Pain Point:</span>
                                <p className="text-muted-foreground">Runs, cycles, or goes to the gym often. Feet are sore from overuse, tight shoes, or high-impact training.</p>
                              </div>
                              <div>
                                <span className="font-medium">Emotion:</span>
                                <p className="text-muted-foreground">Frustrated that recovery takes too long, slowing progress and motivation.</p>
                              </div>
                              <div>
                                <span className="font-medium">Desire:</span>
                                <p className="text-muted-foreground">Fast, effective recovery tool to reduce swelling, speed healing, and improve performance.</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Objections:</span>
                                <p className="text-muted-foreground">• Will this actually improve my recovery time?<br />• Is it worth adding to my routine?<br />• Can I use it right after intense workouts?</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Failed Alternatives:</span>
                                <p className="text-muted-foreground">• Ice baths that are uncomfortable and inconvenient<br />• Foam rollers that don't target feet specifically<br />• Rest days that slow down training progress</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                    </Card>

                    {/* The Silent Sufferer */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "The Silent Sufferer" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "The Silent Sufferer")}
                    >
                        <AccordionItem value="sufferer" className="border-none">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-lg">😔</span>
                                <div>
                                  <div className="font-semibold text-base">The Silent Sufferer</div>
                                  <div className="text-xs text-muted-foreground">Age 40-65 • Chronic foot pain • TAM: 20%</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.selectedAvatar === "The Silent Sufferer" && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                                <AccordionTrigger />
                              </div>
                            </div>
                          </div>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Pain Point:</span>
                                <p className="text-muted-foreground">Chronic foot pain (plantar fasciitis, neuropathy, swelling). Tried pills, creams, and even considered surgery.</p>
                              </div>
                              <div>
                                <span className="font-medium">Emotion:</span>
                                <p className="text-muted-foreground">Feels hopeless, worried the pain will never go away, scared of invasive medical treatments.</p>
                              </div>
                              <div>
                                <span className="font-medium">Desire:</span>
                                <p className="text-muted-foreground">Non-invasive, safe relief that actually works — restoring hope and comfort.</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Objections:</span>
                                <p className="text-muted-foreground">• I've tried everything — why would this work?<br />• Is this another gimmick that won't help?<br />• Can this handle my severe chronic pain?</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Failed Alternatives:</span>
                                <p className="text-muted-foreground">• Prescription pain medications with limited effectiveness<br />• Expensive custom orthotics with minimal improvement<br />• Multiple doctor visits without lasting solutions</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                    </Card>

                    {/* The Caregiver / Gift Buyer */}
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedAvatar === "The Caregiver / Gift Buyer" 
                          ? "border-2 border-primary bg-primary/10" 
                          : "border border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleInputChange("selectedAvatar", "The Caregiver / Gift Buyer")}
                    >
                        <AccordionItem value="caregiver" className="border-none">
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-lg">💝</span>
                                <div>
                                  <div className="font-semibold text-base">The Caregiver / Gift Buyer</div>
                                  <div className="text-xs text-muted-foreground">Age 30-60 • Buying for loved ones • TAM: 12%</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {formData.selectedAvatar === "The Caregiver / Gift Buyer" && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                                <AccordionTrigger />
                              </div>
                            </div>
                          </div>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Pain Point:</span>
                                <p className="text-muted-foreground">Buys for aging parents, partner, or loved ones struggling with foot pain.</p>
                              </div>
                              <div>
                                <span className="font-medium">Emotion:</span>
                                <p className="text-muted-foreground">Feels guilty seeing someone they love in constant discomfort. Wants to help but unsure how.</p>
                              </div>
                              <div>
                                <span className="font-medium">Desire:</span>
                                <p className="text-muted-foreground">A thoughtful, practical, proven gift that gives comfort and shows love.</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Objections:</span>
                                <p className="text-muted-foreground">• Will they actually use it regularly?<br />• Is this too impersonal as a gift?<br />• What if it doesn't work for their specific issue?</p>
                              </div>
                              <div className="pt-2 border-t border-border">
                                <span className="font-medium">Failed Alternatives:</span>
                                <p className="text-muted-foreground">• Generic wellness gifts that go unused<br />• Gift cards that lack personal touch<br />• Advice and sympathy without practical solutions</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                    </Card>
                    </div>
                  </Accordion>

                  <p className="text-xs text-muted-foreground italic mt-3">
                    💡 Selecting a specific avatar helps our AI create hyper-targeted copy that converts better
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowVerification(false)}
            >
              Edit Information
            </Button>
            <Button 
              variant="hero" 
              onClick={handleStartResearch}
              disabled={isLoading}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Start
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading Dialog */}
      <Dialog open={showLoadingDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg border-border">
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center">
                <Brain className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
            </div>

            {/* Title - Changes based on stage */}
            <h3 className="text-2xl font-bold text-foreground text-center animate-fade-in">
              {loadingStage === 0 && "Analyzing Your Product Page"}
              {loadingStage === 1 && "Extracting Key Features"}
              {loadingStage === 2 && "Identifying Customer Avatars"}
              {loadingStage === 3 && "Generating Persona Profiles"}
              {loadingStage === 4 && "Preparing Parameters"}
            </h3>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {loadingProgress}% Complete
              </p>
            </div>

            {/* Stage-specific messages */}
            <div className="space-y-3 w-full animate-fade-in">
              {loadingStage === 0 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Crawling your product page and analyzing content structure...
                  </p>
                </div>
              )}
              
              {loadingStage === 1 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Identifying product benefits, features, and unique value propositions...
                  </p>
                </div>
              )}

              {loadingStage === 2 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing market data to identify potential customer avatars...
                  </p>
                </div>
              )}

              {loadingStage === 3 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Creating detailed customer personas with pain points and desires...
                  </p>
                </div>
              )}

              {loadingStage === 4 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Compiling research parameters for your review...
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Analyzing your product and generating avatars
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Research Generation Loading Dialog */}
      <Dialog open={showResearchLoading} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg border-border">
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center">
                <Zap className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
            </div>

            {/* Title - Changes based on stage */}
            <h3 className="text-2xl font-bold text-foreground text-center animate-fade-in">
              {researchStage === 0 && "Scanning Market Sources"}
              {researchStage === 1 && "Analyzing Customer Reviews"}
              {researchStage === 2 && "Evaluating Competitors"}
              {researchStage === 3 && "Mining Reddit & Forums"}
              {researchStage === 4 && "Generating Copy Angles"}
            </h3>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary transition-all duration-300 ease-out"
                  style={{ width: `${researchProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {researchProgress}% Complete
              </p>
            </div>

            {/* Stage-specific messages */}
            <div className="space-y-3 w-full animate-fade-in">
              {researchStage === 0 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Checking Amazon reviews, industry publications, and market databases...
                  </p>
                </div>
              )}
              
              {researchStage === 1 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing customer feedback, pain points, and satisfaction patterns...
                  </p>
                </div>
              )}

              {researchStage === 2 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scanning competitor landing pages and dissecting their messaging strategies...
                  </p>
                </div>
              )}

              {researchStage === 3 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Extracting insights from Reddit discussions, forums, and community feedback...
                  </p>
                </div>
              )}

              {researchStage === 4 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Creating compelling marketing angles and high-converting copy variations...
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Deep-diving into market research and competitive analysis
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Warning Alert Dialog */}
      <AlertDialog open={showUrlWarning} onOpenChange={setShowUrlWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Important: Product URL
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Make sure to enter the URL of the product, service or offer you want to sell - not your general business URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowUrlWarning(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Upload;