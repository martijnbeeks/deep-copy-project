import { Upload, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export const HowItWorks = () => {
  const steps = [
    {
      number: "1",
      icon: Upload,
      title: "Input",
      subtitle: "Share your product or offer — without the guesswork",
      description: "Define your ideal customer in plain English or simply provide your product URL. Our AI extracts everything it needs from your existing content, competitor landscape, and market data to build a complete conversion strategy. It's that simple."
    },
    {
      number: "2",
      icon: Search,
      title: "Research",
      subtitle: "Uncover hidden conversion gold — instantly",
      description: "Fill every knowledge gap with one click — our AI scans thousands of competitor pages, customer reviews, forum discussions, and social mentions to identify proven pain points, desires, and messaging angles that actually convert."
    },
    {
      number: "3",
      icon: Sparkles,
      title: "Generate",
      subtitle: "Create unlimited high-converting variations",
      description: "Prioritize the angles that matter most — watch as AI generates complete landing pages with compelling headlines, benefit-driven copy, social proof, and conversion-optimized designs. Test different approaches for different audiences, all created in seconds."
    }
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full mb-4 text-sm font-medium text-accent">
            💼 How It Works
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            From Zero to High-Converting Page in Minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your landing page creation from a weeks-long struggle into a streamlined, AI-powered process.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-20 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary to-accent"></div>
              )}
              <Card className="p-8 relative z-10 hover:shadow-feature transition-all duration-300 border-2">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-6 shadow-primary mx-auto">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute top-4 right-4 text-6xl font-bold text-muted/20">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-center">{step.title}</h3>
                <p className="text-sm text-primary font-medium mb-4 text-center">
                  {step.subtitle}
                </p>
                <p className="text-muted-foreground leading-relaxed text-center">
                  {step.description}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
