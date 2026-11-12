import type { Metadata } from "next";
import { DemoFrame } from "@/components/demo-frame";
import { Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Demos",
  description: "Try the follow-up tracker I built for my own business, running on sample data: new inquiries, follow-up reminders, a pipeline board, and a daily email.",
};

const views = [
  { label: "Needs you", title: "Start the day with a short list", description: "New website inquiries, calls that need a status, and follow-ups that are due, all in one place with one-click actions." },
  { label: "Pipeline", title: "Drag a lead along", description: "Move a card between columns as a conversation progresses. A follow-up date is suggested for you." },
  { label: "Daily email", title: "Get it without opening anything", description: "Click “Email preview” to see the summary I get each morning. In this demo, nothing is ever sent." },
];

export default function Products() {
  return (
    <>
      <PageIntro
        label="Demo / Sample data"
        title="Never lose track of a lead."
        description="This is the follow-up tracker I built for my own business, running on made-up people. Add a lead, move a card, log some time. Nothing is saved or sent."
      />
      <section className="wrap interior-band intelligence-lab" aria-label="Interactive follow-up tracker demo">
        <div className="lab-heading"><p className="interior-label">Follow-up tracker</p><p className="interior-label">Sample data</p></div>
        <DemoFrame />
        <p className="lab-caption">Everything here is a demo. Refresh the page to start over.</p>
      </section>
      <section className="interior-paper" aria-labelledby="demo-guide">
        <div className="wrap interior-band lab-guide">
          <div><p className="interior-label">Demo guide</p><h2 id="demo-guide">Three things to try.</h2></div>
          <div className="lab-guide-entries">
            {views.map(({ label, title, description }) => (
              <article key={label}>
                <p className="interior-label">{label}</p>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Closing />
    </>
  );
}
