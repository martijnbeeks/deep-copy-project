import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";

export const Testimonials = () => {
  const testimonials = [
    {
      quote: "Thanks to DeepCopy's AI-powered research, we achieved a 18% revenue increase in our German campaigns and even 42% in Netherlands. The AI uncovered customer pain points we'd never considered. For our US campaigns, we went from 200 leads to 600 highly qualified leads in just one month. DeepCopy saved us an enormous amount of time and delivered insights that transformed our entire approach.",
      author: "Sarah Chen",
      role: "Growth Marketing Manager",
      company: "TechCorp SaaS"
    },
    {
      quote: "With DeepCopy's AI-generated pages, we transformed our client campaigns across Europe. By analyzing over 100,000 customer touchpoints in our industry, we built pages that achieved a 48% email open rate — more than 2.5 times higher than the B2B benchmark (20.8%) — and a click-through rate of 11%, over 3.4 times higher than the industry average (3.2%). The 4% direct response rate proved that AI-driven copy makes a real commercial impact.",
      author: "Marcus Rodriguez",
      role: "Agency Owner",
      company: "Digital Growth Agency"
    },
    {
      quote: "The competitor analysis alone was worth 10x the price. DeepCopy showed us exactly why our pages weren't converting — we were addressing the wrong pain points entirely. After implementing DeepCopy's research-based approach, our landing page conversion went from 1.5% to 6.7% in just two weeks. That's a 347% increase that transformed our unit economics overnight.",
      author: "Jennifer Park",
      role: "E-commerce Founder",
      company: "Boutique Fashion Brand"
    }
  ];

  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4 text-sm font-medium text-primary">
            💬 Testimonials
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Trusted by Conversion-Focused Teams Worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Don't just take our word for it. Here's what real marketers are saying about DeepCopy.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="p-8 hover:shadow-feature transition-all duration-300 hover:-translate-y-1 relative"
            >
              <Quote className="w-10 h-10 text-primary/20 mb-4" />
              <p className="text-muted-foreground leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div className="border-t pt-6">
                <p className="font-bold text-foreground">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                <p className="text-sm text-primary font-medium">{testimonial.company}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
