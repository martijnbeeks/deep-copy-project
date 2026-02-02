"use client"

import { Search, Target, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

export const Features = () => {
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  useEffect(() => {
    // Attempt to play videos on mobile after component mounts
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // Autoplay was prevented, but that's okay
            // The video will play when user interacts with the page
            console.log('Video autoplay prevented:', error);
          });
        }
      }
    });
  }, []);
  const features = [
    {
      icon: Search,
      title: "Deep Customer & Competitor Research",
      subtitle: "Uncover what truly drives your audience",
      description: "AI-powered analysis of your target audience across social media, forums, and review sites to uncover the exact pain points and desires that drive purchases.",
      visual: "/box1.mp4"
    },
    {
      icon: Target,
      title: "Data-Driven Winning Angle Discovery",
      subtitle: "Discover the winning angle your competitors missed",
      description: "Choose from multiple data-driven marketing angles based on real customer language and competitor gaps — not guesswork.",
      visual: "/box2.mp4"
    },
    {
      icon: Trophy,
      title: "Million-Dollar Pre-lander Library",
      subtitle: "Start from success, not from scratch",
      description: "Access a library of pre-landers that have already converted millions. DeepCopy matches your angle to the framework most likely to win.",
      visual: "/box3.mp4"
    },
    {
      icon: Zap,
      title: "Rewrite & Deploy in Minutes",
      subtitle: "Publish while your competitors are still drafting",
      description: "Transform million-dollar pre-landers into your own high-converting pages using proven persuasion frameworks. No developers, no delays — just results.",
      visual: "https://res.cloudinary.com/dtawjhk3a/video/upload/v1765550776/Block_4_kkxl0d.mp4"
    }
  ];

  return (
    <section id="how-it-works" className="py-10 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4 text-sm font-medium text-primary">
            ⚡ How it works
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
              <div className={`aspect-video rounded-lg overflow-hidden relative ${feature.visual.endsWith('.mp4') ? '' : 'bg-muted/50 border'}`}>
                {feature.visual.endsWith('.mp4') ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[index] = el;
                    }}
                    src={feature.visual}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => {
                      // Attempt to play when video data is loaded
                      const video = e.currentTarget;
                      const playPromise = video.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(() => {
                          // Autoplay prevented, will play on user interaction
                        });
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                    {feature.visual}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

