import type { Metadata } from "next";
import { DemoFrame } from "@/components/demo-frame";
import { Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Tools",
  description: "Try the tools I built, running on sample data: a follow-up tracker for leads, and Clip Desk for running a short-form clip page on numbers.",
};

type Guide = { label: string; title: string; description: string };

const trackerGuide: Guide[] = [
  { label: "Tasks", title: "Start the day with a short list", description: "New website inquiries, calls that need a status, and follow-ups that are due, all in one place with one-click actions." },
  { label: "Leads", title: "Drag a lead along", description: "Move a card between columns as a conversation progresses. A follow-up date is suggested for you." },
  { label: "Daily email", title: "Get it without opening anything", description: "Open Tasks and click “Daily email” to see the summary I get each morning. In this demo, nothing is ever sent." },
];

const clipGuide: Guide[] = [
  { label: "Today", title: "Fill in the numbers when they're due", description: "Each post asks for its views at 12, 24 and 72 hours. Type the number, or skip it if it isn't there. It never guesses." },
  { label: "Review", title: "See what actually worked", description: "Every post is compared on its 24-hour views. Pillars, time slots, platforms and tests are ranked against your median." },
  { label: "Sources", title: "Keep facts and credits straight", description: "Each fact keeps its source and asks to be checked again after 48 hours. Credits track who said yes and what was taken down." },
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
        description="Both run here on made-up data. Click around, add things, break things. Nothing is saved or sent."
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
      <section className="section" aria-labelledby="clipdesk-title">
        <div className="wrap">
          <header className="section-head">
            <Chip>Clip Desk</Chip>
            <h2 id="clipdesk-title">Run a clip page on numbers.</h2>
            <p>Log every post, fill in its views when they&apos;re due, and see each week which pillars, times, platforms and tests beat your median.</p>
          </header>
          <DemoFrame file="clipdesk/index.html" title="Clip Desk demo with sample data" address="heurial.studio/clipdesk" sample />
          <p className="demo-caption">Sample posts from a made-up gaming page. <a href={`/clipdesk/index.html?v=${process.env.TRACKER_VERSION}`}>Use Clip Desk for your own page</a>: your data stays in your browser.</p>
        </div>
      </section>
      <section className="section is-paper" aria-labelledby="clipdesk-guide">
        <div className="wrap">
          <header className="section-head">
            <Chip>Clip Desk guide</Chip>
            <h2 id="clipdesk-guide">What it does.</h2>
          </header>
          <GuideCards items={clipGuide} />
        </div>
      </section>
      <Closing />
    </>
  );
}
