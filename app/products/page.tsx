import type { Metadata } from "next";
import { DemoFrame } from "@/components/demo-frame";
import { Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Tools",
  description: "Try the tools I built, running on sample data: a follow-up tracker for leads, and Autopilot with 30 automations for a small business.",
};

type Guide = { label: string; title: string; description: string };

const trackerGuide: Guide[] = [
  { label: "Tasks", title: "Start the day with a short list", description: "New website inquiries, calls that need a status, and follow-ups that are due, all in one place with one-click actions." },
  { label: "Leads", title: "Drag a lead along", description: "Move a card between columns as a conversation progresses. A follow-up date is suggested for you." },
  { label: "Daily email", title: "Get it without opening anything", description: "Open Tasks and click “Daily email” to see the summary I get each morning. In this demo, nothing is ever sent." },
];

const autopilotGuide: Guide[] = [
  { label: "Automations", title: "30 jobs, one switch each", description: "Missed-call text-back, quote follow-ups, reminders, review requests, invoice reminders, reports. Turn on what you need." },
  { label: "Approvals", title: "Nothing AI writes goes out without you", description: "AI drafts wait in one queue. Edit, approve or discard. Texts outside your business hours wait until you open." },
  { label: "Plans", title: "Start small, unlock more", description: "Starter covers 8 automations, Pro 19, Business all 30. Each plan includes a monthly allowance of AI drafts." },
];


function GuideCards({ items }: { items: Guide[] }) {
  return <div className="card-grid">
    {items.map(({ label, title, description }) => (
      <article className="guide-card" key={label}>
        <p className="guide-label">{label}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </article>
    ))}
  </div>;
}

export default function Products() {
  return (
    <>
      <PageIntro
        compact
        label="Tools with sample data"
        title="Tools I built to run a business."
        description="Each one runs here on made-up data. Click around, add things, break things. Nothing is saved or sent."
      />
      <section className="section is-tight" aria-labelledby="tracker-title">
        <div className="wrap">
          <header className="section-head">
            <Chip>Follow-up tracker</Chip>
            <h2 id="tracker-title">Never lose track of a lead.</h2>
            <p>The tracker I use for my own business: new inquiries, follow-up reminders, a pipeline board and a daily email.</p>
          </header>
          <DemoFrame />
          <p className="demo-caption">Everything here is a demo. Refresh the page to start over.</p>
        </div>
      </section>
      <section className="section is-paper" aria-labelledby="tracker-guide">
        <div className="wrap">
          <header className="section-head">
            <Chip>Tracker guide</Chip>
            <h2 id="tracker-guide">Three things to try.</h2>
          </header>
          <GuideCards items={trackerGuide} />
        </div>
      </section>
      <section className="section" aria-labelledby="autopilot-title">
        <div className="wrap">
          <header className="section-head">
            <Chip>Autopilot</Chip>
            <h2 id="autopilot-title">Thirty jobs your business does on its own.</h2>
            <p>One app for the follow-ups, reminders and requests that slip when you&apos;re busy. Pick an event under Try it and watch what happens.</p>
          </header>
          <DemoFrame file="autopilot/index.html" title="Autopilot demo with a sample business" address="heurial.studio/autopilot" sample />
          <p className="demo-caption">A made-up plumbing business. Nothing is sent. Refresh to start over.</p>
        </div>
      </section>
      <section className="section is-paper" aria-labelledby="autopilot-guide">
        <div className="wrap">
          <header className="section-head">
            <Chip>Autopilot guide</Chip>
            <h2 id="autopilot-guide">How it works.</h2>
          </header>
          <GuideCards items={autopilotGuide} />
        </div>
      </section>
      <Closing />
    </>
  );
}
