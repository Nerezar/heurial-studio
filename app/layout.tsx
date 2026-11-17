import type { Metadata, Viewport } from "next";
import { AttributionCapture } from "@/components/attribution";
import { RouteMotion } from "@/components/route-transition";
import { Footer, Header } from "@/components/shell";
import { CANONICAL_ORIGIN, SOCIAL_LINKS, siteOrigin } from "@/lib/site";
import "./globals.css";
import "./shell.css";

const shareTitle = "HEURIAL Studio";
const shareDescription = "Take repetitive work off your plate. HEURIAL sets up small workflows, like lead follow-up and answers to common questions, in the tools you already use.";
const shareImage = {
  url: "/brand/share-card-2.jpg",
  width: 1200,
  height: 630,
  alt: "HEURIAL Studio. Make work flow better.",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "HEURIAL Studio | Simple workflows for small businesses", template: "%s | HEURIAL Studio" },
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
    icon: "/brand/mark-icon.png",
    apple: { url: "/brand/mark-touch.png", sizes: "180x180" },
  },
};

// Tells search engines these profiles belong to the site.
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: shareTitle,
  url: CANONICAL_ORIGIN,
  logo: `${CANONICAL_ORIGIN}/brand/mark-touch.png`,
  sameAs: SOCIAL_LINKS.map((link) => link.href),
};

export const viewport: Viewport = { themeColor: "#f4f1ea", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body id="top">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
    <RouteMotion>
      <AttributionCapture />
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
    </RouteMotion>
  </body></html>;
}
