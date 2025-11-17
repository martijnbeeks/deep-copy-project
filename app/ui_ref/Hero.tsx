import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative bg-gradient-hero py-20 md:py-32 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Convert Customers with AI-Powered Deep Research
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="word-animate">Turn</span>{" "}
            <span className="word-animate text-primary">Deep Research</span>{" "}
            <span className="word-animate">Into</span>
            <br />
            <span className="word-animate">High-Converting</span>
            <br />
            <span className="word-animate text-primary">Landing Pages</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Our AI analyzes top-performing landing pages from industry leaders, conducts deep customer research, and creates conversion-optimized pre-landers tailored to your unique marketing angle.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="text-lg px-8 shadow-primary hover:scale-105 transition-transform">
              Join Waitlist →
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 group">
              <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Watch Demo
            </Button>
          </div>
          
          <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-feature bg-card border animate-slide-up">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Watch DeepCopy in Action</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Shows AI analyzing competitor sites, extracting customer pain points from reviews,<br />
                  and generating a complete landing page in real-time - 2:48 duration
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>
      </div>
    </section>
  );
};
