"use client";

import { useEffect, useRef, useState } from "react";
import { MotionLink } from "./route-transition";
import { Icon } from "./icon";

const chapters = [
  {
    title: "Read the system.",
    stage: "Analyze",
    description: "Start with the actual work. Map the decisions, data, and handoffs, then establish a baseline for the problem worth solving.",
    href: "/services#diagnostics",
    link: "Revenue diagnostics",
  },
  {
    title: "Build the intervention.",
    stage: "Automate",
    description: "Prototype one useful change. Connect the tools, put human review where it matters, and test the system against representative work.",
    href: "/services#automation",
    link: "Workflow automation",
  },
  {
    title: "Make it operable.",
    stage: "Scale",
    description: "Give the team clear ownership, an escalation path, and a way to tell when the system needs attention.",
    href: "/services#managed-services",
    link: "Managed services",
  },
];

export function StudioSequence() {
  const steps = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = steps.current;
    if (!list || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver((entries) => {
      const chapter = entries.find((entry) => entry.isIntersecting);
      if (chapter) setActive(Number((chapter.target as HTMLElement).dataset.chapter));
    }, { rootMargin: "-38% 0px -47% 0px" });
    function syncPreference() {
      observer.disconnect();
      if (!motion.matches) list?.querySelectorAll("[data-chapter]").forEach((chapter) => observer.observe(chapter));
    }
    syncPreference();
    motion.addEventListener("change", syncPreference);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncPreference);
    };
  }, []);

  return <section className="sequence wrap" aria-labelledby="sequence-title">
    <header className="chapter-heading">
      <p className="mono index-label">02 / Studio method</p>
      <h2 id="sequence-title">From a problem<br />to a system.</h2>
    </header>
    <div className="sequence-layout">
      <figure className="sequence-figure" data-active={active} aria-hidden="true">
        <div className="sequence-frame">
          <span className="mono">SYSTEM MAP / FIG. 02</span><span className="mono">0{active + 1} — 03</span>
        </div>
        <svg viewBox="0 0 560 335" fill="none">
          <path className="sequence-grid" d="M60 56h440M60 111h440M60 167h440M60 223h440M60 279h440M112 34v266M280 34v266M448 34v266" />
          <path className="sequence-flow" d="M112 167h336M112 167l168-69 168 69-168 69-168-69ZM280 98v138" />
          {[112, 280, 448].map((x, index) => <g className={active === index ? "sequence-node is-active" : "sequence-node"} key={x}>
            <circle cx={x} cy="167" r="46" className="node-orbit" />
            <path d={`M${x} 139l28 28-28 28-28-28Z`} className="node-diamond" />
            <circle cx={x} cy="167" r="4" className="node-core" />
            <text x={x} y="257" textAnchor="middle">{chapters[index].stage.toUpperCase()}</text>
          </g>)}
        </svg>
        <figcaption className="mono">{chapters[active].stage} / workflow stage</figcaption>
      </figure>
      <div className="sequence-steps" ref={steps}>
        {chapters.map(({ stage, title, description, href, link }, index) => <article key={stage} data-chapter={index}>
          <p className="mono index-label">0{index + 1} / {stage}</p>
          <h3>{title}</h3>
          <p>{description}</p>
          <MotionLink href={href} className="text-link">{link}<Icon name="diagonal" size={16} /></MotionLink>
        </article>)}
      </div>
    </div>
  </section>;
}
