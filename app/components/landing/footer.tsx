export const Footer = () => {
  const footerSections = [
    {
      title: "Product",
      links: ["Features", "How it Works", "Integrations", "Pricing", "FAQ"]
    },
    {
      title: "Company",
      links: ["About", "Careers", "Blog", "Case Studies", "Contact"]
    },
    {
      title: "Resources",
      links: ["Documentation", "API", "Conversion Calculator", "Landing Page Templates", "Support"]
    },
    {
      title: "Connect",
      links: ["LinkedIn", "Twitter", "YouTube", "Newsletter"]
    }
  ];

  return (
    <footer id="contact" className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 md:px-6 py-16">
        <div className="grid md:grid-cols-5 gap-12 mb-12">
          <div className="md:col-span-1">
            <h3 className="text-2xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              DeepCopy
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Turning landing page creation from art into science with AI.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Build better pages. Close more deals. Let AI do the research.
            </p>
          </div>

          {footerSections.map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 DeepCopy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

