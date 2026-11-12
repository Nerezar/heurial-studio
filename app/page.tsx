import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { ButtonLink, Closing } from "@/components/shell";
import { SystemField } from "@/components/system-field";
import { WorkflowDemo } from "@/components/workflow-demo";
import "./home.css";

const problems = [
  { icon: "mail", title: "Leads go quiet.", body: "Inquiries come in, but follow-up slips when you’re busy." },
  { icon: "repeat", title: "Same questions, every day.", body: "You type the same answers to customers over and over." },
  { icon: "copy", title: "Copy, paste, repeat.", body: "Information lives in five tools and you’re the glue between them." },
  { icon: "search", title: "Notes everywhere.", body: "Docs, emails, and files are hard to find when you need them." },
];

const steps = [
  { title: "Talk", body: "A free 20-minute call. You tell me what eats your time, and I tell you honestly whether I can help." },
  { title: "Build", body: "I set up one workflow in the tools you already use, test it on real examples, and keep you in the loop." },
  { title: "Hand off", body: "I walk you through it, give you a plain-English guide, and stick around for 14 days of questions." },
];

const deliverables = [
  "A simple map of how the task works today",
  "One working automation or assistant",
  "Setup inside your own tools",
  "A plain-English guide",
  "A handoff call",
  "14 days of support",
];

const demos = [
  {
    title: "Heurial Intelligence",
    label: "Sample data",
    icon: "chart",
    description: "A sales dashboard demo that shows where deals get stuck. Switch views and periods to explore it.",
    href: "/products",
    action: "Open the dashboard demo",
  },
  {
    title: "Heurial Knowledge Assistant",
    label: "Public guides",
    icon: "book",
    description: "An assistant that answers questions from a set of documents and links to its sources. Try it on our own guides.",
    href: "/resources",
    action: "Try the assistant",
  },
];

const promises = [
  "You own everything I build. It lives in your accounts.",
  "I never ask for your passwords.",
  "I’ll tell you which AI services touch your data before we start.",
  "If I’m not the right fit, I’ll say so.",
];

export default function Home() {
  return <>
    <section className="studio-hero" aria-labelledby="hero-title">
      <div className="wrap studio-hero-inner">
        <div className="hero-field"><SystemField /></div>
        <div className="studio-hero-copy">
          <h1 id="hero-title">Make work <span>flow better.</span></h1>
          <p>I help small businesses take repetitive work off their plate, like lead follow-up, answering the same questions, or copying information between tools, with small AI-powered workflows built around the tools they already use.</p>
          <div className="hero-actions">
            <ButtonLink href="/contact">Book a free 20-min call</ButtonLink>
            <a href="#example" className="button secondary">Watch an example <Icon name="arrow" size={17} /></a>
          </div>
          <ul className="hero-facts">
            <li><Icon name="check" size={15} />$495 founding price</li>
            <li><Icon name="check" size={15} />About one week</li>
            <li><Icon name="check" size={15} />You own everything</li>
          </ul>
        </div>
      </div>
    </section>

    <section className="home-products" aria-labelledby="problems-title">
      <div className="wrap">
        <header className="home-products-heading">
          <p className="mono index-label">Sound familiar?</p>
          <h2 id="problems-title">The busywork adds up.</h2>
        </header>
        <div className="home-problem-grid">
          {problems.map(({ icon, title, body }) => (
            <article className="home-product-card" key={title}>
              <span className="home-product-icon"><Icon name={icon} size={22} /></span>
              <h3>{title}</h3>
              <p className="home-product-description">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="home-flow" id="example" aria-labelledby="flow-title">
      <div className="wrap">
        <header className="home-flow-heading">
          <p className="mono index-label">What I build</p>
          <h2 id="flow-title">Watch one run.</h2>
          <p>Here’s a typical workflow for a home-service business: a late-night inquiry gets a reply, a record, and a follow-up, and you only tap once.</p>
        </header>
        <WorkflowDemo />
      </div>
    </section>

    <section className="home-products home-steps" id="how-it-works" aria-labelledby="steps-title">
      <div className="wrap">
        <header className="home-products-heading">
          <p className="mono index-label">How it works</p>
          <h2 id="steps-title">One annoying task, handled.</h2>
          <p>We pick the most repetitive task in your week, and I build a small workflow that takes care of it. About one week from kickoff.</p>
        </header>
        <ol className="home-step-list">
          {steps.map(({ title, body }, index) => (
            <li className="home-product-card" key={title}>
              <span className="home-step-number" aria-hidden="true">{index + 1}</span>
              <h3>{title}</h3>
              <p className="home-product-description">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <section className="home-products home-offer-band" aria-labelledby="offer-title">
      <div className="wrap">
        <article className="home-offer">
          <div className="home-offer-price">
            <p className="mono index-label">Founding offer</p>
            <h2 id="offer-title">$495</h2>
            <p>For my first three clients. One workflow, about one week from kickoff.</p>
            <ButtonLink href="/contact">Book a free 20-min call</ButtonLink>
          </div>
          <div>
            <h3>What you get</h3>
            <ul className="home-check-list">
              {deliverables.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}
            </ul>
          </div>
        </article>
      </div>
    </section>

    <section className="home-products" id="demos" aria-labelledby="demos-title">
      <div className="wrap">
        <header className="home-products-heading">
          <p className="mono index-label">Demos</p>
          <h2 id="demos-title">See what’s possible.</h2>
          <p>These are working demos with sample data. They’re not live client systems.</p>
        </header>
        <div className="home-products-grid">
          {demos.map(({ title, label, icon, description, href, action }) => (
            <article className="home-product-card" key={href}>
              <div className="home-product-top">
                <span className="home-product-icon"><Icon name={icon} size={24} /></span>
                <p className="home-product-label">{label}</p>
              </div>
              <h3>{title}</h3>
              <p className="home-product-description">{description}</p>
              <MotionLink href={href} className="text-link">{action} <Icon name="diagonal" size={16} /></MotionLink>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="home-products home-trust" aria-labelledby="trust-title">
      <div className="wrap">
        <header className="home-products-heading">
          <p className="mono index-label">Honest promises</p>
          <h2 id="trust-title">Your business stays yours.</h2>
        </header>
        <ul className="home-check-list home-trust-list">
          {promises.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}
        </ul>
      </div>
    </section>

    <Closing />
  </>;
}
