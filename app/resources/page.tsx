import type { Metadata } from "next";
import { Assistant } from "@/components/assistant";
import { Chip, Closing, PageIntro } from "@/components/shell";
import knowledge from "@/content/knowledge.json";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Guides",
  description: "Ask the HEURIAL knowledge assistant a question and read the public guides behind its answers.",
};

export default function Resources() {
  return (
    <>
      <PageIntro
        label="Guides"
        title="Ask a question."
        description="This knowledge assistant is a demo. Ask about working with HEURIAL, and it answers from the public guides below, with a link to the passage it used."
      />
      <section className="section is-tight" aria-label="Knowledge assistant">
        <div className="wrap is-narrow">
          <Assistant />
        </div>
      </section>
      <section className="section is-paper" aria-labelledby="source-title">
        <div className="wrap">
          <header className="section-head">
            <Chip>Source library</Chip>
            <h2 id="source-title">Read the sources</h2>
            <p>Everything the assistant can say comes from these passages.</p>
          </header>
          <div className="source-grid">
            {knowledge.map(({ id, title, text }) => (
              <article className="glass source-card" id={id} key={id}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Closing />
    </>
  );
}
