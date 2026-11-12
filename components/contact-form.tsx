"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { HEARD_OPTIONS } from "@/lib/attribution";
import { readVisitSource } from "./attribution";
import { Icon } from "./icon";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; message: string }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = { ...Object.fromEntries(new FormData(form)), attribution: readVisitSource() };
    setBusy(true);
    setStatus(undefined);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (response.status !== 201 || typeof data.id !== "string") {
        setStatus({ error: true, message: data.error ?? "Your message couldn’t be saved. Please try again, or email hello@heurial.studio." });
        return;
      }
      form.reset();
      setStatus({ error: false, message: `Thanks! I got your message and will reply by email to set up a time. Reference: ${data.id}` });
    } catch {
      setStatus({ error: true, message: "Couldn’t confirm your message was received. It’s still in the form, so you can try again." });
    } finally {
      setBusy(false);
    }
  }

  return <form className="glass is-glow panel contact-form" method="post" action="/api/contact" onSubmit={submit} aria-describedby="inquiry-note">
    <div className="panel-head"><span className="icon-tile"><Icon name="send" size={20} /></span><h2>Tell me about the task</h2></div>
    <p className="form-note" id="inquiry-note">Required fields are marked with an asterisk. Your message is saved for me to review, along with how you found this site (for example, the link you clicked). Leave out sensitive information.</p>
    <div className="form-fields">
      <label>Name *<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
      <label>Email *<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label className="span-two">Business<input name="company" autoComplete="organization" maxLength={120} /></label>
      <label className="span-two">How did you hear about HEURIAL?<select name="heard" defaultValue="">
        <option value="">Choose one (optional)</option>
        {Object.entries(HEARD_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="span-two">What task eats up your time? *<textarea name="message" required minLength={10} maxLength={1200} rows={5} placeholder="For example: I spend an hour a day replying to the same questions from customers." /></label>
    </div>
    <div hidden><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button className="button primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Request a free call"}<Icon name="arrow" size={17} /></button>
    <p role="status" className={status?.error ? "form-status form-error" : "form-status"}>{status?.message}</p>
  </form>;
}
