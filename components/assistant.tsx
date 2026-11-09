"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Icon } from "./icon";

const suggestions = [
  "What services does HEURIAL offer?",
  "How does revenue diagnostics work?",
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

  return <section className="assistant panel" aria-labelledby="assistant-title">
    <div className="panel-bar"><Icon name="spark" size={18} /><h2 id="assistant-title">Knowledge assistant</h2><span className="mono">PUBLIC DOCS</span></div>
    <div className="panel-body">
      <form method="post" action="/api/ask" onSubmit={submit}>
        <label htmlFor="question">What would you like to know about HEURIAL?</label>
        <div className="question-row"><input id="question" name="question" value={question} onChange={(event) => setQuestion(event.target.value)} required minLength={3} maxLength={400} placeholder="Ask about a service or the demo" /><button type="submit" className="button primary" disabled={busy}>Ask <Icon name="send" size={16} /></button></div>
      </form>
      <p className="form-note">Use public information only. Answers link to the passages they use.</p>
      <div className="suggestions" aria-label="Suggested questions">{suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => {
        setQuestion(suggestion);
        document.getElementById("question")?.focus();
      }}>{suggestion}</button>)}</div>
      <div className="answer" role="status" aria-live="polite">
        {busy && <p>Searching the HEURIAL documents…</p>}
        {error && <p className="form-error">{error}</p>}
        {answer && <>
          <p className="asked"><strong>{asked}</strong></p>
          {answer.passages.length ? answer.passages.map((passage, index) => <div className="passage" key={passage.href}>
            <p>{passage.text}</p><a href={passage.href} className="text-link"><Icon name="book" size={15} /> [{index + 1}] {passage.title}</a>
          </div>) : <p>I couldn’t find an answer in the HEURIAL documents. Try asking about services, the demo, or starting a project.</p>}
        </>}
      </div>
    </div>
  </section>;
}
