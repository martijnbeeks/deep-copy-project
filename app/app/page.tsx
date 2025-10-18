"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Zap, Target, TrendingUp, Search, Brain, Copy, Palette, BarChart3, Rocket, Github, Twitter, Linkedin, Mail } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Hero />
      <Features />
      <HowItWorks />
      <Footer />
    </main>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-subtle"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,hsl(var(--primary))_0%,transparent_50%)] opacity-10"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(var(--accent))_0%,transparent_50%)] opacity-10"></div>

      <div className="absolute inset-0 z-0">
        <img
          src="/placeholder.jpg"
          alt="AI-powered marketing automation"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-primary/20 border border-primary/30">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">AI-Powered Landing Page Creation</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          <span className="text-foreground">Turn Research Into</span>
          <br />
          <span className="text-primary">High-Converting</span>
          <br />
          <span className="text-foreground">Landing Pages</span>
        </h1>

        <p className="text-lg sm:text-xl lg:text-2xl text-foreground/80 mb-12 max-w-4xl mx-auto leading-relaxed font-medium">
          Our AI analyzes top-performing landing pages from industry leaders,
          conducts deep customer research, and creates conversion-optimized
          pre-landers tailored to your unique marketing angle.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-accent text-2xl font-bold">
              <TrendingUp className="w-6 h-6" />
              +347%
            </div>
            <p className="text-sm text-muted-foreground">Avg. Conversion Lift</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-primary text-2xl font-bold">
              <Target className="w-6 h-6" />
              10k+
            </div>
            <p className="text-sm text-muted-foreground">Pages Analyzed</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-accent text-2xl font-bold">
              <Zap className="w-6 h-6" />
              5 Min
            </div>
            <p className="text-sm text-muted-foreground">Setup Time</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Button
            size="lg"
            className="text-lg px-8 py-6 h-auto bg-primary text-primary-foreground hover:bg-primary/90"
            asChild
          >
            <a href="/login">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6 h-auto"
            asChild
          >
            <a href="/create">Create a Page</a>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Trusted by 2,500+ marketers from companies like Google, Microsoft, and Shopify
        </p>
      </div>

      <div className="absolute top-20 left-10 w-20 h-20 bg-primary/15 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-accent/15 rounded-full blur-xl"></div>
    </section>
  )
}

const FEATURES = [
  { icon: Search, title: "Deep Customer Research", description: "AI-powered scraping and analysis of your target audience across social media, forums, and review sites to uncover pain points and motivations." },
  { icon: Brain, title: "Competitor Intelligence", description: "Analyze winning landing pages from top brands in your industry, extracting the highest-converting elements and messaging strategies." },
  { icon: Copy, title: "AI Copywriting Engine", description: "Generate persuasive copy that speaks directly to your audience using proven psychological triggers and conversion frameworks." },
  { icon: Palette, title: "Design Recreation", description: "Recreate and customize high-converting landing page designs with pixel-perfect precision, optimized for your brand." },
  { icon: BarChart3, title: "Marketing Angle Selection", description: "Choose from multiple data-driven marketing angles based on comprehensive research insights and competitor analysis." },
  { icon: Rocket, title: "Instant Deployment", description: "Launch your optimized pre-lander in minutes with built-in A/B testing, analytics tracking, and conversion optimization." },
]

function Features() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-subtle">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-primary bg-clip-text text-transparent inline-block">Everything You Need to Convert</span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            From research to launch, our platform handles every aspect of creating
            high-converting landing pages that actually drive results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <Card key={i} className="group p-8 bg-card/50 border-border/50 transition-all duration-300 hover:shadow-elegant hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { number: "01", icon: ArrowRight, title: "Upload Your Product Info", description: "Tell us about your product, target audience, and business goals. Our AI starts building your customer profile immediately.", color: "primary" },
  { number: "02", icon: Search, title: "Deep Market Research", description: "We scrape and analyze thousands of data points about your customers, competitors, and industry trends.", color: "accent" },
  { number: "03", icon: Brain, title: "AI Strategy Creation", description: "Our AI identifies the best marketing angles, messaging strategies, and design elements for your specific market.", color: "primary" },
  { number: "04", icon: Palette, title: "Landing Page Generation", description: "Get multiple high-converting landing page variations, each optimized for different marketing angles and audiences.", color: "accent" },
]

function HowItWorks() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-foreground">
            From Research to Launch in
            {" "}
            <span className="inline-block bg-gradient-accent bg-clip-text text-transparent">4 Simple Steps</span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Our AI-powered platform does the heavy lifting while you focus on what matters most - growing your business.
          </p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-accent to-primary opacity-30 -translate-x-1/2"></div>
          <div className="space-y-16">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isEven = index % 2 === 0
              return (
                <div key={index} className={`relative flex items-center ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-primary rounded-full z-10 relative">
                    <span className="absolute inset-0 flex items-center justify-center text-primary-foreground font-bold text-lg leading-none">{step.number}</span>
                  </div>

                  <Card className={`w-full lg:w-5/12 p-8 ${isEven ? 'lg:mr-auto lg:pr-16' : 'lg:ml-auto lg:pl-16'} bg-card/80 border-border/50 transition-all duration-300`}>
                    <div className="flex items-center gap-4 mb-6 lg:hidden">
                      <div className={`w-12 h-12 bg-gradient-primary rounded-lg relative`}>
                        <span className="absolute inset-0 flex items-center justify-center text-primary-foreground font-bold leading-none">{step.number}</span>
                      </div>
                      <div className={`w-12 h-12 bg-gradient-${step.color} rounded-lg flex items-center justify-center ml-auto`}>
                        <Icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 bg-gradient-${step.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-foreground mb-4">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-lg">{step.description}</p>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-center mt-16">
          <Button size="lg" className="text-lg px-8 py-6 h-auto" asChild>
            <a href="/login">
              Get Started Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: '#' },
    { name: 'LinkedIn', icon: Linkedin, href: '#' },
    { name: 'GitHub', icon: Github, href: '#' },
    { name: 'Email', icon: Mail, href: '#' },
  ]

  const LinkCol = ({ title, links }: { title: string; links: { name: string; href: string }[] }) => (
    <div>
      <h4 className="text-foreground font-semibold mb-6">{title}</h4>
      <ul className="space-y-3">
        {links.map((link, idx) => (
          <li key={idx}>
            <a href={link.href} className="text-muted-foreground hover:text-primary transition-colors duration-200">
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <footer className="bg-background border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">AI</span>
              </div>
              <span className="text-2xl font-bold text-foreground">LandingCraft</span>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed max-w-md">
              Transform your marketing with AI-powered landing pages that convert.
              Research, analyze, and create high-performing campaigns in minutes.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((link, index) => {
                const Icon = link.icon
                return (
                  <Button key={index} variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary">
                    <Icon className="w-5 h-5" />
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            <LinkCol title="Product" links={[{ name: 'Features', href: '#' }, { name: 'API Docs', href: '#' }, { name: 'Integrations', href: '#' }, { name: 'Templates', href: '#' }]} />
            <LinkCol title="Company" links={[{ name: 'About', href: '#' }, { name: 'Blog', href: '#' }, { name: 'Careers', href: '#' }, { name: 'Contact', href: '#' }]} />
            <LinkCol title="Resources" links={[{ name: 'Help Center', href: '#' }, { name: 'Community', href: '#' }, { name: 'Case Studies', href: '#' }, { name: 'Guides', href: '#' }]} />
            <LinkCol title="Legal" links={[{ name: 'Privacy', href: '#' }, { name: 'Terms', href: '#' }, { name: 'Security', href: '#' }, { name: 'Cookies', href: '#' }]} />
          </div>
        </div>
      </div>

      <Separator className="opacity-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">© 2025 AI COPY WRITING. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
