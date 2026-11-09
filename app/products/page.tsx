import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Heurial Intelligence",
  description: "Explore an interactive revenue intelligence demo with sample pipeline, revenue trends, and diagnostic signals.",
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
        label="Heurial Intelligence / Prototype"
        title="Where does your pipeline stall?"
        description="Explore a revenue intelligence prototype for reviewing trends, inspecting funnel stages, and identifying questions worth investigating."
      />
      <section className="wrap interior-band intelligence-lab" aria-label="Interactive revenue intelligence demo">
        <div className="lab-heading"><p className="interior-label">01 / Interactive demo</p><p className="interior-label">Fixed sample dataset</p></div>
        <Dashboard />
        <p className="lab-caption">Switch periods or views to explore the sample data.</p>
      </section>
      <section className="interior-paper" aria-labelledby="intelligence-guide">
        <div className="wrap interior-band lab-guide">
          <div><p className="interior-label">02 / Demo guide</p><h2 id="intelligence-guide">Three ways to investigate.</h2></div>
          <div className="lab-guide-entries">
            {views.map(({ label, title, description }, index) => (
              <article key={label}>
                <p className="interior-label">0{index + 1} / {label}</p>
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
