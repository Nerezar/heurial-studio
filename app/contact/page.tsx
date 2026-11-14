import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Icon } from "@/components/icon";
import { PageIntro } from "@/components/shell";
import { inquiryInboxReady } from "@/lib/contact";
import { BOOKING_URL } from "@/lib/site";
import "../interiors.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Book a free 20-minute call with HEURIAL Studio. Tell me about a repetitive task you’d like off your plate.",
};
export const dynamic = "force-dynamic";

export default async function Contact({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const formReady = inquiryInboxReady();
  const plan = (await searchParams).plan === "1";
  return (
    <>
      <PageIntro
        label="Free 20-minute call"
        title="Let’s find one thing to take off your plate."
        description="Pick a time for a free 20-minute call, or send me a message first."
      />
      <section className="section is-tight" aria-labelledby="inquiry-guide">
        <div className="wrap contact-grid">
          <aside className="glass contact-card contact-book" aria-labelledby="inquiry-guide">
            <div className="contact-bar"><span><Icon name="calendar" size={15} />Free call</span><span>20 minutes · Google Meet</span></div>
            <div className="contact-card-body">
              <div className="contact-book-head">
                {/* A clock face with 20 of its 60 minutes filled in. */}
                <svg className="contact-dial" viewBox="0 0 80 80" aria-hidden="true">
                  <circle className="dial-track" cx="40" cy="40" r="34" />
                  <circle className="dial-arc" cx="40" cy="40" r="34" pathLength="60" />
                  <text className="dial-num" x="40" y="41">20</text>
                  <text className="dial-unit" x="40" y="55">min</text>
                </svg>
                <div>
                  <h2 id="inquiry-guide">Pick a time</h2>
                  <p>Choose a slot that suits you. It’s free.</p>
                </div>
              </div>
              <ol className="contact-steps">
                <li><b>Pick a time</b><span>My booking page opens in a new tab.</span></li>
                <li><b>Tell me the task</b><span>The one you’re tired of doing, and the tools you use for it.</span></li>
                <li><b>Get a straight answer</b><span>I’ll tell you honestly whether I can help.</span></li>
              </ol>
              <a className="button primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Pick a time<Icon name="arrow" size={17} /></a>
              <p className="contact-alt">Prefer email? Write to <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>.</p>
            </div>
          </aside>
          {formReady ? <ContactForm plan={plan} /> : (
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
