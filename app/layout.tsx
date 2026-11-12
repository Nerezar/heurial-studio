import type { Metadata, Viewport } from "next";
import { AttributionCapture } from "@/components/attribution";
import { RouteMotion } from "@/components/route-transition";
import { Footer, Header } from "@/components/shell";
import "./globals.css";
import "./shell.css";

const shareTitle = "HEURIAL Studio";
const shareDescription = "Take repetitive work off your plate. HEURIAL builds small AI-powered workflows, like lead follow-up and FAQ assistants, around the tools you already use.";
const shareImage = {
  url: "/brand/share-card.jpg",
  width: 1200,
  height: 630,
  alt: "HEURIAL Studio. Make work flow better.",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://www.heurial.studio"),
  title: { default: "HEURIAL Studio | Simple AI workflows for small businesses", template: "%s | HEURIAL Studio" },
  description: shareDescription,
  openGraph: {
    type: "website",
    siteName: shareTitle,
    title: shareTitle,
    description: shareDescription,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: shareTitle,
    description: shareDescription,
    images: [shareImage],
  },
  icons: {
    icon: "/brand/emblem.svg",
    apple: { url: "/brand/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = { themeColor: "#0b0c0e", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body id="top">
    <RouteMotion>
      <AttributionCapture />
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
    </RouteMotion>
  </body></html>;
}
