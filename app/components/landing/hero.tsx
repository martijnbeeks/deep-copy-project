import { Button } from "@/components/ui/button";
// import { Play } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative bg-gradient-hero py-10 md:py-16 overflow-hidden">
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
            <span className="word-animate text-primary">Pre-Landers</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Our AI analyzes top-performing Pre-Landers from industry leaders, conducts deep customer research, and creates conversion-optimized Pre-Landers tailored to your unique marketing angle.
          </p>

          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <Button size="lg" className="text-lg px-8 shadow-primary hover:scale-105 transition-transform" asChild>
                <a href="/login?waitlist=true">Join Waitlist →</a>
              </Button>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary animate-pulse"></span>
                <span>
                  Only <span className="text-primary font-medium">5</span> More Spots Available
                </span>
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

