import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { SavingsCalculator } from "@/components/savings-calculator";
import { ButtonLink, Chip, Closing } from "@/components/shell";
import { SystemField } from "@/components/system-field";
import { WorkflowDemo } from "@/components/workflow-demo";
import { tone } from "@/lib/style";
import "./home.css";

// Labels that float around the hero ring: the stages of a typical workflow.
const heroChips = [
  { label: "New inquiry", icon: "mail", color: "signal", x: "3%", y: "17%", delay: "0s" },
  { label: "Reply drafted", icon: "spark", color: "violet", x: "56%", y: "3%", delay: "-2.2s" },
  { label: "You approved", icon: "check", color: "green", x: "70%", y: "47%", delay: "-4s" },
  { label: "Logged", icon: "table", color: "cyan", x: "49%", y: "86%", delay: "-1.2s" },
  { label: "Follow-up set", icon: "bell", color: "amber", x: "0%", y: "68%", delay: "-3.1s" },
] as const;

const tools = [
  { icon: "mail", label: "Email" },
  { icon: "table", label: "Spreadsheets" },
  { icon: "form", label: "Forms" },
  { icon: "calendar", label: "Calendar" },
  { icon: "users", label: "CRM" },
];

const problems = [
  { icon: "mail", color: "red", title: "Leads go quiet.", body: "Inquiries come in, but follow-up slips when you’re busy." },
  { icon: "repeat", color: "amber", title: "Same questions, every day.", body: "You type the same answers to customers over and over." },
  { icon: "copy", color: "signal", title: "Copy, paste, repeat.", body: "Information lives in five tools and you’re the glue between them." },
  { icon: "search", color: "violet", title: "Notes everywhere.", body: "Docs, emails, and files are hard to find when you need them." },
] as const;

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

const fits = [
  { icon: "mail", color: "signal", label: "Reply to new inquiries and log them" },
  { icon: "bell", color: "amber", label: "Nudge leads who went quiet" },
  { icon: "book", color: "violet", label: "Answer common questions from your own documents" },
  { icon: "check", color: "green", label: "Turn meeting notes into a to-do list" },
  { icon: "chart", color: "cyan", label: "Send a weekly report that pulls your numbers together" },
] as const;

const promises = [
  { icon: "shield", title: "You own everything I build.", body: "It lives in your accounts, not mine." },
  { icon: "lock", title: "I never ask for your passwords.", body: "You invite me as a user instead." },
  { icon: "eye", title: "No surprises with your data.", body: "I’ll tell you which AI services touch it before we start." },
  { icon: "chat", title: "Straight answers.", body: "If I’m not the right fit, I’ll say so." },
];

export default function Home() {
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <Chip>AI workflows for small businesses</Chip>
          <h1 id="hero-title">Make work <span className="grad">flow better.</span></h1>
          <p className="hero-lede">I build small AI-powered workflows that take repetitive work off your plate: following up with leads, answering the same questions, moving information between tools. All inside the tools you already use.</p>
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
        <div className="hero-visual" aria-hidden="true">
          <SystemField />
          {heroChips.map(({ label, icon, color, x, y, delay }, index) => (
            <span className="chip hero-chip" key={label} style={tone(color, { "--x": x, "--y": y, "--d": delay, "--n": index })}>
              <Icon name={icon} size={15} />{label}
            </span>
          ))}
        </div>
      </div>
      <div className="wrap hero-tools">
        <p>Built around the tools you already use</p>
        <ul>
          {tools.map(({ icon, label }) => <li key={label}><Icon name={icon} size={16} />{label}</li>)}
        </ul>
      </div>
    </section>

    <section className="section" aria-labelledby="problems-title">
      <div className="wrap split">
        <header className="section-head">
          <Chip color="red">Sound familiar?</Chip>
          <h2 id="problems-title">The busywork adds up.</h2>
          <p>A few minutes here, a few there. By Friday it’s hours you didn’t spend on the work that pays.</p>
        </header>
        <div className="note-stack">
          {problems.map(({ icon, color, title, body }, index) => (
            <article className="note" key={title} style={tone(color, { "--i": index })}>
              <span className="icon-tile"><Icon name={icon} size={20} /></span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="section" id="example" aria-labelledby="flow-title">
      <div className="wrap">
        <header className="section-head">
          <Chip>What I build</Chip>
          <h2 id="flow-title">Watch one run.</h2>
          <p>Here’s a typical workflow for a home-service business. A late-night inquiry gets a reply, a record, and a follow-up, and you only tap once.</p>
        </header>
        <WorkflowDemo />
      </div>
    </section>

    <section className="section" id="how-it-works" aria-labelledby="steps-title">
      <div className="wrap">
        <header className="section-head is-center">
          <Chip color="cyan">How it works</Chip>
          <h2 id="steps-title">One annoying task, handled.</h2>
          <p>We pick the most repetitive task in your week, and I build a small workflow that takes care of it. About one week from kickoff.</p>
        </header>
        <ol className="steps">
          {steps.map(({ title, body }, index) => (
            <li className="glass lift step" key={title}>
              <span className="step-orb" aria-hidden="true">{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <p className="steps-more"><MotionLink href="/services" className="text-link">See each step in detail <Icon name="diagonal" size={16} /></MotionLink></p>
      </div>
    </section>

    <section className="section" id="calculator" aria-labelledby="calc-title">
      <div className="wrap">
        <header className="section-head">
          <Chip color="green">Quick math</Chip>
          <h2 id="calc-title">What is that task costing you?</h2>
          <p>Pick one task you repeat every week. Move the sliders to see what it adds up to over a year.</p>
        </header>
        <SavingsCalculator />
      </div>
    </section>

    <section className="section offer" aria-labelledby="offer-title">
      <div className="wrap">
        <header className="section-head is-center">
          <Chip>Founding offer</Chip>
          <h2 id="offer-title">One price. One workflow. About a week.</h2>
          <p>For my first three clients. Half to start, half at handoff.</p>
        </header>
        <div className="offer-stage">
          <span className="ghost-word" aria-hidden="true">Offer</span>
          <article className="glass is-frosted is-glow glow-bottom offer-card">
            <p className="offer-label">Founding offer</p>
            <p className="offer-price num">$495</p>
            <p className="offer-note">One workflow, built in your own tools, about one week from kickoff.</p>
            <ul className="check-list">
              {deliverables.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}
            </ul>
            <ButtonLink href="/contact">Book a free 20-min call</ButtonLink>
          </article>
          <article className="glass is-frosted fit-card">
            <h3>Tasks it fits</h3>
            <p>The best first workflow is one small task you repeat all the time. For example:</p>
            <ul className="fit-list">
              {fits.map(({ icon, color, label }) => <li className="chip" key={label} style={tone(color)}><Icon name={icon} size={16} />{label}</li>)}
            </ul>
            <p className="fit-foot">Some tools charge their own small monthly fees. I’ll tell you about those before we start, and they’re billed to your account.</p>
          </article>
        </div>
      </div>
    </section>

    <section className="section" id="demos" aria-labelledby="demos-title">
      <div className="wrap">
        <header className="section-head">
          <Chip color="violet">Demos</Chip>
          <h2 id="demos-title">See what’s possible.</h2>
          <p>These are working demos with sample data. They’re not live client systems.</p>
        </header>
        <div className="demo-grid">
          <article className="glass lift demo-card">
            <div className="demo-preview" aria-hidden="true">
              <span className="chip demo-tag" style={tone("amber")}>Sample data</span>
              <div className="mini-row" style={tone("red")}><i /><span><b>Ben Carter</b><small>3 days overdue · Check on the proposal</small></span></div>
              <div className="mini-row" style={tone("amber")}><i /><span><b>Elena Petrova</b><small>Due today · Send the revised scope</small></span></div>
              <div className="mini-chips">
                <span className="chip" style={tone("amber")}>Call booked</span>
                <span className="chip" style={tone("signal")}>Proposal sent</span>
                <span className="chip" style={tone("green")}>Paid</span>
              </div>
            </div>
            <div className="demo-body">
              <h3>Follow-up tracker</h3>
              <p>The tool I use to keep every inquiry and follow-up from slipping. Move cards, check reminders, and preview the daily email.</p>
              <MotionLink href="/products" className="text-link">Try the tracker demo <Icon name="diagonal" size={16} /></MotionLink>
            </div>
          </article>
          <article className="glass lift demo-card">
            <div className="demo-preview" aria-hidden="true">
              <span className="chip demo-tag" style={tone("violet")}>Public guides</span>
              <p className="mini-q">Is my data safe?</p>
              <p className="mini-a">You own everything HEURIAL builds, and it lives in your accounts.</p>
              <div className="mini-chips">
                <span className="chip" style={tone("violet")}><Icon name="book" size={14} />Your data and ownership</span>
              </div>
            </div>
            <div className="demo-body">
              <h3>Knowledge assistant</h3>
              <p>An assistant that answers questions from a set of documents and links to its sources. Try it on my own guides.</p>
              <MotionLink href="/resources" className="text-link">Try the assistant <Icon name="diagonal" size={16} /></MotionLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section className="section" aria-labelledby="trust-title">
      <div className="wrap split is-reversed">
        <header className="section-head">
          <Chip color="green">Honest promises</Chip>
          <h2 id="trust-title">Your business stays yours.</h2>
          <p>The same four rules on every project.</p>
        </header>
        <div className="note-stack is-mirrored">
          {promises.map(({ icon, title, body }, index) => (
            <article className="note" key={title} style={tone("green", { "--i": index })}>
              <span className="icon-tile"><Icon name={icon} size={20} /></span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>

    <Closing />
  </>;
}
