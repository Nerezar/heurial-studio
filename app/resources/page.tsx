import type { Metadata } from "next";
import { Assistant } from "@/components/assistant";
import { Icon } from "@/components/icon";
import { Closing, PageIntro } from "@/components/shell";
import knowledge from "@/content/knowledge.json";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Guides",
  description: "Ask the HEURIAL Knowledge Assistant a question and read the public guides behind its answers."
};

export default function Resources() {
  return (
    <>
      <PageIntro
        label="Guides"
        title="Ask a question."
        description="This is the Heurial Knowledge Assistant demo. Ask about working with HEURIAL, and it answers from the public guides below, with links to its sources."
      />
      <div className="wrap interior-band learn-console">
        <div className="learn-side">
          <p className="interior-label">Ask</p>
          <p>The assistant looks up relevant passages in our public documents and links to the sources it uses.</p>
          <a className="interior-index-link" href="#source-title">Browse the documents <Icon name="diagonal" size={15} /></a>
        </div>
        <Assistant />
      </div>
      <section className="interior-paper" aria-labelledby="source-title">
        <div className="wrap interior-band learn-library">
          <div className="learn-library-index">
            <p className="interior-label">Source library</p>
            <h2 id="source-title">Read the sources</h2>
            <nav aria-label="Source index">
              {knowledge.map(({ id, title }) => (
                <a className="interior-index-link" href={`#${id}`} key={id}>
                  <span>{title}</span>
                  <Icon name="diagonal" size={14} />
                </a>
              ))}
            </nav>
          </div>
          <div className="learn-entries">
            {knowledge.map(({ id, title, text }) => (
              <article id={id} key={id}>
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
