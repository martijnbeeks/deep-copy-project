import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { SocialProof } from "@/components/SocialProof";
import { ValueProps } from "@/components/ValueProps";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Testimonials } from "@/components/Testimonials";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <SocialProof />
      <ValueProps />
      <Features />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
