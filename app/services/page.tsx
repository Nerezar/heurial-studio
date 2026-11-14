import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "How it works",
  description: "How HEURIAL’s founding offer works: a free 20-minute call, one AI-powered workflow built in your own tools, and a simple handoff. Fixed prices from $295.",
};

const steps = [
  {
    id: "talk",
    title: "Talk",
    time: "20 minutes, free",
    body: "We start with a free 20-minute call. You walk me through your week and the task you wish would just happen. I’ll tell you honestly whether I can help.",
    output: "A clear yes or no, and a short written scope if it’s a fit.",
  },
  {
    id: "build",
    title: "Build",
    time: "About one week",
    body: "I set up one workflow using the tools you already have, like email, spreadsheets, forms, or your CRM. I test it on real examples, add a human check where it matters, and send you an update mid-week.",
    output: "One working automation or assistant, set up in your own accounts.",
  },
  {
    id: "hand-off",
    title: "Hand off",
    time: "14 days of support",
    body: "We do a short call where I show you how it works. You get a plain-English guide, and I’m on hand for 14 days if anything comes up.",
    output: "A handoff call, a written guide, and 14 days of support.",
  },
];

const questions = [
  {
    id: "cost",
    title: "What does it cost?",
    body: "Three fixed prices: a quick fix for $295, one workflow for $495 (my founding offer for the first three clients), or two connected workflows for $895. Each is 50% to start and 50% at handoff. Some tools charge their own small monthly fees. I’ll tell you about those before we start, and they’re billed to your account.",
  },
  {
    id: "examples",
    title: "What kind of task?",
    body: "Things like replying to new inquiries and logging them in a spreadsheet, nudging leads who went quiet, answering common customer questions from your own documents, turning meeting notes into a to-do list, or a weekly report that pulls numbers into one email.",
  },
  {
    id: "data",
    title: "Is my data safe?",
    body: "I work inside your accounts, I only touch what the task needs, and I never ask for your passwords. You invite me as a user instead. Before we start, I’ll tell you which AI services your data passes through.",
  },
  {
    id: "after",
    title: "What if it breaks later?",
    body: "The guide explains how it works and what to check. After the 14 days of support, you can ask me for small fixes or another workflow.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <PageIntro
        label="How it works"
        title="One annoying task, handled."
        description="We pick the most repetitive task in your week, and I build a small workflow that takes care of it. About one week from kickoff, at a fixed price from $295."
      />
      <section className="section is-tight" aria-labelledby="steps-title">
        <div className="wrap">
          <header className="section-head">
            <Chip>Three steps</Chip>
            <h2 id="steps-title">From call to handoff</h2>
          </header>
          <ol className="steps">
            {steps.map(({ id, title, time, body, output }, index) => (
              <li className="step" id={id} key={id}>
                <span className="step-dot" aria-hidden="true" />
                <p className="step-count num" aria-hidden="true">0{index + 1}</p>
                <h3>{title}</h3>
                <p className="step-time"><Icon name="clock" size={14} />{time}</p>
                <p className="step-body">{body}</p>
                <p className="step-get"><Icon name="check" size={16} /><span><b>You get:</b> {output}</span></p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="section is-paper" aria-labelledby="faq-title">
        <div className="wrap faq-layout">
          <header className="section-head">
            <Chip>Questions</Chip>
            <h2 id="faq-title">Common questions</h2>
            <p>Don’t see yours? <MotionLink href="/contact" className="text-link">Ask me directly</MotionLink>.</p>
          </header>
          <Faq questions={questions} />
        </div>
      </section>
      <Closing />
    </>
  );
}
