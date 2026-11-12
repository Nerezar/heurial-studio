"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

type Question = { id: string; title: string; body: string };

/** Expandable questions. A link to #id (from the page's index) opens that question. */
export function Faq({ questions }: { questions: Question[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = root.current?.querySelector<HTMLDetailsElement>(`details[id="${CSS.escape(id)}"]`);
      if (target) target.open = true;
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return <div className="faq" ref={root} data-no-reveal>
    {questions.map(({ id, title, body }, index) => (
      <details className="faq-item" id={id} key={id} open={index === 0}>
        <summary><span>{title}</span><Icon name="plus" size={20} /></summary>
        <p>{body}</p>
      </details>
    ))}
  </div>;
}
