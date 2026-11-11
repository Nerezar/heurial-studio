import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Demos",
  description: "Try Heurial Intelligence, a sales dashboard demo with sample data that shows where deals get stuck.",
};

const views = [
  { label: "Overview", title: "Read the trend", description: "Compare closed revenue, open pipeline, and qualified-to-won conversion across sample periods." },
  { label: "Pipeline", title: "Inspect the funnel", description: "See how deal counts narrow between qualification, discovery, proposal, and closed won." },
  { label: "Signals", title: "Decide what to check", description: "Use sample observations to frame follow-up questions about conversion and handoffs." },
];

export default function Products() {
  return (
    <>
      <PageIntro
        label="Demo / Sample data"
        title="Where do deals get stuck?"
        description="Heurial Intelligence is a working demo of the kind of simple dashboard I can build. Every number below is sample data, not a real business."
      />
      <section className="wrap interior-band intelligence-lab" aria-label="Interactive revenue intelligence demo">
        <div className="lab-heading"><p className="interior-label">Heurial Intelligence</p><p className="interior-label">Sample data</p></div>
        <Dashboard />
        <p className="lab-caption">Switch periods or views to explore the sample data.</p>
      </section>
      <section className="interior-paper" aria-labelledby="intelligence-guide">
        <div className="wrap interior-band lab-guide">
          <div><p className="interior-label">Demo guide</p><h2 id="intelligence-guide">Three ways to explore it.</h2></div>
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
