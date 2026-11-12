"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Icon } from "./icon";

const suggestions = [
  "What does HEURIAL do?",
  "What does it cost?",
  "Is my data safe?",
  "How do I start a project?",
];

type Answer = { mode: "keyword" | "model" | "no-match"; passages: { title: string; text: string; href: string }[] };

export function Assistant() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<Answer>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setAnswer(undefined);
    setAsked(question.trim());
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The assistant is unavailable. Please try again.");
      else setAnswer(data);
    } catch {
      setError("The assistant could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="assistant glass is-glow panel" aria-labelledby="assistant-title">
    <div className="panel-head"><span className="icon-tile"><Icon name="spark" size={20} /></span><h2 id="assistant-title">Knowledge assistant</h2><span className="chip">Public guides</span></div>
    <form method="post" action="/api/ask" onSubmit={submit}>
      <label htmlFor="question">What would you like to know about HEURIAL?</label>
      <div className="question-row"><input id="question" name="question" value={question} onChange={(event) => setQuestion(event.target.value)} required minLength={3} maxLength={400} placeholder="Ask about pricing, your data, or getting started" /><button type="submit" className="button primary" disabled={busy}>Ask <Icon name="send" size={16} /></button></div>
    </form>
    <div className="suggestions" aria-label="Suggested questions">{suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => {
      setQuestion(suggestion);
      document.getElementById("question")?.focus();
    }}>{suggestion}</button>)}</div>
    <p className="form-note">It only answers from the public guides on this page, and links to the passage it used.</p>
    <div className="answer" role="status" aria-live="polite">
      {busy && <p>Searching the guides…</p>}
      {error && <p className="form-error">{error}</p>}
      {answer && <>
        <p className="asked"><strong>{asked}</strong></p>
        {answer.passages.length ? answer.passages.map((passage, index) => <div className="passage" key={passage.href}>
          <p>{passage.text}</p><a href={passage.href} className="text-link"><Icon name="book" size={15} /> [{index + 1}] {passage.title}</a>
        </div>) : <p>I couldn’t find that in the guides. Try asking about pricing, your data, or getting started.</p>}
      </>}
    </div>
  </section>;
}
