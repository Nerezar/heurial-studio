"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { HEARD_OPTIONS } from "@/lib/attribution";
import { BOOKING_URL } from "@/lib/site";
import { readVisitSource } from "./attribution";
import { Icon } from "./icon";

/** `plan` starts the message as a request for the $49 workflow plan. */
export function ContactForm({ plan = false }: { plan?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ id: string; email: string; acknowledged: boolean }>();
  const thanks = useRef<HTMLHeadingElement>(null);

  // Move focus to the thank-you heading so keyboard and screen-reader users land on it.
  useEffect(() => { if (sent) thanks.current?.focus(); }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = { ...Object.fromEntries(new FormData(form)), attribution: readVisitSource() };
    setBusy(true);
    setError(undefined);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (response.status !== 201 || typeof data.id !== "string") {
        setError(data.error ?? "Your message couldn’t be saved. Please try again, or email hello@heurial.studio.");
        return;
      }
      setSent({ id: data.id, email: String(new FormData(form).get("email") ?? "").trim(), acknowledged: data.acknowledged === true });
    } catch {
      setError("Couldn’t confirm your message was received. It’s still in the form, so you can try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <div className="glass panel contact-thanks" role="status">
      <div className="panel-head"><span className="icon-tile"><Icon name="check" size={20} /></span><h2 ref={thanks} tabIndex={-1}>Thanks, I got your message</h2></div>
      {plan && <p>For a workflow plan, I’ll reply with a payment link. Once it’s paid, I’ll send your plan within three working days.</p>}
      <p>It’s saved, and I’ll read it myself. I’ll reply to <strong>{sent.email}</strong> about your free 20-minute call. If you’d rather not wait, pick a time now.</p>
      <ul className="check-list">
        {sent.acknowledged && <li><Icon name="check" size={18} />I’ve sent a confirmation to that address. If you don’t see it, check your spam folder.</li>}
        <li><Icon name="check" size={18} />My reply will come from hello@heurial.studio.</li>
        <li><Icon name="check" size={18} /><span>Thought of something else? Email me at <a className="text-link" href="mailto:hello@heurial.studio">hello@heurial.studio</a>.</span></li>
      </ul>
      <p className="form-note">Reference: {sent.id}</p>
      <div className="contact-thanks-actions">
        <a className="button primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={17} />Pick a time</a>
        <button className="button secondary" type="button" onClick={() => setSent(undefined)}>Send another message</button>
      </div>
    </div>;
  }

  return <form className="glass contact-card contact-form" method="post" action="/api/contact" onSubmit={submit} aria-describedby="inquiry-note">
    <div className="contact-bar"><span><Icon name="send" size={15} />Message</span><span>I reply by email</span></div>
    <div className="panel">
    <h2>Or send me a message</h2>
    <div className="form-fields">
      <label>Name<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label className="span-two">What task eats up your time?<textarea name="message" defaultValue={plan ? "I’d like a $49 workflow plan. The task is: " : undefined} required minLength={10} maxLength={1200} rows={4} placeholder="For example: I spend an hour a day replying to the same questions from customers." /></label>
      <label>Business (optional)<input name="company" autoComplete="organization" maxLength={120} /></label>
      <label>How did you hear about me? (optional)<select name="heard" defaultValue="">
        <option value="">Choose one</option>
        {Object.entries(HEARD_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <div hidden><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button className="button secondary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"}<Icon name="arrow" size={17} /></button>
    <p role="alert" className="form-status form-error">{error}</p>
    <p className="form-note" id="inquiry-note">Your message is saved for me to review, along with how you found this site (for example, the link you clicked). Leave out sensitive information.</p>
    </div>
  </form>;
}
