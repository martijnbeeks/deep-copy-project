import { Button } from "@/components/ui/button";
import deepcopyLogo from "@/assets/deepcopy-logo.png";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src={deepcopyLogo} alt="DeepCopy" className="h-[57.6px]" />
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            How it Works
          </a>
          <a href="#faqs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            FAQs
          </a>
          <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            Login
          </Button>
          <Button size="sm">
            Join Waitlist
          </Button>
        </div>
      </div>
    </header>
  );
};
