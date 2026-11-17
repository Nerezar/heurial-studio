"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "./icon";

// Sample screens. Clicking a name in the dark panel swaps what the front sheet shows.
const views = [
  { name: "Overview", icon: "grid", title: "Lead follow-up", steps: [["mail", "New inquiry"], ["spark", "Draft reply"], ["calendar", "Booked"]] },
  { name: "Inquiries", icon: "mail", title: "New inquiries", steps: [["form", "Form sent"], ["table", "Logged"], ["bell", "You’re told"]] },
  { name: "Follow-ups", icon: "repeat", title: "Follow-ups", steps: [["clock", "2 days quiet"], ["spark", "Nudge drafted"], ["check", "You approve"]] },
  { name: "Bookings", icon: "calendar", title: "Bookings", steps: [["chat", "They reply"], ["calendar", "Time picked"], ["check", "On calendar"]] },
];

/** One sheet of glass: a rim that gives it thickness, then the face. */
function Sheet({ kind, children }: { kind: string; children?: ReactNode }) {
  return <>
    <span className={`stage-edge is-${kind}`}><i /></span>
    <div className={`stage-sheet is-${kind}`}>{children}</div>
  </>;
}

/** Hero illustration: sample workflows on tilted glass panels, drawn in CSS. The panels drift, and lean toward the pointer. */
export function GlassStage() {
  const scene = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(0);
  const { title, steps } = views[view];

  useEffect(() => {
    const element = scene.current;
    if (!element || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clamp = (value: number) => String(Math.max(-1, Math.min(1, value)));
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--px", clamp((event.clientX - box.left - box.width / 2) / box.width));
      element.style.setProperty("--py", clamp((event.clientY - box.top - box.height / 2) / box.height));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return <div className="stage" role="img" aria-label="Illustration: a sample lead follow-up workflow on layered glass panels">
    <div className="stage-scene" ref={scene} aria-hidden="true">
      <span className="stage-floor" />
      <Sheet kind="slab" />
      <Sheet kind="back" />
      <Sheet kind="main">
        <p className="stage-title">{title} <span>Sample</span></p>
        <ol className="stage-flow" key={view}>
          {steps.map(([icon, label], index) => <li key={label} style={{ "--i": index } as CSSProperties}><Icon name={icon} />{label}</li>)}
        </ol>
        <div className="stage-lines"><i /><i /><i /><i /></div>
      </Sheet>
      <Sheet kind="side">
        <Image className="stage-mark" src="/brand/mark.svg" alt="" width={816} height={728} />
        <ul className="stage-nav">
          {views.map(({ name, icon }, index) => <li key={name} className={index === view ? "is-on" : undefined} onClick={() => setView(index)}><Icon name={icon} />{name}</li>)}
        </ul>
      </Sheet>
    </div>
  </div>;
}
