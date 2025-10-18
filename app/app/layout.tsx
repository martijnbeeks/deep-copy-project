import type React from "react";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/contexts/app-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { QueryProvider } from "@/lib/providers/query-provider";
import { GlobalPollingProvider } from "@/contexts/global-polling-context";
import { Toaster } from "@/components/ui/toaster";
import { PageTransition } from "@/components/ui/page-transition";
import "./globals";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Copywriting Dashboard",
  description: "Professional AI-powered content creation platform",
  generator: "v0.app",
  robots: "index, follow",
  icons: {
    icon: "/nib.png",
    shortcut: "/nib.png",
    apple: "/nib.png",
  },
  openGraph: {
    title: "AI Copywriting Dashboard",
    description: "Professional AI-powered content creation platform",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'light';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                }
              })();
            `,
          }}
        />
      </head>
                  <body
                    className={`${inter.variable} ${robotoMono.variable} font-sans antialiased`}
                  >
                    <QueryProvider>
                      <AppProvider>
                        <SidebarProvider>
                          <GlobalPollingProvider>
                            <PageTransition>
                              {children}
                            </PageTransition>
                            <Toaster />
                          </GlobalPollingProvider>
                        </SidebarProvider>
                      </AppProvider>
                    </QueryProvider>
                  </body>
    </html>
  );
}
