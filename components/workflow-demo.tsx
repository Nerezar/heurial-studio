"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

// An example workflow, played step by step. All names and messages are made up.
const STAGES = [
  { key: "arrive", icon: "mail", label: "A lead writes in", note: "9:42 PM, after you’ve closed for the day." },
  { key: "draft", icon: "spark", label: "A reply is drafted", note: "Written from your own prices, hours, and service area." },
  { key: "approve", icon: "check", label: "You approve it", note: "One tap from your phone. Nothing sends without your OK." },
  { key: "log", icon: "table", label: "It’s logged", note: "A new row in the spreadsheet you already use." },
  { key: "follow", icon: "bell", label: "A follow-up is set", note: "If they go quiet, you get a reminder." },
] as const;

const STEP_MS = 4200;

function Stage({ stage }: { stage: (typeof STAGES)[number]["key"] }) {
  if (stage === "arrive") return (
    <div className="flow-window">
      <div className="flow-bar"><i /><i /><i /><span>Inbox</span></div>
      <div className="flow-body">
        <div className="flow-mail flow-in">
          <span className="flow-avatar">DW</span>
          <div>
            <p className="flow-from"><b>Dana Whitfield</b><small>Website form · 9:42 PM</small></p>
            <p>Hi, do you service tankless water heaters? Ours is leaking and I need someone this week.</p>
          </div>
        </div>
        <p className="flow-chip flow-in" style={{ animationDelay: ".5s" }}><Icon name="target" size={14} /> New lead · came from Instagram</p>
      </div>
    </div>
  );
  if (stage === "draft") return (
    <div className="flow-window">
      <div className="flow-bar"><i /><i /><i /><span>Draft reply</span></div>
      <div className="flow-body flow-draft">
        <p className="flow-in" style={{ animationDelay: ".15s" }}>Hi Dana, thanks for reaching out. Yes, we service tankless water heaters.</p>
        <p className="flow-in" style={{ animationDelay: ".9s" }}>We have openings Thursday morning or Friday afternoon. A diagnostic visit is $89, credited toward the repair.</p>
        <p className="flow-in" style={{ animationDelay: "1.65s" }}>Which works better for you?</p>
        <p className="flow-chip flow-in" style={{ animationDelay: "2.3s" }}><Icon name="book" size={14} /> Used: your price list and this week’s calendar</p>
      </div>
    </div>
  );
  if (stage === "approve") return (
    <div className="flow-window">
      <div className="flow-bar"><i /><i /><i /><span>Waiting for you</span></div>
      <div className="flow-body">
        <div className="flow-quote flow-in">
          <small>Reply to Dana Whitfield</small>
          <p>“Yes, we service tankless water heaters. We have openings Thursday morning or Friday afternoon…”</p>
        </div>
        <div className="flow-actions flow-in" style={{ animationDelay: ".4s" }}>
          <span className="flow-btn">Edit</span>
          <span className="flow-btn is-primary"><Icon name="check" size={15} /> Approve and send</span>
        </div>
        <p className="flow-chip is-good flow-in" style={{ animationDelay: "2s" }}><Icon name="check" size={14} /> Sent at 9:47 PM</p>
      </div>
    </div>
  );
  if (stage === "log") return (
    <div className="flow-window">
      <div className="flow-bar"><i /><i /><i /><span>Leads spreadsheet</span></div>
      <div className="flow-body">
        <div className="flow-table" role="presentation">
          <div className="flow-row is-head"><span>Name</span><span>Need</span><span>Source</span><span>Status</span></div>
          <div className="flow-row"><span>M. Bell</span><span>Drain cleaning</span><span>Referral</span><span>Booked</span></div>
          <div className="flow-row"><span>T. Okafor</span><span>New faucet</span><span>Search</span><span>Quoted</span></div>
          <div className="flow-row is-new flow-in" style={{ animationDelay: ".5s" }}><span>D. Whitfield</span><span>Tankless leak</span><span>Instagram</span><span>Replied</span></div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="flow-window">
      <div className="flow-bar"><i /><i /><i /><span>Reminders</span></div>
      <div className="flow-body">
        <div className="flow-reminder flow-in">
          <span className="flow-bell"><Icon name="bell" size={20} /></span>
          <div>
            <p><b>Thursday, 9:00 AM</b></p>
            <p>Check in with Dana if she hasn’t replied.</p>
          </div>
        </div>
        <p className="flow-chip flow-in" style={{ animationDelay: ".6s" }}><Icon name="check" size={14} /> You did one thing: tap approve</p>
      </div>
    </div>
  );
}

export function WorkflowDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const playing = inView && !hovered && !stopped;

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % STAGES.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [active, playing]);

  return (
    <div
      className={`flow${playing ? " is-playing" : ""}`}
      ref={root}
      data-no-reveal
      style={{ "--flow-ms": `${STEP_MS}ms` } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ol className="flow-steps">
        {STAGES.map(({ key, icon, label, note }, index) => (
          <li key={key} className={index === active ? "is-active" : index < active ? "is-done" : undefined}>
            <button type="button" aria-label={label} aria-current={index === active ? "step" : undefined} onClick={() => { setActive(index); setStopped(true); }}>
              <span className="flow-step-icon"><Icon name={index < active ? "check" : icon} size={17} /></span>
              <span className="flow-step-text"><b>{label}</b><small>{note}</small></span>
              <span className="flow-progress" aria-hidden="true"><i key={`${active}-${playing}`} /></span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flow-stage">
        <p className="flow-now"><b>{STAGES[active].label}.</b> {STAGES[active].note}</p>
        <div className="flow-stage-inner" key={active} aria-hidden="true"><Stage stage={STAGES[active].key} /></div>
        <div className="flow-foot">
          <p>Example with made-up data.</p>
          <button type="button" className="flow-toggle" onClick={() => setStopped((s) => !s)} aria-pressed={stopped}>
            <Icon name={stopped ? "play" : "pause"} size={14} /> {stopped ? "Play" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}
