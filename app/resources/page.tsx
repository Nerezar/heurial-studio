import type { Metadata } from "next";
import { Assistant } from "@/components/assistant";
import { Icon } from "@/components/icon";
import { Closing, PageIntro } from "@/components/shell";
import knowledge from "@/content/knowledge.json";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Learn",
  description: "Ask the HEURIAL knowledge assistant and browse the public documentation behind its cited answers.",
};

export default function Resources() {
  return (
    <>
      <PageIntro
        label="02 / Learn"
        title="Start with a question."
        description="Explore how Heurial works. Ask about a Studio service, starting a project, or the Heurial Intelligence demo, then read the passages behind the answer."
      />
      <div className="wrap interior-band learn-console">
        <div className="learn-side">
          <p className="interior-label">01 / Ask</p>
          <p>The assistant looks up relevant passages in our public documents and links to the sources it uses.</p>
          <a className="interior-index-link" href="#source-title">Browse the documents <Icon name="diagonal" size={15} /></a>
        </div>
        <Assistant />
      </div>
      <section className="interior-paper" aria-labelledby="source-title">
        <div className="wrap interior-band learn-library">
          <div className="learn-library-index">
            <p className="interior-label">02 / Source library</p>
            <h2 id="source-title">Read the sources</h2>
            <nav aria-label="Source index">
              {knowledge.map(({ id, title }, index) => (
                <a className="interior-index-link" href={`#${id}`} key={id}>
                  <span className="interior-index-number" aria-hidden="true">0{index + 1}</span>
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
