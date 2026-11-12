import type { Metadata } from "next";
import { DemoFrame } from "@/components/demo-frame";
import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Demos",
  description: "Try the follow-up tracker I built for my own business, running on sample data: new inquiries, follow-up reminders, a pipeline board, and a daily email.",
};

const views = [
  { icon: "bell", label: "Needs you", title: "Start the day with a short list", description: "New website inquiries, calls that need a status, and follow-ups that are due, all in one place with one-click actions." },
  { icon: "workflow", label: "Pipeline", title: "Drag a lead along", description: "Move a card between columns as a conversation progresses. A follow-up date is suggested for you." },
  { icon: "mail", label: "Daily email", title: "Get it without opening anything", description: "Click “Email preview” to see the summary I get each morning. In this demo, nothing is ever sent." },
];

export default function Products() {
  return (
    <>
      <PageIntro
        ghost="Demo"
        label="Demo with sample data"
        title="Never lose track of a lead."
        description="This is the follow-up tracker I built for my own business, running on made-up people. Add a lead, move a card, log some time. Nothing is saved or sent."
      />
      <section className="section is-tight" aria-label="Interactive follow-up tracker demo">
        <div className="wrap">
          <DemoFrame />
          <p className="demo-caption">Everything here is a demo. Refresh the page to start over.</p>
        </div>
      </section>
      <section className="section" aria-labelledby="demo-guide">
        <div className="wrap">
          <header className="section-head">
            <Chip color="green">Demo guide</Chip>
            <h2 id="demo-guide">Three things to try.</h2>
          </header>
          <div className="card-grid">
            {views.map(({ icon, label, title, description }) => (
              <article className="glass lift guide-card" key={label}>
                <span className="icon-tile"><Icon name={icon} size={20} /></span>
                <p className="guide-label">{label}</p>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <p className="more-link"><MotionLink href="/resources" className="text-link">Try the other demo: the knowledge assistant <Icon name="diagonal" size={16} /></MotionLink></p>
        </div>
      </section>
      <Closing />
    </>
  );
}
