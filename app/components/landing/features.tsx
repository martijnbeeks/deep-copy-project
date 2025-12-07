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
      description: "AI-powered scraping and analysis of your target audience across social media, forums, and review sites to uncover pain points and motivations.",
      visual: "/box1.mp4"
    },
    {
      icon: Target,
      title: "AI Copywriting with Specific Angle Selection",
      subtitle: "Find untapped angles that can scale your business to the next step",
      description: "Choose from multiple data-driven marketing angles based on comprehensive research insights and competitor analysis.",
      visual: "Dashboard showing angle performance metrics"
    },
    {
      icon: Trophy,
      title: "Competitor Intelligence",
      subtitle: "Do not reinvent the wheel, learn from the best in your industry.",
      description: "Analyze winning landing pages from top brands in your industry, extracting the highest-converting pre-lander and messaging strategies for your particular project.",
      visual: "/box3.mp4"
    },
    {
      icon: Zap,
      title: "Copywriting Engine + Deployment",
      subtitle: "From a simple product page to multiple high-converting avatar and angle specific pre-landers",
      description: "Generate persuasive copy using proven psychological triggers and conversion frameworks, then launch your optimized pre-lander in minutes.",
      visual: "Live deployment dashboard with analytics"
    }
  ];

  return (
    <section id="features" className="py-10 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4 text-sm font-medium text-primary">
            ⚡ how it works
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
              <div className={`aspect-video rounded-lg overflow-hidden relative ${feature.visual.endsWith('.mp4') && feature.visual === '/box1.mp4' ? '' : 'bg-muted/50 border'}`}>
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
                    className={`w-full h-full ${feature.visual === '/box1.mp4' ? 'object-contain' : 'object-contain'}`}
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

