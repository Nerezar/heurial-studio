import type { CSSProperties } from "react";
import { FlowBoard } from "@/components/flow-board";
import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { SavingsCalculator } from "@/components/savings-calculator";
import { ButtonLink, Chip, Closing } from "@/components/shell";
import { WorkflowDemo } from "@/components/workflow-demo";
import { tone } from "@/lib/style";
import "./home.css";

const tools = [
  { icon: "mail", label: "Email" },
  { icon: "table", label: "Spreadsheets" },
  { icon: "form", label: "Forms" },
  { icon: "calendar", label: "Calendar" },
  { icon: "users", label: "CRM" },
];

const problems = [
  { title: "Leads go quiet.", body: "Inquiries come in, but follow-up slips when you’re busy." },
  { title: "Same questions, every day.", body: "You type the same answers to customers over and over." },
  { title: "Copy, paste, repeat.", body: "Information lives in five tools and you’re the glue between them." },
  { title: "Notes everywhere.", body: "Docs, emails, and files are hard to find when you need them." },
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
  { name: "Quick fix", price: 295, time: "A few days", tag: "", note: "One simple automation for one small job.", items: ["One simple automation", "Setup inside your own tools", "7 days of support"] },
  { name: "One workflow", price: 495, time: "About one week", tag: "Founding offer", note: "One workflow, built in your own tools. For my first three clients.", items: deliverables },
  { name: "Two workflows", price: 895, time: "About two weeks", tag: "", note: "Two workflows that work together.", items: ["Two connected workflows", "Setup inside your own tools", "A plain-English guide", "A handoff call", "30 days of support"] },
];

const fits = [
  "Reply to new inquiries and log them",
  "Nudge leads who went quiet",
  "Answer common questions from your own documents",
  "Turn meeting notes into a to-do list",
  "Send a weekly report that pulls your numbers together",
];

const promises = [
  { title: "You own everything I build.", body: "It lives in your accounts, not mine." },
  { title: "I never ask for your passwords.", body: "You invite me as a user instead." },
  { title: "No surprises with your data.", body: "I’ll tell you which AI services touch it before we start." },
  { title: "Straight answers.", body: "If I’m not the right fit, I’ll say so." },
];

const REEL = [...Array(20).keys()].map((n) => n % 10);

/** A price whose digits roll into place like a counter when the card scrolls into view. */
function Price({ value }: { value: number }) {
  return <p className="price num">
    <span className="sr-only">${value}</span>
    <span aria-hidden="true">$</span>
    {String(value).split("").map((digit, index) => (
      <span className="price-roll" aria-hidden="true" key={index} style={{ "--d": digit, "--i": index } as CSSProperties}>
        <span>{REEL.map((n, at) => <i key={at}>{n}</i>)}</span>
      </span>
    ))}
  </p>;
}

export default function Home() {
  return <>
    <section className="hero is-navy" aria-labelledby="hero-title">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <Chip>AI workflows for small businesses</Chip>
          <h1 id="hero-title">Make work <span className="accent">flow better.</span></h1>
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
        <div className="hero-visual is-board">
          <FlowBoard />
        </div>
      </div>
      <div className="wrap hero-tools">
        <p>Built around the tools you already use</p>
        <ul>
          {tools.map(({ icon, label }) => <li key={label}><Icon name={icon} size={16} />{label}</li>)}
        </ul>
      </div>
    </section>

    <section className="section is-paper" aria-labelledby="problems-title">
      <div className="wrap split">
        <header className="section-head">
          <Chip>Sound familiar?</Chip>
          <h2 id="problems-title">The busywork adds up.</h2>
          <p>A few minutes here, a few there. By Friday it’s hours you didn’t spend on the work that pays.</p>
        </header>
        <ul className="rows">
          {problems.map(({ title, body }) => <li key={title}><h3>{title}</h3><p>{body}</p></li>)}
        </ul>
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

    <section className="section is-paper" id="how-it-works" aria-labelledby="steps-title">
      <div className="wrap">
        <header className="section-head">
          <Chip>How it works</Chip>
          <h2 id="steps-title">One annoying task, handled.</h2>
          <p>We pick the most repetitive task in your week, and I build a small workflow that takes care of it. About one week from kickoff.</p>
        </header>
        <ol className="steps">
          {steps.map(({ title, time, body, get }, index) => (
            <li className="step" key={title}>
              <span className="step-dot" aria-hidden="true" />
              <p className="step-count num" aria-hidden="true">0{index + 1}</p>
              <h3>{title}</h3>
              <p className="step-time"><Icon name="clock" size={14} />{time}</p>
              <p className="step-body">{body}</p>
              <p className="step-get"><Icon name="check" size={16} /><span><b>You get:</b> {get}</span></p>
            </li>
          ))}
        </ol>
        <p className="steps-more"><MotionLink href="/services" className="text-link">See each step in detail <Icon name="diagonal" size={16} /></MotionLink></p>
      </div>
    </section>

    <section className="section" id="calculator" aria-labelledby="calc-title">
      <div className="wrap">
        <header className="section-head">
          <Chip>Quick math</Chip>
          <h2 id="calc-title">What is that task costing you?</h2>
          <p>Pick one task you repeat every week. Move the sliders to see what it adds up to over a year.</p>
        </header>
        <SavingsCalculator />
      </div>
    </section>

    <section className="section offer" id="pricing" aria-labelledby="offer-title">
      <div className="wrap">
        <header className="section-head">
          <Chip>Pricing</Chip>
          <h2 id="offer-title">Pick the size of the job.</h2>
          <p>Three fixed prices, each for a clear piece of work. Half to start, half at handoff.</p>
        </header>
        <div className="price-grid">
          {packages.map(({ name, price, time, tag, note, items }) => (
            <article className={`glass price-card${tag ? " is-glow is-featured" : ""}`} key={name}>
              <header className="price-head">
                <h3>{name}</h3>
                {tag && <span className="chip" style={tone("signal")}><i aria-hidden="true" />{tag}</span>}
              </header>
              <Price value={price} />
              <p className="price-note">{note}</p>
              <p className="step-time"><Icon name="clock" size={14} />{time}</p>
              <ul className="check-list">
                {items.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}
              </ul>
              <ButtonLink href="/contact" secondary={!tag}>Book a free 20-min call</ButtonLink>
            </article>
          ))}
        </div>
        <div className="fit-card">
          <div>
            <h3>Tasks it fits</h3>
            <p>The best first workflow is one small task you repeat all the time. For example:</p>
          </div>
          <div>
            <ul className="fit-list">
              {fits.map((label) => <li key={label}>{label}</li>)}
            </ul>
            <p className="fit-foot">Some tools charge their own small monthly fees. I’ll tell you about those before we start, and they’re billed to your account.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="section" id="demos" aria-labelledby="demos-title">
      <div className="wrap">
        <header className="section-head">
          <Chip>Demos</Chip>
          <h2 id="demos-title">See what’s possible.</h2>
          <p>These are working demos with sample data. They’re not live client systems.</p>
        </header>
        <div className="demo-grid">
          <article className="glass lift demo-card">
            <div className="demo-preview" aria-hidden="true">
              <div className="demo-bar"><span><Icon name="grid" size={15} />Follow-up tracker</span><span className="chip" style={tone("amber")}>Sample data</span></div>
              <div className="demo-view">
                <div className="mini-stats">
                  <p><b className="num">12</b><small>Open leads</small></p>
                  <p><b className="num">3</b><small>Due today</small></p>
                  <p><b className="num">$4,200</b><small>Won so far</small></p>
                </div>
                <div className="mini-board">
                  <div className="mini-col"><small>New</small><div className="mini-card" style={tone("red")}><i /><b>Ben C.</b><span>Overdue</span></div></div>
                  <div className="mini-col"><small>Proposal sent</small><div className="mini-card" style={tone("signal")}><i /><b>Maya B.</b><span>Sent Tue</span></div></div>
                  <div className="mini-col"><small>Won</small><div className="mini-card" style={tone("green")}><i /><b>Tom O.</b><span>Paid</span></div></div>
                  <div className="mini-card mini-mover" style={tone("amber")}><i /><b>Elena P.</b><span>Due today</span></div>
                </div>
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
              <div className="demo-bar"><span><Icon name="chat" size={15} />Knowledge assistant</span><span className="chip" style={tone("signal")}>Public guides</span></div>
              <div className="demo-view mini-chat">
                <p className="mini-q">Is my data safe?</p>
                <div className="mini-turn">
                  <span className="mini-dots"><i /><i /><i /></span>
                  <p className="mini-a">You own everything HEURIAL builds, and it lives in your accounts.</p>
                </div>
                <span className="chip mini-source" style={tone("signal")}><Icon name="book" size={14} />Your data and ownership</span>
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

    <section className="section is-paper" aria-labelledby="trust-title">
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

    <Closing />
  </>;
}
