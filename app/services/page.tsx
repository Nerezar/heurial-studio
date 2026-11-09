import type { Metadata } from "next";
import { Icon } from "@/components/icon";
import { Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Studio",
  description: "Explore HEURIAL Studio’s AI consulting, revenue diagnostics, workflow automation, engineering, and managed services.",
};

const services = [
  {
    id: "consulting",
    title: "AI consulting",
    body: "Map where AI can help, identify the data and permissions you have, and choose a use case with a clear owner and a way to measure it.",
    output: "A prioritized scope and evaluation plan.",
  },
  {
    id: "diagnostics",
    title: "Revenue diagnostics",
    body: "Review funnel definitions and CRM data to find where deals stall, stages vary, and handoffs need a closer look.",
    output: "A baseline and a shortlist of bottlenecks to validate.",
  },
  {
    id: "automation",
    title: "Workflow automation",
    body: "Connect business systems around a specific task. Define triggers, approvals, and what happens when something fails.",
    output: "A documented workflow with human review where it matters.",
  },
  {
    id: "engineering",
    title: "AI engineering",
    body: "Build integrations, internal tools, and retrieval-based assistants around approved sources. Evaluate them on representative work before a wider rollout.",
    output: "A working system with evaluation and handoff documentation.",
  },
  {
    id: "managed-services",
    title: "Managed services",
    body: "Set responsibilities for monitoring alerts, maintaining integrations, and reevaluating the system as data and workflows change.",
    output: "An operating plan with owners and a review schedule.",
  },
];

export default function Services() {
  return (
    <>
      <PageIntro
        label="01 / Heurial Studio"
        title="Build around the work."
        description="Start with a specific business problem. Heurial Studio can help you diagnose it, build a system to address it, and decide how to operate it."
      />
      <section className="interior-paper" aria-labelledby="studio-capabilities">
        <div className="wrap interior-band studio-catalog">
          <div className="studio-directory">
            <p className="interior-label">Studio / Capabilities</p>
            <h2 id="studio-capabilities">What we do</h2>
            <nav aria-label="Studio capabilities">
              {services.map(({ id, title }, index) => (
                <a className="interior-index-link" href={`#${id}`} key={id}>
                  <span className="interior-index-number" aria-hidden="true">0{index + 1}</span>
                  <span>{title}</span>
                  <Icon name="diagonal" size={14} />
                </a>
              ))}
            </nav>
          </div>
          <div className="studio-entries">
            {services.map(({ id, title, body, output }, index) => (
              <article className="studio-entry" id={id} key={id}>
                <div>
                  <p className="interior-label" aria-hidden="true">0{index + 1} / Service</p>
                  <h3>{title}</h3>
                </div>
                <div className="studio-description">
                  <p>{body}</p>
                  <p className="studio-output"><span className="interior-label">Deliverable</span>{output}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Closing />
    </>
  );
}
