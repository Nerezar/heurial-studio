import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageIntro } from "@/components/shell";
import { inquiryInboxReady } from "@/lib/contact";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Book a free 20-minute call with HEURIAL Studio. Tell me about a repetitive task you’d like off your plate.",
};
export const dynamic = "force-dynamic";

const prompts = [
  "The task that eats up your time.",
  "The tools you use for it today.",
  "A couple of times that work for a 20-minute call.",
];

export default function Contact() {
  return (
    <>
      <PageIntro
        label="Free 20-min call"
        title="Let’s find one thing to take off your plate."
        description="Tell me about a task you’re tired of doing. I’ll reply by email to set up a free 20-minute call."
      />
      <section className="interior-paper" aria-labelledby="inquiry-guide">
        <div className="wrap interior-band contact-editorial">
          <aside className="contact-guide">
            <p className="interior-label">Before the call</p>
            <h2 id="inquiry-guide">What to include</h2>
            <ol>
              {prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
            </ol>
          </aside>
          {inquiryInboxReady() ? <ContactForm /> : (
            <div className="panel">
              <div className="panel-bar"><h2>Book a free call</h2></div>
              <div className="panel-body">
                <p>Email <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a> with the task you’d like help with, and I’ll reply to set up a time.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
