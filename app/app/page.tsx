"use client"

import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { SocialProof } from "@/components/landing/social-proof";
import { ValueProps } from "@/components/landing/value-props";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <SocialProof />
      <ValueProps />
      <FinalCTA />
      {/*<HowItWorks />*/}
      {/*<Testimonials />*/}
      <FAQ />
      <Footer />
    </div>
  );
}
