import { Search, Globe, Copy, Palette, BarChart3, Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Features = () => {
  const features = [
    {
      icon: Search,
      title: "Deep Customer Research",
      subtitle: "Uncover what truly drives your audience",
      description: "AI-powered scraping and analysis of your target audience across social media, forums, and review sites to uncover pain points and motivations.",
      visual: "AI analyzing social media posts and reviews"
    },
    {
      icon: Globe,
      title: "Competitor Intelligence",
      subtitle: "Learn from the best in your industry",
      description: "Analyze winning landing pages from top brands in your industry, extracting the highest-converting elements and messaging strategies.",
      visual: "Side-by-side competitor page analysis"
    },
    {
      icon: Copy,
      title: "AI Copywriting Engine",
      subtitle: "Convert with psychological precision",
      description: "Generate persuasive copy that speaks directly to your audience using proven psychological triggers and conversion frameworks.",
      visual: "AI generating headline variations"
    },
    {
      icon: Palette,
      title: "Design Recreation",
      subtitle: "Pixel-perfect landing pages instantly",
      description: "Recreate and customize high-converting landing page designs with pixel-perfect precision, optimized for your brand.",
      visual: "Landing page design customization interface"
    },
    {
      icon: BarChart3,
      title: "Marketing Angle Selection",
      subtitle: "Choose your winning strategy",
      description: "Choose from multiple data-driven marketing angles based on comprehensive research insights and competitor analysis.",
      visual: "Dashboard showing angle performance metrics"
    },
    {
      icon: Rocket,
      title: "Instant Deployment",
      subtitle: "Launch and optimize in minutes",
      description: "Launch your optimized pre-lander in minutes with built-in A/B testing, analytics tracking, and conversion optimization.",
      visual: "Live deployment dashboard with analytics"
    }
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4 text-sm font-medium text-primary">
            ⚡ Features
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            All-in-One AI Conversion Platform
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From uncovering hidden customer desires to seamlessly launching optimized pages — these features help you convert more visitors into customers at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-8 hover:shadow-feature transition-all duration-300 group"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-primary group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-primary font-medium">{feature.subtitle}</p>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {feature.description}
              </p>
              <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center text-sm text-muted-foreground border">
                {feature.visual}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

