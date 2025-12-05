import { TrendingUp, Target, RefreshCw, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";

export const ValueProps = () => {
  const props = [
    {
      icon: TrendingUp,
      title: "Rising Acquisition Costs Make Conversion Critical",
      description: "CAC is up 60% since 2019. DeepCopy allows you to find unique angles and avatars that drives your conversion up and makes you scale again!"
    },
    {
      icon: Target,
      title: "Reach Untapped Audiences with Research-Driven Pre-landers in Minutes",
      description: "The biggest companies spend $20,000+ on pre-lander creation, hiring teams of researchers and copywriters because pre-landers convert cold audience 5x better than cold traffic to landing pages. Now you get the same research-backed prelanders in 15 minutes instead of 5 weeks. What cost enterprises millions is now accessible to everyone."
    },
    {
      icon: RefreshCw,
      title: "Stop Endless Inconsistent Prompting Without the Results You Want",
      description: "Businesses waste 15+ hours weekly wrestling with ChatGPT - managing SOPs, tweaking prompts, getting different outputs every time. DeepCopy eliminates prompt engineering entirely with one platform that knows your brand and delivers consistent, high-converting copy. No more prompt libraries, no more inconsistency, no more wasted hours."
    },
    {
      icon: Brain,
      title: "Customer Intelligence Is Your Competitive Edge",
      description: "You can't convert customers you don't understand - most pages fail because they guess instead of know. DeepCopy's AI analyzes thousands of reviews, forums, and competitor pages to uncover the exact words and desires that drive purchases. Stop writing blind - know what makes customers buy before you write."
    }
  ];

  return (
    <section id="value-props" className="py-10 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full mb-4 text-sm font-medium text-accent">
            💰 Why Choose DeepCopy
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Supercharge Your Landing Page Conversions
          </h2>
          <p className="text-lg text-accent font-semibold max-w-3xl mx-auto">
            The cost of doing nothing has never been higher – and the technology to solve it has never been more powerful.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {props.map((prop, index) => (
            <Card
              key={index}
              className="p-8 hover:shadow-feature transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 shadow-primary">
                <prop.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4">{prop.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{prop.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

