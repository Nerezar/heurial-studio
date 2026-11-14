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

export default function Contact() {
  const formReady = inquiryInboxReady();
  return (
    <>
      <PageIntro
        label="Free 20-minute call"
        title="Let’s find one thing to take off your plate."
        description="Pick a time for a free 20-minute call, or send me a message first."
      />
      <section className="section is-tight" aria-labelledby="inquiry-guide">
        <div className="wrap contact-grid">
          <aside className="glass is-glow contact-guide">
            <Chip>Fastest way</Chip>
            <h2 id="inquiry-guide">Pick a time</h2>
            <p>Choose a slot that suits you. It’s a free 20-minute video call on Google Meet, and you tell me about the task you’re tired of doing.</p>
            <a className="button primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={17} />Pick a time</a>
            <p className="contact-alt">Prefer email? Write to <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>.</p>
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
