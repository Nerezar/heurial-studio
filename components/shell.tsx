import type { ReactNode } from "react";
import Image from "next/image";
import { BOOKING_URL } from "@/lib/site";
import { tone } from "@/lib/style";
import { Icon } from "./icon";
import { Navigation } from "./navigation";
import Link from "next/link";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Questions" },
  { href: "/products", label: "Demos" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const links = [...primaryLinks, { href: "/resources", label: "Guides" }];

type Tone = Parameters<typeof tone>[0];

export function ButtonLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  const className = `button ${secondary ? "secondary" : "primary"}`;
  // Another site (the booking calendar) opens in a new tab, as it does from the Contact page.
  if (href.startsWith("http")) return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}<Icon name="arrow" size={17} /></a>;
  return <Link className={className} href={href}>{children}<Icon name="arrow" size={17} /></Link>;
}

/** Small label that sits above a heading. */
export function Chip({ children, color }: { children: ReactNode; color?: Tone }) {
  return <p className="label" style={color ? tone(color) : undefined}><i aria-hidden="true" />{children}</p>;
}

export function Header() {
  return <header className="site-header">
    <div className="wrap header-inner">
      <Link href="/" className="brand" aria-label="HEURIAL home"><Image src="/brand/signature.svg" alt="" width={1520} height={359} priority /></Link>
      <Navigation links={primaryLinks} />
      <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">Book a free call<Icon name="diagonal" size={14} /></a>
    </div>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="wrap footer-grid">
      <div className="footer-identity">
        <Link href="/" aria-label="HEURIAL home"><Image src="/brand/wordmark.svg" alt="" width={1520} height={323} /></Link>
        <p>Make work flow better.</p>
        <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>
      </div>
      <nav aria-label="Footer navigation">
        {links.slice(1).map(({ href, label }) => <Link key={href} href={href}>{label}<Icon name="diagonal" size={13} /></Link>)}
      </nav>
    </div>
    <div className="wrap footer-end"><span>© {new Date().getFullYear()} HEURIAL Studio</span><a href="#top">Back to top <Icon name="up" size={14} /></a></div>
  </footer>;
}

/** `compact` is for pages whose main thing is below the intro and should be on the first screen. */
export function PageIntro({ label, title, description, compact = false }: { label: string; title: string; description: string; compact?: boolean }) {
  return <section className={`page-intro is-navy${compact ? " is-compact" : ""}`}>
    <div className="wrap page-intro-inner">
      <Chip>{label}</Chip>
      <h1><span className="intro-title">{title}</span></h1>
      <p className="lede">{description}</p>
    </div>
  </section>;
}

export function Closing() {
  return <section className="closing is-navy" aria-labelledby="closing-title">
    <div className="wrap closing-panel">
      <Chip>Free 20-minute call</Chip>
      <h2 id="closing-title">Got a task you’re tired of doing?</h2>
      <div className="closing-copy">
        <p>Tell me about it. If I can help, I’ll show you exactly how. If not, I’ll point you somewhere useful.</p>
        <ButtonLink href={BOOKING_URL}>Book a free 20-min call</ButtonLink>
      </div>
    </div>
  </section>;
}
