"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Icon } from "./icon";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; message: string }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
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
        setStatus({ error: true, message: data.error ?? "We couldn’t save your inquiry. Please try again." });
        return;
      }
      form.reset();
      setStatus({ error: false, message: `Your inquiry was saved. Reference: ${data.id}` });
    } catch {
      setStatus({ error: true, message: "We couldn’t confirm receipt. Your message is still in the form." });
    } finally {
      setBusy(false);
    }
  }

  return <form className="panel contact-form" method="post" action="/api/contact" onSubmit={submit} aria-describedby="inquiry-note">
    <div className="panel-bar"><Icon name="send" size={18} /><h2>Project inquiry</h2></div>
    <div className="panel-body">
      <p className="form-note" id="inquiry-note">Required fields are marked with an asterisk. The inquiry is stored in the site’s inbox for review. Leave out sensitive information.</p>
      <div className="form-fields">
        <label>Name *<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
        <label>Work email *<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="span-two">Company<input name="company" autoComplete="organization" maxLength={120} /></label>
        <label className="span-two">What would you like to improve? *<textarea name="message" required minLength={10} maxLength={1200} rows={5} placeholder="Tell us what happens today and what you want to change." /></label>
      </div>
      <div hidden><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Submit inquiry"}<Icon name="arrow" size={17} /></button>
      <p role="status" className={status?.error ? "form-status form-error" : "form-status"}>{status?.message}</p>
    </div>
  </form>;
}
