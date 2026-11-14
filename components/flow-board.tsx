"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

/*
 * Homepage hero visual: the business in one picture. Three kinds of repetitive work come in on the left, pass through
 * the workflow in the middle, and land in the tools on the right. Replies wait for a tap; everything else just moves.
 * Visitors can send a task in themselves. All names and messages are made up.
 *
 * The cards are ordinary HTML, so the layout is plain CSS. The connecting lines are measured from where the cards
 * actually sit, and the moving dots are short dashes slid along copies of those lines.
 */

type ToolKey = "email" | "sheet" | "calendar" | "crm";

const TOOLS: { key: ToolKey; icon: string; name: string; idle: string }[] = [
  { key: "email", icon: "mail", name: "Email", idle: "Replies" },
  { key: "sheet", icon: "table", name: "Spreadsheet", idle: "Lead list" },
  { key: "calendar", icon: "calendar", name: "Calendar", idle: "Follow-ups" },
  { key: "crm", icon: "users", name: "CRM", idle: "Contacts" },
];

/** One made-up task. `ready` and `sent` are set when the task ends in a reply that needs approval. */
type Task = { ticket: string; verb: string; ready?: string; sent?: string; out: Partial<Record<ToolKey, string>> };

const JOBS: { icon: string; label: string; from: string; tasks: Task[] }[] = [
  {
    icon: "form", label: "New inquiry", from: "Website form", tasks: [
      { ticket: "Dana W. · leaking heater", verb: "Drafting a reply", ready: "Reply to Dana ready", sent: "Sent to Dana", out: { sheet: "Dana W. logged", calendar: "Check in Thu 9:00" } },
      { ticket: "Marcus B. · drain quote", verb: "Drafting a reply", ready: "Reply to Marcus ready", sent: "Sent to Marcus", out: { sheet: "Marcus B. logged", calendar: "Check in Mon 9:00" } },
    ],
  },
  {
    icon: "chat", label: "Common question", from: "Email", tasks: [
      { ticket: "“Do you work Saturdays?”", verb: "Finding the answer", ready: "Answer ready", sent: "Answer sent", out: { crm: "Noted on contact" } },
      { ticket: "“What does a visit cost?”", verb: "Finding the answer", ready: "Answer ready", sent: "Answer sent", out: { crm: "Noted on contact" } },
    ],
  },
  {
    icon: "book", label: "Meeting notes", from: "After a call", tasks: [
      { ticket: "Site visit · 12 min", verb: "Sorting the notes", out: { sheet: "3 to-dos added", calendar: "2 dates set", crm: "Notes filed" } },
      { ticket: "Supplier call · 8 min", verb: "Sorting the notes", out: { sheet: "2 to-dos added", calendar: "1 date set", crm: "Notes filed" } },
    ],
  },
];

const reaches = (task: Task, key: ToolKey) => (key === "email" ? Boolean(task.ready) : Boolean(task.out[key]));

const IN_MS = 720;
const THINK_MS = 900;
const OUT_MS = 620;
const AUTO_TAP_MS = 3800;
const EVERY_MS = 3600;

type Pending = { id: number; ready: string; sent: string };
type Wires = { ins: string[]; outs: string[] };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const round = (n: number) => Math.round(n * 10) / 10;

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mid = round((x1 + x2) / 2);
  return `M${round(x1)} ${round(y1)}C${mid} ${round(y1)} ${mid} ${round(y2)} ${round(x2)} ${round(y2)}`;
}

/** Slides a bright dot with a short tail along a line, then removes it. Resolves when the dot arrives. */
function shoot(path: SVGPathElement | null, layer: SVGGElement | null, ms: number) {
  if (!path || !layer || typeof path.animate !== "function" || reducedMotion()) return Promise.resolve();
  const length = path.getTotalLength();
  if (!length) return Promise.resolve();
  const slide = (className: string, dash: number) => {
    const copy = path.cloneNode(false) as SVGPathElement;
    copy.setAttribute("class", className);
    copy.style.strokeDasharray = `${dash} ${length + 80}`;
    layer.appendChild(copy);
    const animation = copy.animate([
      { strokeDashoffset: dash, opacity: 0 },
      { opacity: 1, offset: .14 },
      { opacity: 1, offset: .82 },
      { strokeDashoffset: dash - length, opacity: 0 },
    ], { duration: ms, easing: "cubic-bezier(.5, 0, .3, 1)", fill: "both" });
    return animation.finished.catch(() => undefined).then(() => copy.remove());
  };
  slide("board-trail", Math.min(56, length * .35));
  return slide("board-head", .1);
}

export function FlowBoard() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const pulses = useRef<SVGGElement>(null);
  const sourceEls = useRef<(HTMLElement | null)[]>([]);
  const toolEls = useRef<(HTMLElement | null)[]>([]);
  const inPaths = useRef<(SVGPathElement | null)[]>([]);
  const outPaths = useRef<(SVGPathElement | null)[]>([]);

  const alive = useRef(true);
  const timers = useRef(new Set<number>());
  const turn = useRef(JOBS.map(() => 0));
  const nextJob = useRef(0);
  const flying = useRef(0);
  const holdUntil = useRef(0);
  const sequence = useRef(0);
  const waiting = useRef<Pending[]>([]);

  const [wires, setWires] = useState<Wires>({ ins: [], outs: [] });
  const [firing, setFiring] = useState<string[]>(JOBS.map(() => ""));
  const [busy, setBusy] = useState(0);
  const [verb, setVerb] = useState("");
  const [tools, setTools] = useState(() => Object.fromEntries(TOOLS.map((t) => [t.key, { text: "", hits: 0 }])) as Record<ToolKey, { text: string; hits: number }>);
  const [pending, setPending] = useState<Pending[]>([]);
  const [tapping, setTapping] = useState(false);
  const [tally, setTally] = useState({ handled: 0, taps: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [say, setSay] = useState("");

  const later = useCallback((ms: number) => new Promise<void>((resolve) => {
    if (ms <= 0) return resolve();
    const id = window.setTimeout(() => { timers.current.delete(id); resolve(); }, ms);
    timers.current.add(id);
  }), []);

  useEffect(() => {
    alive.current = true;
    const pendingTimers = timers.current;
    return () => { alive.current = false; pendingTimers.forEach((id) => window.clearTimeout(id)); };
  }, []);

  // Draw the lines between wherever the cards are right now.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const hub = core.current;
      if (!hub) return;
      const box = el.getBoundingClientRect();
      const c = hub.getBoundingClientRect();
      const radius = c.width / 2;
      const cx = c.left + radius - box.left;
      const cy = c.top + c.height / 2 - box.top;
      // Lines meet the circle a few pixels apart, so they read as separate lines.
      const edge = (dy: number) => Math.sqrt(Math.max(0, radius * radius - dy * dy));
      const ins = sourceEls.current.map((node, i) => {
        if (!node) return "";
        const r = node.getBoundingClientRect();
        const dy = (i - (JOBS.length - 1) / 2) * 9;
        return curve(r.right - box.left, r.top + r.height / 2 - box.top, cx - edge(dy), cy + dy);
      });
      const outs = toolEls.current.map((node, i) => {
        if (!node) return "";
        const r = node.getBoundingClientRect();
        const dy = (i - (TOOLS.length - 1) / 2) * 8;
        return curve(cx + edge(dy), cy + dy, r.left - box.left, r.top + r.height / 2 - box.top);
      });
      setWires((old) => (old.ins.join() === ins.join() && old.outs.join() === outs.join() ? old : { ins, outs }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const land = useCallback((key: ToolKey, text: string) => {
    setTools((old) => ({ ...old, [key]: { text, hits: old[key].hits + 1 } }));
  }, []);

  const approve = useCallback((id: number | null, byVisitor: boolean) => {
    const item = id === null ? waiting.current[0] : waiting.current.find((p) => p.id === id);
    if (!item) return;
    waiting.current = waiting.current.filter((p) => p !== item);
    setPending(waiting.current);
    land("email", item.sent);
    setTally((t) => ({ handled: t.handled + 1, taps: t.taps + 1 }));
    if (byVisitor) setSay(`${item.sent}.`);
  }, [land]);

  const send = useCallback(async (jobIndex: number, byVisitor: boolean) => {
    const job = JOBS[jobIndex];
    const task = job.tasks[turn.current[jobIndex]++ % job.tasks.length];
    const quick = reducedMotion();
    flying.current++;
    try {
      setFiring((f) => f.map((text, i) => (i === jobIndex ? task.ticket : text)));
      await shoot(inPaths.current[jobIndex], pulses.current, IN_MS);
      if (!alive.current) return;

      setVerb(task.verb);
      setBusy((n) => n + 1);
      await later(quick ? 0 : THINK_MS);
      if (!alive.current) return;
      setBusy((n) => n - 1);

      const targets = TOOLS.map((tool, i) => ({ tool, i })).filter(({ tool }) => reaches(task, tool.key));
      await Promise.all(targets.map(async ({ tool, i }, order) => {
        await later(quick ? 0 : order * 110);
        await shoot(outPaths.current[i], pulses.current, OUT_MS);
        if (!alive.current) return;
        if (tool.key !== "email") return land(tool.key, task.out[tool.key]!);
        // A reply never sends itself. It waits for a tap; if the visitor is only watching, the demo taps for them.
        const item = { id: ++sequence.current, ready: task.ready!, sent: task.sent! };
        waiting.current = [...waiting.current, item];
        setPending(waiting.current);
        land("email", item.ready);
        if (byVisitor) setSay(`${item.ready}. It waits for your approval.`);
        if (quick) return;
        later(AUTO_TAP_MS).then(async () => {
          if (!alive.current || !waiting.current.includes(item)) return;
          setTapping(true);
          await later(420);
          if (!alive.current) return;
          setTapping(false);
          approve(item.id, false);
        });
      }));
      if (!alive.current) return;

      setFiring((f) => f.map((text, i) => (i === jobIndex ? "" : text)));
      if (!task.ready) {
        setTally((t) => ({ ...t, handled: t.handled + 1 }));
        if (byVisitor) setSay(`${job.label}: ${Object.values(task.out).join(", ")}.`);
      }
    } finally {
      flying.current--;
    }
  }, [approve, land, later]);

  // Tasks arrive on their own while the board is on screen, and step aside for a moment after the visitor sends one.
  useEffect(() => {
    if (!inView || paused || reducedMotion()) return;
    let timer = 0;
    const tick = () => {
      if (!document.hidden && Date.now() >= holdUntil.current && flying.current < 2) void send(nextJob.current++ % JOBS.length, false);
      timer = window.setTimeout(tick, EVERY_MS);
    };
    timer = window.setTimeout(tick, 800);
    return () => window.clearTimeout(timer);
  }, [inView, paused, send]);

  const lit = hover === null ? null : JOBS[hover].tasks[0];
  const first = pending[0];
  const emailText = pending.length > 1 ? `${pending.length} replies ready` : first ? first.ready : tools.email.text;

  return (
    <div className="board" ref={root} role="group" aria-label="Interactive example: send a task through a workflow">
      <div className="board-top">
        <p><Icon name="workflow" size={15} />Tap a task to send it through.</p>
        <button type="button" className="board-toggle" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          <Icon name={paused ? "play" : "pause"} size={14} /> {paused ? "Play" : "Pause"}
        </button>
      </div>

      <div className="board-stage" ref={stage}>
        <svg className="board-wires" aria-hidden="true">
          {wires.ins.map((d, i) => <path key={`in-${i}`} ref={(el) => { inPaths.current[i] = el; }} d={d} className={hover === i || firing[i] ? "is-lit" : undefined} />)}
          {wires.outs.map((d, i) => <path key={`out-${i}`} ref={(el) => { outPaths.current[i] = el; }} d={d} className={lit && reaches(lit, TOOLS[i].key) ? "is-lit" : undefined} />)}
          <g ref={pulses} />
        </svg>

        <ul className="board-sources">
          {JOBS.map(({ icon, label, from }, i) => (
            <li key={label}>
              <button
                type="button"
                className={`board-node${firing[i] ? " is-firing" : ""}`}
                ref={(el) => { sourceEls.current[i] = el; }}
                onClick={() => { holdUntil.current = Date.now() + 5200; void send(i, true); }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <span className="board-icon"><Icon name={icon} size={17} /></span>
                <span className="board-text"><b>{label}</b><small key={firing[i] || from} className={firing[i] ? "is-new" : undefined}>{firing[i] || from}</small></span>
              </button>
            </li>
          ))}
        </ul>

        <div className={`board-hub${busy ? " is-busy" : ""}`}>
          <div className="board-core" ref={core}>
            <svg className="board-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" /></svg>
            <Image src="/brand/emblem.svg" alt="" width={407} height={269} />
          </div>
          <p className={`board-verb${busy ? " is-new" : ""}`} key={busy ? verb : "idle"}>{busy ? verb : "My workflow"}</p>
        </div>

        <ul className="board-tools">
          {TOOLS.map(({ key, icon, name, idle }, i) => {
            const { text, hits } = tools[key];
            const isEmail = key === "email";
            const shown = isEmail ? emailText : text;
            const state = isEmail && first ? " is-waiting" : isEmail && text ? " is-sent" : "";
            return (
              <li key={key} className={`board-node${state}${lit && reaches(lit, key) ? " is-lit" : ""}`} ref={(el) => { toolEls.current[i] = el; }}>
                {hits > 0 && <i className="board-flash" key={hits} />}
                <span className="board-text">
                  <b><Icon name={icon} size={15} />{name}</b>
                  <small key={shown || idle} className={hits ? "is-new" : undefined}>{shown || idle}</small>
                </span>
                {isEmail && (first
                  ? <button type="button" className={`board-approve${tapping ? " is-tapped" : ""}`} onClick={() => approve(null, true)}><Icon name="check" size={15} /> Approve</button>
                  : <span className="board-gate">Replies wait for your OK</span>)}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="board-foot">
        <dl className="board-tally">
          <div><dt>Handled</dt><dd>{tally.handled}</dd></div>
          <div><dt>Taps from you</dt><dd>{tally.taps}</dd></div>
          <div><dt>Typed by you</dt><dd>0</dd></div>
        </dl>
        <p>Example with made-up data.</p>
      </div>
      <p className="sr-only" aria-live="polite">{say}</p>
    </div>
  );
}
