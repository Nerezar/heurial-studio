import type { Metadata } from "next";
import { RouteMotion } from "@/components/route-transition";
import { Footer, Header } from "@/components/shell";
import "./globals.css";
import "./shell.css";

export const metadata: Metadata = {
  title: { default: "Heurial Studio | AI Consulting & Engineering", template: "%s | HEURIAL" },
  description: "Heurial Studio helps businesses diagnose bottlenecks, engineer AI systems, and automate operational work.",
  openGraph: {
    type: "website",
    siteName: "HEURIAL",
    title: "Heurial Studio | AI Consulting & Engineering",
    description: "AI consulting, engineering, and automation for businesses.",
  },
  icons: { icon: "/brand/emblem.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body id="top">
    <RouteMotion>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
    </RouteMotion>
  </body></html>;
}
