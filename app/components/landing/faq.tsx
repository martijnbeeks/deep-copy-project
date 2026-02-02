import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const FAQ = () => {
  const faqs = [
    /*{
      question: "When will my first improved Pre-Lander be live?",
      answer: "Most users have their first AI-optimized page live within 5-10 minutes of signing up. Our onboarding wizard guides you through selecting a high-impact page to optimize first."
    },
     {
       question: "How does DeepCopy ensure brand consistency?",
       answer: "You can input brand guidelines, tone preferences, and compliance requirements. The AI adheres to these while optimizing for conversion. Plus, you maintain full editorial control."
     },
     {
       question: "Which platforms can I integrate with DeepCopy?",
       answer: "DeepCopy integrates with all major platforms including WordPress, Shopify, HubSpot, Salesforce, ActiveCampaign, Mailchimp, Google Analytics, Facebook Pixel, and 100+ others via Zapier."
     },*/
    /*{
      question: "What if the AI copy needs adjustments?",
      answer: "You have full editing control over all AI-generated content. Most users find they only need minor tweaks. You can also regenerate sections or entire pages with different angles instantly."
    }*/
    /*{
      question: "How much does DeepCopy cost?",
      answer: "Plans start at $97/month for solopreneurs (10 pages/month), $297/month for growth teams (unlimited pages), and custom enterprise pricing. All plans include AI research, copywriting, and hosting."
    },*/
    {
      question: "Is there a free trial?",
      answer: "Yes! Start with our 14-day free trial. No credit card required. Most users see conversion improvements within the first week."
    },
    {
      question: "What kind of research does DeepCopy perform?",
      answer: "Our AI analyzes competitor Pre-Landers, customer reviews, forum discussions, social media mentions, and search data to identify proven conversion triggers specific to your market."
    },
    {
      question: "How do I get started?",
      answer: "Click “Join the Waitlist for a Free Trial, input your product URL, watch DeepCopy generated research and spit out high-converting copywriting”"
    },
  ];

  return (
    <section id="faqs" className="py-10 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full mb-4 text-sm font-medium text-accent">
            ❓ Frequently Asked Questions
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need to know about DeepCopy
          </h2>
        </div>

        {/*<div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search questions..."
              className="pl-10 h-12"
            />
          </div>
        </div>*/}

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border rounded-lg px-6 bg-card hover:shadow-feature transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

