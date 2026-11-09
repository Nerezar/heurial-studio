import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageIntro } from "@/components/shell";
import { contactFile } from "@/lib/contact";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell HEURIAL Studio about a workflow, bottleneck, or AI project you’d like to explore.",
};
export const dynamic = "force-dynamic";

const prompts = [
  "The workflow or decision you want to improve.",
  "The tools and teams involved today.",
  "What a better outcome would look like.",
];

export default function Contact() {
  return (
    <>
      <PageIntro
        label="04 / Contact"
        title="Let’s talk about the work."
        description="Tell us about a workflow, bottleneck, or idea you want to explore with Heurial Studio."
      />
      <section className="interior-paper" aria-labelledby="inquiry-guide">
        <div className="wrap interior-band contact-editorial">
          <aside className="contact-guide">
            <p className="interior-label">Project inquiries</p>
            <h2 id="inquiry-guide">What to include</h2>
            <ol>
              {prompts.map((prompt, index) => <li key={prompt}><span className="interior-label" aria-hidden="true">0{index + 1}</span>{prompt}</li>)}
            </ol>
          </aside>
          {contactFile() ? <ContactForm /> : (
            <div className="panel">
              <div className="panel-bar"><h2>Project inquiries</h2></div>
              <div className="panel-body"><p className="form-note">This site’s inquiry inbox is unavailable.</p></div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
