"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#value-props", label: "Why DeepCopy?" },
    { href: "#results", label: "Results" },
    { href: "#faqs", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background">
      <div className="container flex h-14 md:h-16 items-center justify-between px-3 md:px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image
              src="/deepcopy-logo.svg"
              alt="DeepCopy"
              width={100}
              height={40}
              className="h-7 md:h-10 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 md:gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex"
            asChild
          >
            <Link href="/login">Login</Link>
          </Button>
          <Button
            size="sm"
            className="text-xs md:text-sm px-2 md:px-4"
            asChild
          >
            <Link href="/login?waitlist=true">
              <span className="hidden sm:inline">Join Waitlist</span>
              <span className="sm:hidden">Join</span>
            </Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[300px] p-0 flex flex-col shadow-none">
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col px-6 py-4 flex-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium text-foreground hover:text-primary transition-colors py-3 border-b last:border-0"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="px-6 pt-4 pb-6 border-t space-y-3">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    Login
                  </Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/login?waitlist=true" onClick={() => setMobileMenuOpen(false)}>
                    Join Waitlist
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

