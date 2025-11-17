import { Zap, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export const ValueProps = () => {
  const props = [
    {
      icon: TrendingUp,
      title: "Rising Acquisition Costs",
      description: "Digital ad spend is soaring to $650B+ by 2025, driving up competition and CAC. Every lead now costs more. Your CAC is likely up year-over-year – our analysis shows no industry is spared. You can't afford to waste traffic on underperforming landing pages."
    },
    {
      icon: Target,
      title: "Post-COVID Digital Surge & AI Revolution",
      description: "Customer behavior shifted – almost all research and buying starts online now, meaning your landing pages form the first impression. We're in an AI revolution with GPT-4 and advanced tech making new solutions possible that weren't feasible years ago. Competitors are starting to leverage it – those who don't will be left behind."
    },
    {
      icon: Zap,
      title: "Need for Speed in Modern Markets",
      description: "Markets move faster; campaigns that took weeks to launch now need to go live in days to seize opportunities like trend-driven campaigns. Companies launching campaigns faster are outpacing competitors. The bar for optimization is being raised – 73% of companies now conduct A/B tests, up from 40% just years ago."
    }
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
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

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
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

