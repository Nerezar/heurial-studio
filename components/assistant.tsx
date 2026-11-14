"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

const suggestions = [
  "What does HEURIAL do?",
  "What does it cost?",
  "Is my data safe?",
  "How do I start a project?",
];

type Passage = { title: string; text: string; href: string };
// A question, then what came back for it. Neither `passages` nor `error` yet means the answer is still on its way.
type Turn = { id: number; question: string; passages?: Passage[]; error?: string };

/** The knowledge assistant as a chat, laid out like its preview on the home page. */
export function Assistant() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const thread = useRef<HTMLDivElement>(null);

  // Keep the newest message in view, scrolling the thread only and never the page.
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [turns]);

  async function ask(text: string) {
    const asked = text.trim();
    if (busy || asked.length < 3) return;
    const id = turns.length; // turns are only ever added, and one at a time, so its place in the list names it
    setBusy(true);
    setQuestion("");
    setTurns((all) => [...all, { id, question: asked }]);
    let result: Pick<Turn, "passages" | "error">;
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked }),
      });
      const data = await response.json();
      result = response.ok ? { passages: data.passages ?? [] } : { error: data.error ?? "The assistant is unavailable. Please try again." };
    } catch {
      result = { error: "The assistant could not connect. Please try again." };
    }
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...result } : turn)));
    setBusy(false);
  }

  return <section className="assistant glass is-glow" aria-labelledby="assistant-title">
    <div className="chat-bar"><h2 id="assistant-title"><Icon name="chat" size={16} />Knowledge assistant</h2><span className="chip">Public guides</span></div>
    <div className="chat-thread" ref={thread} role="log" aria-live="polite" aria-label="Conversation">
      <p className="chat-a">Ask about pricing, your data, or how a project starts.</p>
      {turns.map((turn) => <Fragment key={turn.id}>
        <p className="chat-q">{turn.question}</p>
        {turn.error ? <p className="chat-a form-error">{turn.error}</p>
          : !turn.passages ? <span className="chat-dots" role="img" aria-label="Searching the guides"><i /><i /><i /></span>
          : !turn.passages.length ? <p className="chat-a">I couldn’t find that in the guides. Try asking about pricing, your data, or getting started.</p>
          : turn.passages.map((passage) => <div className="chat-turn" key={passage.href}>
            <p className="chat-a">{passage.text}</p>
            <a className="chip chat-source" href={passage.href}><Icon name="book" size={14} />{passage.title}</a>
          </div>)}
      </Fragment>)}
    </div>
    <div className="suggestions" aria-label="Suggested questions">{suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>
    <form className="chat-ask panel" method="post" action="/api/ask" onSubmit={(event) => {
      event.preventDefault();
      ask(question);
    }}>
      <label htmlFor="question" className="sr-only">Your question</label>
      <input id="question" name="question" value={question} onChange={(event) => setQuestion(event.target.value)} required minLength={3} maxLength={400} placeholder="Ask a question" autoComplete="off" />
      <button type="submit" className="button primary" disabled={busy}>Ask <Icon name="send" size={16} /></button>
    </form>
    <p className="form-note">It only answers from the public guides on this page, and links to the passage it used.</p>
  </section>;
}
