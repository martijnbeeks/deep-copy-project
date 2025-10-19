  import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Newspaper, 
  Megaphone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Filter,
  User,
  Target
} from "lucide-react";

interface PrelanderOption {
  id: string;
  type: "listicle" | "editorial" | "advertorial";
  title: string;
  description: string;
  preview: string;
  brand: string;
  niche: string;
  icon: any;
}

const prelanderOptions: PrelanderOption[] = [
  {
    id: "1",
    type: "listicle",
    title: "7 Revolutionary Ways AI Transforms Business Marketing",
    description: "A numbered list format that breaks down complex topics into digestible, shareable points. Perfect for capturing attention and driving engagement.",
    preview: "1. Automated Customer Insights\n2. Personalized Content at Scale\n3. Predictive Analytics for ROI\n4. Real-time Campaign Optimization\n5. AI-Powered Copywriting\n6. Smart Audience Targeting\n7. Conversion Rate Breakthrough",
    brand: "Forbes",
    niche: "business",
    icon: FileText
  },
  {
    id: "2",
    type: "editorial",
    title: "The Hidden Crisis in Small Business Marketing (And How AI Solves It)",
    description: "An authoritative, news-style article that establishes credibility and positions your solution as the logical answer to a widespread problem.",
    preview: "In today's digital landscape, small business owners face an unprecedented challenge...\n\nRecent studies show that 73% of entrepreneurs struggle with creating effective marketing materials, leading to missed opportunities and stagnant growth.\n\nBut a new wave of AI technology is changing everything...",
    brand: "Business Insider",
    niche: "business",
    icon: Newspaper
  },
  {
    id: "3",
    type: "advertorial",
    title: "How This AI Tool Helped 1,000+ Businesses Double Their Conversion Rates",
    description: "A compelling story-driven format that reads like editorial content while highlighting your product's transformative benefits and social proof.",
    preview: "When Sarah Chen launched her online boutique, she never imagined that creating landing pages would become her biggest bottleneck...\n\nLike thousands of entrepreneurs, she was spending 15+ hours per week on marketing materials, time she could have spent growing her business.\n\nThen she discovered DeepCopy AI...",
    brand: "Entrepreneur Magazine",
    niche: "business",
    icon: Megaphone
  },
  {
    id: "4",
    type: "listicle",
    title: "10 Ancient Herbs That Combat Modern Inflammation",
    description: "A numbered list format that breaks down complex topics into digestible, shareable points. Perfect for capturing attention and driving engagement.",
    preview: "1. Turmeric: The Golden Warrior\n2. Ginger: Nature's Pain Reliever\n3. Boswellia: The Joint Protector\n4. Green Tea: Antioxidant Powerhouse\n5. Omega-3s: Brain & Body Healer\n...",
    brand: "Health Magazine",
    niche: "health",
    icon: FileText
  },
  {
    id: "5",
    type: "editorial",
    title: "Why Dermatologists Are Concerned About This Beauty Trend",
    description: "An authoritative, news-style article that establishes credibility and positions your solution as the logical answer to a widespread problem.",
    preview: "The beauty industry is experiencing a revolution, but not all experts are celebrating...\n\nDermatologists worldwide are raising concerns about a popular skincare trend that could be doing more harm than good.\n\nHere's what you need to know...",
    brand: "Allure",
    niche: "beauty",
    icon: Newspaper
  },
  {
    id: "6",
    type: "advertorial",
    title: "The Mediterranean Secret That Helped Me Lose 40 Pounds",
    description: "A compelling story-driven format that reads like editorial content while highlighting your product's transformative benefits and social proof.",
    preview: "At 42, I thought I had tried every diet under the sun. Nothing worked for more than a few weeks...\n\nThen my doctor told me about a simple Mediterranean approach that changed everything.\n\nWithin 6 months, I lost 40 pounds and my energy levels skyrocketed...",
    brand: "Prevention",
    niche: "food",
    icon: Megaphone
  },
  {
    id: "7",
    type: "listicle",
    title: "5 Sustainable Fashion Brands Celebrities Can't Stop Wearing",
    description: "A numbered list format that breaks down complex topics into digestible, shareable points. Perfect for capturing attention and driving engagement.",
    preview: "1. Reformation: Red Carpet Ready\n2. Patagonia: Outdoor Elegance\n3. Everlane: Minimalist Chic\n4. Stella McCartney: Luxury Conscious\n5. Allbirds: Comfort Meets Style",
    brand: "Vogue",
    niche: "clothing",
    icon: FileText
  },
  {
    id: "8",
    type: "editorial",
    title: "The Supplement Industry Doesn't Want You to Know This",
    description: "An authoritative, news-style article that establishes credibility and positions your solution as the logical answer to a widespread problem.",
    preview: "A groundbreaking study reveals that 76% of supplements on the market fail to meet their label claims...\n\nConsumer protection groups are calling for stricter regulations, but there's a way to protect yourself now.\n\nHere's what independent testing revealed...",
    brand: "Consumer Reports",
    niche: "supplements",
    icon: Newspaper
  },
  {
    id: "9",
    type: "advertorial",
    title: "How This Natural Collagen Reversed My Skin Aging in 90 Days",
    description: "A compelling story-driven format that reads like editorial content while highlighting your product's transformative benefits and social proof.",
    preview: "When I looked in the mirror on my 50th birthday, I barely recognized myself...\n\nFine lines had become deep wrinkles, and my skin had lost its youthful glow.\n\nThat's when I discovered a marine collagen that changed everything...",
    brand: "Harper's Bazaar",
    niche: "supplements",
    icon: Megaphone
  }
];

const PrelanderSelection = () => {
  const [selectedPrelander, setSelectedPrelander] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [nicheFilter, setNicheFilter] = useState<string>("all");

  const filteredPrelanders = prelanderOptions.filter((option) => {
    const typeMatch = typeFilter === "all" || option.type === typeFilter;
    const nicheMatch = nicheFilter === "all" || option.niche === nicheFilter;
    return typeMatch && nicheMatch;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "listicle": return "bg-gradient-primary text-primary-foreground";
      case "editorial": return "bg-gradient-accent text-accent-foreground";
      case "advertorial": return "bg-primary/20 text-primary";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "listicle": return "Listicle";
      case "editorial": return "Editorial";
      case "advertorial": return "Advertorial";
      default: return type;
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
            <Button variant="ghost" asChild>
              <a href="/research">← Back to Research</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Step 3: Choose Your Prelander Format</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Select Prelander Style
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto">
            Choose a proven format from top brands. Each template will be rewritten with your unique angle and customer avatar insights.
          </p>
        </div>

        {/* Selected Avatar & Angle Display */}
        <div className="mb-8">
          <Card className="p-6 bg-card/80 border-border/50">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-semibold text-foreground">Selected Avatar</h3>
                </div>
                <div className="bg-accent/10 p-4 rounded-lg border border-accent/20">
                  <h4 className="font-bold text-foreground mb-1">The Exhausted Worker</h4>
                  <p className="text-sm text-muted-foreground">Overwhelmed professionals seeking quick relief from chronic pain</p>
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Selected Angle</h3>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <h4 className="font-bold text-foreground mb-1">Time-Saving Business Automation</h4>
                  <p className="text-sm text-muted-foreground">Target overwhelmed entrepreneurs who need quick, automated marketing solutions</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* AI Recommended Examples */}
        <div className="mb-8">
          <Card className="p-6 bg-gradient-primary/5 border-primary/30">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-bold text-foreground">AI Recommended for Your Avatar & Angle</h3>
                <p className="text-sm text-muted-foreground">These formats are predicted to convert best based on your research</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recommended Example 1 - Listicle */}
              <Card className="overflow-hidden border-2 border-primary/50 shadow-lg hover:shadow-xl transition-all">
                <div className="bg-primary/10 px-4 py-2 flex items-center justify-between">
                  <Badge className="bg-gradient-primary text-primary-foreground">
                    95% Match Score
                  </Badge>
                  <span className="text-xs text-muted-foreground">Based on Forbes</span>
                </div>
                
                {/* Website Preview */}
                <div className="bg-background p-6">
                  <div className="mb-4 pb-4 border-b border-border/50">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Business Intelligence</div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                      7 Time-Saving Automation Tools Overwhelmed Entrepreneurs Swear By
                    </h2>
                    <div className="text-xs text-muted-foreground">Published by Forbes Business Council • 5 min read</div>
                  </div>

                  <div className="space-y-4 text-sm">
                    <p className="text-foreground/90 leading-relaxed">
                      Running a business means wearing multiple hats, but what if you could automate your marketing and focus on what truly matters?
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold">1</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">AI-Powered Landing Page Builder</h4>
                          <p className="text-muted-foreground text-xs">Create professional pages in minutes without design skills</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold">2</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Smart Customer Avatar Analysis</h4>
                          <p className="text-muted-foreground text-xs">Understand your customers psychology instantly</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold">3</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Conversion-Optimized Copy Generation</h4>
                          <p className="text-muted-foreground text-xs">Get persuasive copy that actually converts</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground italic">
                        "These tools have saved me 15+ hours per week. I can finally focus on growing my business instead of fighting with marketing tools." - Sarah Chen, Boutique Owner
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 border-t border-border/50">
                  <Button 
                    className="w-full"
                    onClick={() => setSelectedPrelander("1")}
                  >
                    Use This Format
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </Card>

              {/* Recommended Example 2 - Advertorial */}
              <Card className="overflow-hidden border-2 border-primary/50 shadow-lg hover:shadow-xl transition-all">
                <div className="bg-primary/10 px-4 py-2 flex items-center justify-between">
                  <Badge className="bg-gradient-primary text-primary-foreground">
                    92% Match Score
                  </Badge>
                  <span className="text-xs text-muted-foreground">Based on Entrepreneur Magazine</span>
                </div>
                
                {/* Website Preview */}
                <div className="bg-background p-6">
                  <div className="mb-4 pb-4 border-b border-border/50">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Success Stories</div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                      How This Busy Entrepreneur Doubled Sales While Working Less
                    </h2>
                    <div className="text-xs text-muted-foreground">Sponsored Content • Real Results</div>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/30 italic">
                      <p className="text-foreground/90 leading-relaxed">
                        "I was drowning in tasks. Between managing inventory, handling customer service, and trying to market my business, I had no time left for strategy or growth."
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">- Marcus Thompson, E-commerce Owner</p>
                    </div>

                    <p className="text-foreground/90 leading-relaxed">
                      Marcus Thompson's story isn't unique. Like thousands of small business owners, he was trapped in the daily grind—working 12-hour days but seeing minimal growth.
                    </p>

                    <p className="text-foreground/90 leading-relaxed">
                      The breakthrough came when he discovered an AI system that could handle his marketing automatically. Within 90 days, his conversion rate jumped from 2% to 5.2%, and he was working 30% fewer hours.
                    </p>

                    <div className="bg-accent/10 p-4 rounded-lg border border-accent/30">
                      <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        The Results:
                      </h4>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <span className="text-accent">•</span>
                          <span className="text-muted-foreground">2.6x increase in conversion rate in 90 days</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-accent">•</span>
                          <span className="text-muted-foreground">15+ hours saved weekly on marketing tasks</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-accent">•</span>
                          <span className="text-muted-foreground">Professional landing pages without hiring designers</span>
                        </li>
                      </ul>
                    </div>

                    <p className="text-foreground/90 leading-relaxed">
                      "The best part? I don't need any marketing experience. The AI understands my customers better than I ever could and creates copy that actually resonates with them."
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 border-t border-border/50">
                  <Button 
                    className="w-full"
                    onClick={() => setSelectedPrelander("3")}
                  >
                    Use This Format
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </Card>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <Card className="p-6 bg-card/80 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Browse All Prelanders</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="listicle">Listicle</SelectItem>
                    <SelectItem value="editorial">Editorial</SelectItem>
                    <SelectItem value="advertorial">Advertorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Niche</label>
                <Select value={nicheFilter} onValueChange={setNicheFilter}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="All niches" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50">
                    <SelectItem value="all">All Niches</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="beauty">Beauty</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="clothing">Clothing</SelectItem>
                    <SelectItem value="supplements">Supplements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        {/* Prelander Options */}
        <div className="space-y-6 mb-24">
          {filteredPrelanders.length === 0 ? (
            <Card className="p-12 text-center bg-card/80 border-border/50">
              <p className="text-muted-foreground">No prelanders match your selected filters. Try adjusting your filters.</p>
            </Card>
          ) : (
            filteredPrelanders.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedPrelander === option.id;
            
            return (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'border-primary shadow-elegant ring-2 ring-primary/20' : 'border-border/50'
                }`}
                onClick={() => setSelectedPrelander(option.id)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground bg-background'
                    }`}>
                      {isSelected ? (
                        <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                      ) : (
                        <Icon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={`${getTypeColor(option.type)} text-xs font-semibold uppercase`}>
                          {getTypeLabel(option.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Based on {option.brand}</span>
                      </div>

                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {option.title}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground mb-4">
                        {option.description}
                      </p>

                      <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Preview Structure</h4>
                        <p className="text-sm text-foreground whitespace-pre-line font-mono">
                          {option.preview}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          }))}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-elegant z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedPrelander ? (
                <span className="text-primary font-medium">
                  ✓ {(() => {
                    const prelander = prelanderOptions.find(p => p.id === selectedPrelander);
                    return prelander?.type ? prelander.type.charAt(0).toUpperCase() + prelander.type.slice(1) : 'Prelander';
                  })()} selected
                </span>
              ) : (
                <span>Select a prelander format to continue</span>
              )}
            </div>
            <Button 
              variant="default" 
              size="lg" 
              disabled={!selectedPrelander}
              className="text-lg px-8 py-6 h-auto"
            >
              Generate Landing Page
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrelanderSelection;
