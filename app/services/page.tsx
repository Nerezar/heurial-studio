import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { MotionLink } from "@/components/route-transition";
import { Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Questions",
  description: "Answers to common questions about HEURIAL: what it costs, how the three steps work, how long it takes, and how your data is handled.",
};

// Every answer restates something the site already promises elsewhere. Change both places together.
const questions = [
  {
    id: "cost",
    title: "What does it cost?",
    body: "Three fixed prices: a quick fix for $295, one workflow for $495 (my founding offer for the first three clients), or two connected workflows for $895. Each is 50% to start and 50% at handoff. Some tools charge their own small monthly fees. I’ll tell you about those before we start, and they’re billed to your account.",
  },
  {
    id: "steps",
    title: "How does it work?",
    body: "Three steps. Talk: a free 20-minute call where you walk me through your week and the task you wish would just happen. Build: I set up the workflow in the tools you already have, test it on real examples, and send you an update mid-week. Hand off: a short call where I show you how it works, with support afterwards.",
  },
  {
    id: "time",
    title: "How long does it take?",
    body: "A quick fix takes a few days. One workflow takes about one week from kickoff, and two workflows take about two weeks.",
  },
  {
    id: "examples",
    title: "What kind of task?",
    body: "Things like replying to new inquiries and logging them in a spreadsheet, nudging leads who went quiet, answering common customer questions from your own documents, turning meeting notes into a to-do list, or a weekly report that pulls numbers into one email.",
  },
  {
    id: "tools",
    title: "Which tools do you work with?",
    body: "The ones you already have, like email, spreadsheets, forms, your calendar, or your CRM. The workflow is built inside those.",
  },
  {
    id: "approval",
    title: "Will it send things without me?",
    body: "Only if you want it to. I add a human check where it matters, so a reply or anything with consequences can wait for your OK before it goes out.",
  },
  {
    id: "data",
    title: "Is my data safe?",
    body: "I work inside your accounts, I only touch what the task needs, and I never ask for your passwords. You invite me as a user instead. Before we start, I’ll tell you which AI services your data passes through.",
  },
  {
    id: "own",
    title: "Do I own what you build?",
    body: "Yes. Everything I build lives in your accounts, not mine, and it’s yours to keep.",
  },
  {
    id: "fit",
    title: "What if you can’t help?",
    body: "I’ll tell you on the call. It’s free, and if I’m not the right fit, I’ll say so.",
  },
  {
    id: "after",
    title: "What if it breaks later?",
    body: "Support after handoff is included: 7 days with a quick fix, 14 days with one workflow, and 30 days with two workflows. After that, you can ask me for small fixes or another workflow.",
  },
  {
    id: "start",
    title: "How do I start?",
    body: "Book a free 20-minute call from the Contact page. Tell me the task that eats your time and the tools you use for it. If it’s a fit, you get a short written scope before any work starts.",
  },
];

export default function Questions() {
  return (
    <>
      <PageIntro
        label="Questions"
        title="Straight answers."
        description="What it costs, how it works, how long it takes, and what happens to your data."
      />
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
