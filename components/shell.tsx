import Image from "next/image";
import { Icon } from "./icon";
import { Navigation } from "./navigation";
import { MotionLink } from "./route-transition";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Studio" },
  { href: "/resources", label: "Learn" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const links = [...primaryLinks, { href: "/products", label: "Intelligence" }];

export function ButtonLink({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <MotionLink className={`button ${secondary ? "secondary" : "primary"}`} href={href}>{children}<Icon name={secondary ? "diagonal" : "arrow"} size={17} /></MotionLink>;
}

export function Header() {
  return <header className="site-header">
    <div className="wrap header-inner">
      <MotionLink href="/" className="brand" aria-label="HEURIAL home"><Image src="/brand/signature.svg" alt="" width={1520} height={359} priority /></MotionLink>
      <Navigation links={primaryLinks} />
      <MotionLink href="/contact" className="masthead-project">Start a project <Icon name="diagonal" size={16} /></MotionLink>
    </div>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="wrap footer-inner">
      <div className="footer-identity">
        <MotionLink href="/" aria-label="HEURIAL home"><Image src="/brand/wordmark.svg" alt="" width={1520} height={323} /></MotionLink>
        <p>AI consulting & engineering</p>
      </div>
      <nav aria-label="Footer navigation">
        {links.slice(1).map(({ href, label }) => <MotionLink key={href} href={href}>{label}<Icon name="diagonal" size={13} /></MotionLink>)}
      </nav>
    </div>
    <div className="wrap footer-end mono"><span>© HEURIAL</span><a href="#top">Back to top ↑</a></div>
  </footer>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow"><span aria-hidden="true" />{children}</p>;
}

export function PageIntro({ label, title, description }: { label: string; title: string; description: string }) {
  return <section className="page-intro"><div className="wrap page-intro-grid">
    <Eyebrow>{label}</Eyebrow>
    <h1><span className="intro-title">{title}</span></h1>
    <p className="lede">{description}</p>
  </div></section>;
}

export function Closing() {
  return <section className="closing">
    <div className="wrap closing-inner">
      <div><Eyebrow>Start a conversation</Eyebrow><h2>What should work better?</h2><p>Bring us one workflow, bottleneck, or idea. We’ll use it to frame a practical first step.</p></div>
      <ButtonLink href="/contact">Discuss a project</ButtonLink>
    </div>
  </section>;
}
