import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const FinalCTA = () => {
  return (
    <section className="py-20 md:py-32 bg-gradient-hero">
      <div className="container mx-auto px-4 md:px-6">
        <Card className="max-w-5xl mx-auto p-12 md:p-16 text-center border-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 text-sm font-medium text-primary">
            🚀 Ready to Transform Your Results?
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Transform Your Landing Page Conversions with{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              AI-Powered Intelligence
            </span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join forward-thinking marketers who've discovered the unfair advantage of AI-driven landing pages. Limited spots available for our early adopter program — secure yours now.
          </p>

          <Button size="lg" className="text-lg px-12 hover:scale-105 transition-transform" asChild>
            <Link href="/login">Start Your Free Trial →</Link>
          </Button>

          <p className="text-sm text-muted-foreground mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Sample Page 1</p>
              <div className="aspect-video bg-muted rounded"></div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Sample Page 2</p>
              <div className="aspect-video bg-muted rounded"></div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Sample Page 3</p>
              <div className="aspect-video bg-muted rounded"></div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Sample Page 4</p>
              <div className="aspect-video bg-muted rounded"></div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

