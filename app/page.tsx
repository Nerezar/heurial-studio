import { GlassStage } from "@/components/glass-stage";
import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { ButtonLink, Chip, Closing } from "@/components/shell";
import { BOOKING_URL } from "@/lib/site";
import "./home.css";

// Each line restates something promised further down the page. Change both places together.
const facts = [
  { title: "From $49", body: "A one-page plan for one task." },
  { title: "About one week", body: "One workflow, from kickoff to handoff." },
  { title: "You own everything", body: "It lives in your accounts, not mine." },
];

// Each problem is paired with the kind of task a workflow takes over. The Questions page lists the same tasks.
const problems = [
  { title: "Leads go quiet.", body: "Inquiries come in, but follow-up slips when you’re busy.", fix: "Reply to new inquiries, log them, and nudge the leads who went quiet." },
  { title: "Same questions, every day.", body: "You type the same answers to customers over and over.", fix: "Answer common questions from your own documents." },
  { title: "Copy, paste, repeat.", body: "Information lives in five tools and you’re the glue between them.", fix: "Send a weekly report that pulls your numbers together." },
  { title: "Notes everywhere.", body: "Docs, emails, and files are hard to find when you need them.", fix: "Turn meeting notes into a to-do list." },
];

const steps = [
  { title: "Talk", time: "20 minutes, free", body: "A free 20-minute call. You tell me what eats your time, and I tell you honestly whether I can help.", get: "A clear yes or no, and a short written scope if it’s a fit." },
  { title: "Build", time: "About one week", body: "I set up one workflow in the tools you already use, test it on real examples, and keep you in the loop.", get: "One working workflow, set up in your own accounts." },
  { title: "Hand off", time: "14 days of support", body: "I walk you through it, give you a plain-English guide, and stick around for 14 days of questions.", get: "A written guide, and a workflow that’s yours to keep." },
];

const deliverables = [
  "A simple map of how the task works today",
  "One working automation or assistant",
  "Setup inside your own tools",
  "A plain-English guide",
  "A handoff call",
  "14 days of support",
];

// Prices and contents were set by the owner on 2026-11-13. The $495 package is the founding offer, unchanged.
const packages = [
  { name: "Quick fix", price: 295, time: "A few days", tag: "", note: "One simple automation for one small job.", example: "Form submissions go into a spreadsheet, and you get a text for each one.", items: ["One simple automation", "Setup inside your own tools", "7 days of support"] },
  { name: "One workflow", price: 495, time: "About one week", tag: "Founding offer", note: "One workflow, built in your own tools. For my first three clients.", example: "A new inquiry is logged, a reply is drafted for you to approve, and a follow-up is booked.", items: deliverables },
  { name: "Two workflows", price: 895, time: "About two weeks", tag: "", note: "Two workflows that work together.", example: "Inquiry follow-up, plus a weekly report of where your leads came from and what they earned.", items: ["Two connected workflows", "Setup inside your own tools", "A plain-English guide", "A handoff call", "30 days of support"] },
];

const promises = [
  { title: "You own everything I build.", body: "It lives in your accounts, not mine." },
  { title: "I never ask for your passwords.", body: "You invite me as a user instead." },
  { title: "No surprises with your data.", body: "I’ll tell you which AI services touch it before we start." },
  { title: "Straight answers.", body: "If I’m not the right fit, I’ll say so." },
];

export default function Home() {
  return <>
    <section className="hero ed" aria-labelledby="hero-title">
      <div className="wrap hero-head">
        <div className="hero-copy">
          <Chip>For small businesses</Chip>
          <h1 id="hero-title">Make work <span className="accent">flow better.</span></h1>
          <p className="hero-lede">I take one repetitive task off your plate: following up with leads, answering the same questions, moving information between tools. Fixed price, inside the tools you already use.</p>
          <div className="hero-actions">
            <ButtonLink href={BOOKING_URL}>Book a free 20-min call</ButtonLink>
            <a href="#pricing" className="text-link">See prices <Icon name="arrow" size={17} /></a>
          </div>
        </div>
        <div className="hero-visual"><GlassStage /></div>
      </div>
      <dl className="wrap hero-facts">
        {facts.map(({ title, body }) => <div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}
      </dl>
    </section>

    <section className="section" aria-labelledby="problems-title">
      <div className="wrap split">
        <header className="section-head">
          <Chip>Sound familiar?</Chip>
          <h2 id="problems-title">The busywork adds up.</h2>
          <p>A few minutes here, a few there. By Friday it’s hours you didn’t spend on the work that pays. The best first workflow is one small task you repeat all the time.</p>
        </header>
        <ul className="rows">
          {problems.map(({ title, body, fix }) => (
            <li key={title}>
              <h3>{title}</h3>
              <div>
                <p>{body}</p>
                <p className="row-fix"><Icon name="arrow" size={16} />{fix}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="section is-paper" id="how-it-works" aria-labelledby="steps-title">
      <div className="wrap">
        <header className="section-head is-split">
          <Chip>How it works</Chip>
          <h2 id="steps-title">One annoying task, handled.</h2>
          <p>We pick the most repetitive task in your week, and I build a small workflow that takes care of it. About one week from kickoff.</p>
        </header>
        <ol className="ed-steps">
          {steps.map(({ title, time, body, get }, index) => (
            <li key={title}>
              <p className="ed-count" aria-hidden="true">0{index + 1}</p>
              <div className="ed-step-name">
                <h3>{title}</h3>
                <p className="step-time"><Icon name="clock" size={14} />{time}</p>
              </div>
              <i aria-hidden="true" />
              <div className="ed-step-body">
                <p>{body}</p>
                <p className="ed-get"><b>You get:</b> {get}</p>
              </div>
            </li>
          ))}
        </ol>
        <MotionLink href="/resources" className="ed-learn">
          <span className="ed-learn-art" aria-hidden="true">
            <svg viewBox="0 0 240 130" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="edm-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbfbfa" /><stop offset=".3" stopColor="#8b8f96" /><stop offset=".55" stopColor="#eeeff1" /><stop offset=".8" stopColor="#5d6169" /><stop offset="1" stopColor="#d4d6da" /></linearGradient>
                <linearGradient id="edm-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#6d7178" /><stop offset=".4" stopColor="#f6f6f5" /><stop offset=".7" stopColor="#9a9da3" /><stop offset="1" stopColor="#f1f1f0" /></linearGradient>
                <filter id="edm-soft"><feGaussianBlur stdDeviation="2.4" /></filter>
              </defs>
              <rect width="240" height="130" fill="#c9cacd" />
              <g filter="url(#edm-soft)">
                <path d="M-20 104C40 24 92 132 150 62s92-50 122-12v100H-20Z" fill="url(#edm-a)" />
                <path d="M-20 58C30-12 100 92 160 30s90-40 112-10v52C222 42 190 102 130 92S40 62-20 112Z" fill="url(#edm-b)" />
              </g>
            </svg>
          </span>
          <span className="ed-learn-text"><small>Guides</small><b>Practical guides, plainly written.</b></span>
          <Icon name="arrow" size={22} />
        </MotionLink>
        <p className="steps-more"><MotionLink href="/services" className="text-link">Read the common questions <Icon name="diagonal" size={16} /></MotionLink></p>
      </div>
    </section>

    <section className="section" aria-labelledby="trust-title">
      <div className="wrap split">
        <header className="section-head">
          <Chip>Honest promises</Chip>
          <h2 id="trust-title">Your business stays yours.</h2>
          <p>The same four rules on every project.</p>
        </header>
        <ul className="rows">
          {promises.map(({ title, body }) => <li key={title}><h3>{title}</h3><p>{body}</p></li>)}
        </ul>
      </div>
    </section>

    <section className="section is-paper" id="pricing" aria-labelledby="offer-title">
      <div className="wrap">
        <header className="section-head is-split">
          <Chip>Pricing</Chip>
          <h2 id="offer-title">Pick the size of the job.</h2>
          <p>Three fixed prices, each for a clear piece of work. Half to start, half at handoff.</p>
        </header>
        <ul className="rates">
          {packages.map(({ name, price, time, tag, note, example, items }) => (
            <li className="rate" key={name}>
              <div className="rate-name">
                <h3>{name}</h3>
                <p className="step-time"><Icon name="clock" size={14} />{time}</p>
                {tag && <span className="chip"><i aria-hidden="true" />{tag}</span>}
              </div>
              <p className="rate-price num">${price}</p>
              <div className="rate-body">
                <p className="rate-note">{note}</p>
                <p className="rate-example"><b>For example:</b> {example}</p>
                <ul className="check-list rate-items">
                  {items.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}
                </ul>
              </div>
            </li>
          ))}
          <li className="rate">
            <div className="rate-name">
              <h3>Workflow plan</h3>
              <p className="step-time">Not sure yet? Start here.</p>
            </div>
            <p className="rate-price num">$49</p>
            <div className="rate-body">
              <p className="rate-note">One task, one plan.</p>
              <p className="rate-example">Tell me one task you repeat. I’ll send you a one-page plan: the steps, the tools, what it would cost to run, and whether it’s worth automating at all. Keep it and build it yourself, or have me build it and the $49 comes off the price.</p>
              <ButtonLink href="/contact?plan=1" secondary>Get a plan</ButtonLink>
            </div>
          </li>
        </ul>
        <div className="rate-cta">
          <ButtonLink href={BOOKING_URL}>Book a free 20-min call</ButtonLink>
          <p>Some tools charge their own small monthly fees. I’ll tell you about those before we start, and they’re billed to your account.</p>
        </div>
      </div>
    </section>

    <Closing />
  </>;
}
