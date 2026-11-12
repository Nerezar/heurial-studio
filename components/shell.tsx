import type { ReactNode } from "react";
import Image from "next/image";
import { tone } from "@/lib/style";
import { Icon } from "./icon";
import { Navigation } from "./navigation";
import { MotionLink } from "./route-transition";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "How it works" },
  { href: "/products", label: "Demos" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const links = [...primaryLinks, { href: "/resources", label: "Guides" }];

type Tone = Parameters<typeof tone>[0];

export function ButtonLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <MotionLink className={`button ${secondary ? "secondary" : "primary"}`} href={href}>{children}<Icon name="arrow" size={17} /></MotionLink>;
}

/** Small glowing label that sits above a heading. */
export function Chip({ children, color }: { children: ReactNode; color?: Tone }) {
  return <p className="chip" style={color ? tone(color) : undefined}><i aria-hidden="true" />{children}</p>;
}

export function Header() {
  return <header className="site-header">
    <div className="nav-pill">
      <MotionLink href="/" className="brand" aria-label="HEURIAL home"><Image src="/brand/signature.svg" alt="" width={1520} height={359} priority /></MotionLink>
      <Navigation links={primaryLinks} />
      <MotionLink href="/contact" className="nav-cta">Book a free call</MotionLink>
    </div>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="wrap footer-grid">
      <div className="footer-identity">
        <MotionLink href="/" aria-label="HEURIAL home"><Image src="/brand/wordmark.svg" alt="" width={1520} height={323} /></MotionLink>
        <p>Make work flow better.</p>
        <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>
      </div>
      <nav aria-label="Footer navigation">
        {links.slice(1).map(({ href, label }) => <MotionLink key={href} href={href}>{label}<Icon name="diagonal" size={13} /></MotionLink>)}
      </nav>
    </div>
    <div className="wrap footer-end"><span>© {new Date().getFullYear()} HEURIAL Studio</span><a href="#top">Back to top <Icon name="up" size={14} /></a></div>
  </footer>;
}

export function PageIntro({ label, title, description, ghost }: { label: string; title: string; description: string; ghost?: string }) {
  return <section className="page-intro">
    {ghost && <span className="ghost-word" aria-hidden="true">{ghost}</span>}
    <div className="wrap page-intro-inner">
      <Chip>{label}</Chip>
      <h1><span className="intro-title">{title}</span></h1>
      <p className="lede">{description}</p>
    </div>
  </section>;
}

export function Closing() {
  return <section className="closing" aria-labelledby="closing-title">
    <div className="wrap">
      <div className="closing-panel glass is-glow glow-bottom">
        <Chip>Free 20-minute call</Chip>
        <h2 id="closing-title">Got a task you’re tired of doing?</h2>
        <p>Tell me about it. If I can help, I’ll show you exactly how. If not, I’ll point you somewhere useful.</p>
        <ButtonLink href="/contact">Book a free 20-min call</ButtonLink>
      </div>
    </div>
  </section>;
}
