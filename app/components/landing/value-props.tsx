import { TrendingUp, Target, RefreshCw, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";

export const ValueProps = () => {
  const props = [
    {
      icon: Brain,
      title: "Know What Converts Before You Write a Single Word",
      description: "Most landing pages fail because they guess instead of know. DeepCopy's AI analyzes thousands of reviews, forums, and competitor pages to uncover the exact words that drive purchases."
    },
    {
      icon: Target,
      title: "Built on Pre-landers That Already Convert Millions",
      description: "Why start from scratch when winning formulas already exist? DeepCopy analyzes top-performing pre-landers from leading brands and applies their proven frameworks to your offer — enterprise-quality pages in 15 minutes."
    },
    {
      icon: TrendingUp,
      title: "Rising Acquisition Costs Make Conversion Critical",
      description: "CAC is up 60% since 2019 and no industry has been spared. DeepCopy finds the messaging angles that turn your expensive clicks into paying customers."
    },
    {
      icon: RefreshCw,
      title: "Consistent High-Converting Pages Without Hours of Prompting",
      description: "Businesses waste 15+ hours weekly wrestling with ChatGPT — managing prompts, tweaking outputs, getting inconsistent results. DeepCopy eliminates prompt engineering with one platform that researches, writes, and designs on-brand copy automatically."
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

