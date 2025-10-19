import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Target, 
  Heart, 
  MessageSquare,
  AlertTriangle,
  Star,
  TrendingUp,
  Brain,
  Quote,
  ArrowRight,
  Download,
  Share2,
  FileText,
  MapPin,
  DollarSign,
  Briefcase,
  Zap,
  Eye,
  Sparkles,
  CheckCircle2
} from "lucide-react";

interface MarketingAngle {
  id: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  targetAge: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  marketingAngles: string[];
  conversionPotential: number;
  targetAudience: string;
}

const mockMarketingAngles: MarketingAngle[] = [
  {
    id: "1",
    title: "Time-Saving Business Automation",
    summary: "Target overwhelmed entrepreneurs who need quick, automated marketing solutions without learning complex systems.",
    priority: "high",
    targetAge: "35-45 years",
    painPoints: [
      "No time for marketing while running daily operations",
      "Wearing too many hats as a business owner",
      "Can't afford expensive agencies or consultants"
    ],
    desires: [
      "Automated marketing that works without constant attention",
      "Quick results that justify the investment",
      "Simple solutions that don't require marketing expertise"
    ],
    objections: [
      "Another tool that promises results but doesn't deliver",
      "Too expensive for current budget constraints",
      "Too complicated to implement quickly"
    ],
    marketingAngles: [
      "Set & Forget Marketing System",
      "Done-For-You Landing Pages in 5 Minutes",
      "No Marketing Experience Required"
    ],
    conversionPotential: 87,
    targetAudience: "Small business owners, Solo entrepreneurs"
  },
  {
    id: "2", 
    title: "Data-Driven Performance Marketing",
    summary: "Appeal to marketing professionals who need sophisticated tools to prove ROI and optimize conversion rates.",
    priority: "high",
    targetAge: "28-40 years",
    painPoints: [
      "Pressure to show measurable marketing results",
      "Limited budget but high expectations",
      "Conversion rates plateauing despite efforts"
    ],
    desires: [
      "Tools that provide deep analytical insights",
      "Ability to optimize based on real data",
      "Professional growth through proven results"
    ],
    objections: [
      "Integration complexity with existing tools",
      "Learning curve might slow down current projects",
      "Price point compared to current solutions"
    ],
    marketingAngles: [
      "Advanced Analytics & Conversion Optimization",
      "Professional-Grade Marketing Intelligence",
      "Competitive Edge Through Data Insights"
    ],
    conversionPotential: 92,
    targetAudience: "Marketing managers, Growth professionals"
  },
  {
    id: "3",
    title: "Scalable Agency Solutions",
    summary: "Focus on agency owners who need to deliver consistent results for clients while building profitable operations.",
    priority: "medium",
    targetAge: "32-50 years", 
    painPoints: [
      "Difficulty proving consistent ROI to clients",
      "Manual processes don't scale with client growth",
      "Price pressure while maintaining quality service"
    ],
    desires: [
      "Standardized processes that ensure quality",
      "White-label solutions for client delivery",
      "Higher profit margins on projects"
    ],
    objections: [
      "Client expectations for custom solutions",
      "Implementation time across multiple accounts",
      "Training team on new systems"
    ],
    marketingAngles: [
      "White-Label Client Success Platform",
      "Scale Your Agency Without Hiring",
      "Guarantee Client Results With Proven System"
    ],
    conversionPotential: 78,
    targetAudience: "Agency owners, Client service managers"
  },
  {
    id: "4",
    title: "E-commerce Conversion Boost",
    summary: "Target online store owners who need better converting product pages and checkout optimization.",
    priority: "high",
    targetAge: "25-45 years",
    painPoints: [
      "High traffic but low conversion rates",
      "Cart abandonment issues",
      "Fierce competition in online marketplace"
    ],
    desires: [
      "Higher conversion rates from existing traffic",
      "Professional-looking product pages",
      "Competitive advantage in crowded market"
    ],
    objections: [
      "Already invested in current e-commerce platform",
      "Concerns about disrupting existing sales",
      "Technical integration complexity"
    ],
    marketingAngles: [
      "Double Your E-commerce Conversion Rate",
      "Professional Product Pages That Sell",
      "Beat Your Competition With Better Pages"
    ],
    conversionPotential: 85,
    targetAudience: "E-commerce owners, Online retailers"
  },
  {
    id: "5",
    title: "Course Creator Revenue Maximizer", 
    summary: "Appeal to online educators and course creators who need better sales pages for their educational content.",
    priority: "medium",
    targetAge: "30-50 years",
    painPoints: [
      "Great content but poor conversion on sales pages",
      "Difficulty communicating course value effectively",
      "Competition from established course platforms"
    ],
    desires: [
      "Sales pages that convert visitors into students",
      "Professional presentation of course content",
      "Higher revenue per course launch"
    ],
    objections: [
      "Investment in marketing vs course development",
      "Time to create and optimize sales materials",
      "Uncertainty about which messaging works"
    ],
    marketingAngles: [
      "Course Sales Pages That Convert Students",
      "Professional Education Marketing Made Easy",
      "Maximize Revenue From Your Expertise"
    ],
    conversionPotential: 73,
    targetAudience: "Course creators, Online educators"
  }
];

const Research = () => {
  const [selectedAngle, setSelectedAngle] = useState<string>("");

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-gradient-primary text-primary-foreground";
      case "medium": return "bg-gradient-accent text-accent-foreground"; 
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-32">
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
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="ghost" asChild>
                <a href="/">← Back to Home</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Step 2: Completed Research and Angle Selection</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Research Results
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto">
            Review your customer avatar, offer brief, and select your marketing angle
          </p>
        </div>

        {/* Customer Avatar Document Section */}
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="avatar-doc">
              <Card className="bg-card/80 border-border/50">
                <div className="p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Customer Avatar Research</h2>
                        <p className="text-sm text-muted-foreground">Comprehensive profile of your ideal customer</p>
                      </div>
                    </div>
                    <AccordionTrigger />
                  </div>
                </div>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-8 border-t border-border/50 pt-6">
                    {/* Demographics & General Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        🔍 Demographic & General Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Age Range:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">35-45 years</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Gender:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">60% Male, 40% Female</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Location:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">North America, Western Europe</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Monthly Revenue:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">$5,000 - $50,000</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Professional Backgrounds:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Small business owners, Solo entrepreneurs, Marketing professionals, E-commerce operators</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-foreground">Typical Identities:</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Self-starters, growth-minded individuals, time-constrained business owners, digital-first entrepreneurs</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Key Challenges & Pain Points */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        🚩 Key Challenges & Pain Points
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">Pain Point 1: Time Constraints</h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> No time for marketing while running daily operations</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Wearing too many hats as a business owner</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Constantly putting off marketing because of urgent tasks</li>
                          </ul>
                        </div>
                        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">Pain Point 2: Budget Limitations</h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Can&apos;t afford expensive agencies or consultants</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Previous marketing investments didn&apos;t deliver ROI</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Hesitant to spend more on unproven solutions</li>
                          </ul>
                        </div>
                        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">Pain Point 3: Technical Complexity</h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Overwhelmed by marketing tools and platforms</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Lack of technical skills to implement solutions</li>
                            <li className="flex items-start gap-2"><span className="text-destructive">•</span> Fear of making wrong decisions with technology</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Goals & Aspirations */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Star className="w-5 h-5 text-primary" />
                        🌟 Goals & Aspirations
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            Short-Term Goals
                          </h4>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Get professional marketing materials up quickly</li>
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Improve conversion rates on existing traffic</li>
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Automate repetitive marketing tasks</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            Long-Term Aspirations
                          </h4>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Build a scalable, predictable marketing system</li>
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Achieve consistent business growth without burnout</li>
                            <li className="flex items-start gap-2"><span className="text-primary">✓</span> Create financial security and freedom</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Emotional Drivers & Psychological Insights */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Brain className="w-5 h-5 text-accent" />
                        🧠 Emotional Drivers & Psychological Insights
                      </h3>
                      <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-accent">•</span> Driven by desire for autonomy and independence</li>
                          <li className="flex items-start gap-2"><span className="text-accent">•</span> Fear of failure and wasting limited resources</li>
                          <li className="flex items-start gap-2"><span className="text-accent">•</span> Need for validation that their business can succeed</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Offer Brief Document Section */}
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="offer-brief">
              <Card className="bg-card/80 border-border/50">
                <div className="p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Offer Brief Summary</h2>
                        <p className="text-sm text-muted-foreground">Key elements of your marketing strategy</p>
                      </div>
                    </div>
                    <AccordionTrigger />
                  </div>
                </div>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          Potential Product Name Ideas
                        </h4>
                        <p className="text-sm text-muted-foreground">DeepCopy AI, InstaCopy Pro, CopyGenius</p>
                      </div>
                      
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-accent" />
                          Level of Consciousness
                        </h4>
                        <p className="text-sm text-muted-foreground">High - aware of problem and actively seeking solutions</p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Eye className="w-4 h-4 text-primary" />
                          Level of Awareness
                        </h4>
                        <p className="text-sm text-muted-foreground">Solution Aware - knows solutions exist, comparing options</p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-accent" />
                          Stage of Sophistication
                        </h4>
                        <p className="text-sm text-muted-foreground">Stage 3 - needs unique mechanism or approach</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Big Idea</h4>
                        <p className="text-sm text-muted-foreground">AI-powered landing pages that write themselves in minutes, not hours</p>
                      </div>

                      <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Metaphor</h4>
                        <p className="text-sm text-muted-foreground">"Having a professional copywriter on-demand, 24/7"</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Problem)</h4>
                          <p className="text-sm text-muted-foreground">The "Marketing Time Trap" - business owners stuck in endless cycles</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Solution)</h4>
                          <p className="text-sm text-muted-foreground">AI Avatar Analysis - personalized copy based on customer psychology</p>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Guru / Discovery Story</h4>
                        <p className="text-sm text-muted-foreground">Founded by marketing experts who spent 10+ years studying what converts</p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Potential Headline/Subheadline Ideas</h4>
                        <p className="text-sm text-muted-foreground mb-2"><strong>H1:</strong> "Create Converting Landing Pages in 5 Minutes with AI"</p>
                        <p className="text-sm text-muted-foreground"><strong>H2:</strong> "No copywriting experience needed. Just answer a few questions."</p>
                      </div>

                      <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Key Objections</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-destructive">•</span> "AI-generated copy sounds generic"</li>
                          <li className="flex items-start gap-2"><span className="text-destructive">•</span> "Too expensive for my budget"</li>
                          <li className="flex items-start gap-2"><span className="text-destructive">•</span> "Takes too long to learn and implement"</li>
                        </ul>
                      </div>

                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Belief Chains</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2"><span className="text-primary">✓</span> Better copy = higher conversions</li>
                          <li className="flex items-start gap-2"><span className="text-primary">✓</span> AI can understand customer psychology</li>
                          <li className="flex items-start gap-2"><span className="text-primary">✓</span> Quick implementation = faster ROI</li>
                        </ul>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Funnel Architecture</h4>
                        <p className="text-sm text-muted-foreground">Landing Page → Free Trial → Onboarding → Paid Plan</p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Potential Domains</h4>
                        <p className="text-sm text-muted-foreground">deepcopy.ai, instantcopy.com, copygenius.io</p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Marketing Angle Selection */}
        <div className="mb-12">
          <Card className="p-8 bg-card/80 border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Select Your Marketing Angle</h2>
                <p className="text-sm text-muted-foreground">Choose the approach that best resonates with your target audience</p>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full pt-6 border-t border-border/50">
              <div className="space-y-3">
                {mockMarketingAngles.map((angle, index) => {
                  return (
                    <Card 
                      key={angle.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedAngle === angle.id ? 'border-primary shadow-elegant' : 'border-border/50'
                      }`}
                      onClick={() => setSelectedAngle(angle.id)}
                    >
                      <AccordionItem value={angle.id} className="border-none">
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedAngle === angle.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                              }`}>
                                {selectedAngle === angle.id && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                                  <div className="flex items-center gap-1 text-sm">
                                    <span className="text-xs text-muted-foreground">Likelihood of achieving:</span>
                                    <span className="font-bold text-primary">{angle.conversionPotential}%</span>
                                  </div>
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-1">
                                  {angle.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {angle.summary}
                                </p>
                              </div>
                            </div>
                            <AccordionTrigger className="ml-2" />
                          </div>
                        </div>

                        <AccordionContent>
                          <div className="px-4 space-y-6">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium text-foreground">Target Age</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{angle.targetAge}</p>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium text-foreground">Target Audience</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{angle.targetAudience}</p>
                            </div>

                            <div>
                              <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-destructive" />
                                Pain Points
                              </h5>
                              <div className="space-y-1">
                                {angle.painPoints.map((pain, i) => (
                                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <div className="w-1 h-1 bg-destructive rounded-full flex-shrink-0 mt-1.5"></div>
                                    {pain}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Heart className="w-4 h-4 text-primary" />
                                Desires
                              </h5>
                              <div className="space-y-1">
                                {angle.desires.map((desire, i) => (
                                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0 mt-1.5"></div>
                                    {desire}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-accent" />
                                Common Objections
                              </h5>
                              <div className="space-y-1">
                                {angle.objections.map((objection, i) => (
                                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <div className="w-1 h-1 bg-accent rounded-full flex-shrink-0 mt-1.5"></div>
                                    {objection}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4 text-primary" />
                                Marketing Angles
                              </h5>
                              <div className="space-y-2">
                                {angle.marketingAngles.map((marketingAngle, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs mr-2 mb-2">
                                    {marketingAngle}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Card>
                  );
                })}
              </div>
            </Accordion>
          </Card>
        </div>

        {/* Deep Research Option */}
        <div className="mb-8">
          <Card className="p-6 bg-gradient-accent/5 border-accent/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">Need More Unique Angles?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Perform additional deep research to discover more unique marketing angles tailored specifically for this persona. Our AI will analyze deeper patterns and uncover hidden opportunities.
                </p>
                <Button variant="default" size="lg">
                  <Brain className="w-4 h-4 mr-2" />
                  Deep Research (5 Credits)
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Refine Research Button */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto">
            <MessageSquare className="w-5 h-5 mr-2" />
            Refine Research
          </Button>
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-elegant z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedAngle ? (
                <span className="text-primary font-medium">
                  ✓ Marketing angle selected
                </span>
              ) : (
                <span>Select a marketing angle to continue</span>
              )}
            </div>
            <Button 
              variant="default" 
              size="lg" 
              disabled={!selectedAngle}
              className="text-lg px-8 py-6 h-auto"
              asChild={!!selectedAngle}
            >
              {selectedAngle ? (
                <a href="/prelander-selection">
                  Generate Landing Page
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              ) : (
                <>
                  Generate Landing Page
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Research;