import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Icon } from "@/components/icon";
import { Chip, PageIntro } from "@/components/shell";
import { inquiryInboxReady } from "@/lib/contact";
import { BOOKING_URL } from "@/lib/site";
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
  const formReady = inquiryInboxReady();
  return (
    <>
      <PageIntro
        label="Free 20-minute call"
        title="Let’s find one thing to take off your plate."
        description="Tell me about a task you’re tired of doing. I’ll reply by email to set up a free 20-minute call."
      />
      <section className="section is-tight" aria-labelledby="inquiry-guide">
        <div className="wrap contact-grid">
          <aside className="glass contact-guide">
            <Chip>Before the call</Chip>
            <h2 id="inquiry-guide">What to include</h2>
            <ul className="check-list">
              {prompts.map((prompt) => <li key={prompt}><Icon name="check" size={18} />{prompt}</li>)}
            </ul>
            <div className="contact-book">
              <p>Already know you want to talk? Skip the form and pick a time. It’s a 20-minute video call on Google Meet.</p>
              <a className="button secondary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={17} />Pick a time</a>
            </div>
            {formReady && <p className="contact-alt">Prefer email? Write to <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>.</p>}
          </aside>
          {formReady ? <ContactForm /> : (
            <div className="glass is-glow panel">
              <div className="panel-head"><span className="icon-tile"><Icon name="mail" size={20} /></span><h2>Book a free call</h2></div>
              <p>Email <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a> with the task you’d like help with, and I’ll reply to set up a time.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
