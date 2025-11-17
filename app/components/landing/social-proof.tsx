export const SocialProof = () => {
  const companies = [
    "Solo Entrepreneurs",
    "E-commerce Brands",
    "Marketing Agencies",
    "CRO Agencies"
  ];

  return (
    <section className="py-16 border-b bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8">
          Companies That Utilise DeepCopy
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {companies.map((company, index) => (
            <div
              key={index}
              className="text-lg font-semibold text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {company}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

