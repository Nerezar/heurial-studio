/* HEURIAL Autopilot: the demo page. A made-up plumbing business with its automations, approvals, activity,
   connections and plan. The rules are the real ones (core.js); the events and AI drafts are sample data, and
   nothing is sent or saved. */
(function () {
  const core = window.AutopilotCore;
  const HOUR = 3600e3;
  const VIEWS = [["today", "Today"], ["automations", "Automations"], ["approvals", "Approvals"], ["activity", "Activity"], ["connections", "Connections"], ["plan", "Plan"]];
  const CHANNEL = { text: "Text", email: "Email", tracker: "Tracker", owner: "To you", web: "Website" };
  const STATUS = {
    sent: ["Sent", "up"], queued: ["Queued", "warn"], approval: ["Waiting for you", "accent"], logged: ["Logged", "up"],
    skipped: ["Skipped", "muted"], waiting: ["Paused", "down"], discarded: ["Discarded", "muted"], optout: ["Opted out", "muted"],
  };
  // What a few sample events look like. Each one fires a real trigger through core.plan.
  const EVENTS = [
    { trigger: "missed_call", label: "Missed call", note: "Someone calls while you're under a sink." },
    { trigger: "web_inquiry", label: "Website inquiry", note: "A form comes in at 11 PM." },
    { trigger: "proposal_quiet", label: "Quote gone quiet", note: "No reply to a quote for 2 days." },
    { trigger: "job_paid", label: "Job paid", note: "A customer pays their invoice." },
    { trigger: "invoice_overdue", label: "Invoice overdue", note: "An invoice is 3 days late." },
    { trigger: "review_posted", label: "New 5-star review", note: "A happy customer leaves a review." },
    { trigger: "stop", label: "Customer texts STOP", note: "Someone asks not to be texted." },
  ];
  // Sample AI drafts, standing in for what the model writes. Real drafts are written per customer.
  const DRAFTS = {
    "quote-followup": "Hi {first_name}, just checking the quote for {topic} reached you. Happy to walk through it or adjust the scope if anything doesn't fit. I can hold the Thursday slot until Friday.",
    "revive": "Hi {first_name}, it's been a while since we talked about {topic}. Is it still on your list? If the timing's better now, I have openings next week.",
    "call-recap": "Thanks for the call, {first_name}. To recap: {topic}, and I'll send the written quote by tomorrow. Anything I missed, just reply here.",
    "review-reply": "Thank you, {first_name}! Glad the {topic} went smoothly. We appreciate you trusting us with it.",
    "receipts": "Filed a $48.20 receipt from a supply store under Materials.",
    "monthly-report": "October: 41 calls, 18 new leads, 11 jobs won ($9,860). Reply time improved to 6 minutes. Fix next: 4 quotes still waiting on follow-up.",
    "seasonal": "Hi {first_name}, winter's coming. A quick check of your water heater and outdoor taps now saves a frozen-pipe call later. Book a slot: {booking_link}",
    "site-assistant": "Answered “Do you do weekend calls?” from the FAQ and offered a booking link.",
    "social-drafts": "Another one done: {topic} for a happy customer this week. Need a hand with yours? Link in bio.",
    "gbp-posts": "This week we fixed 9 leaks and replaced 2 water heaters across the north side. Same-day slots most weekdays.",
  };
  const DONE = {
    "email-lead": "Added {name} as a new lead with the email thread.",
    "lead-source": "Tagged {name}'s lead with its source: Google search.",
    "hot-alert": "New lead: {first_name} wants {topic}. Reply soon.",
    "stale-cleanup": "Closed 3 leads with no activity in 120 days.",
    "daily-brief": "Sent your morning briefing: 2 new leads, 3 follow-ups due, 4 appointments.",
    "weekly-numbers": "Sent your weekly numbers.",
    "expense-summary": "Sent last month's expense summary.",
    "booking-link": "Added your booking link to the first reply.",
    "confirm": "Asked {first_name} to reply C to confirm or R to reschedule.",
  };
  const CONTACTS = [
    { name: "Dana Price", first_name: "Dana", topic: "a new water heater", amount: "$1,240", invoice: "#1042" },
    { name: "Marcus Lee", first_name: "Marcus", topic: "a leaking kitchen pipe", amount: "$310", invoice: "#1043" },
    { name: "Priya Shah", first_name: "Priya", topic: "a bathroom remodel quote", amount: "$2,450", invoice: "#1044" },
    { name: "Tom Becker", first_name: "Tom", topic: "a blocked drain", amount: "$185", invoice: "#1045" },
    { name: "Elena Ruiz", first_name: "Elena", topic: "replacing two outdoor taps", amount: "$420", invoice: "#1046" },
  ];

  const app = document.getElementById("app");
  let state;
  let view = "today";
  let category = "All";
  let editing = null; // automation id in the settings dialog
  let nextContact = 0;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const byId = (id) => core.CATALOG.find((a) => a.id === id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plan = () => core.PLANS.find((p) => p.id === state.plan);
  const clock = (t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  function when(t) {
    const d = new Date(t), today = new Date();
    const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 864e5);
    return days === 0 ? clock(t) : days === 1 ? `Yesterday ${clock(t)}` : days < 0 ? `Tomorrow ${clock(t)}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${clock(t)}`;
  }
  const vars = (contact) => ({ ...contact, business: state.business.name, booking_link: state.business.booking_link, review_link: state.business.review_link, pay_link: state.business.pay_link, when: "tomorrow at 9:00 AM" });
  const fill = (template, contact) => core.render(template, vars(contact)).text;
  const isOn = (a) => core.unlocked(a, state.plan) && !!state.enabled[a.id];
  function toast(msg) {
    const el = app.querySelector(".toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 3600);
  }
  const chip = (status, extra = "") => { const [label, tone] = STATUS[status]; return `<span class="status ${tone}">${label}${extra ? ` · ${esc(extra)}` : ""}</span>`; };

  /* ---------- running an event ---------- */
  function messageFor(a, contact) {
    const template = state.settings[a.id]?.template ?? (a.ai ? DRAFTS[a.id] : a.template) ?? "";
    return fill(template || DONE[a.id] || `${a.name} ran.`, contact);
  }

  function run(trigger) {
    const contact = CONTACTS[nextContact++ % CONTACTS.length];
    const now = Date.now();
    if (trigger === "stop") {
      contact.optedOut = true;
      state.activity.unshift({ id: uid(), at: now, name: "Opt-out", contact: contact.name, channel: "text", text: `${contact.first_name} replied STOP. No automation will text them again.`, status: "optout" });
      render();
      toast(`${contact.first_name} is opted out. Texts to them are skipped from now on.`);
      return;
    }
    const steps = core.plan(trigger, { plan: state.plan, used: state.used, now, hours: state.hours, enabled: state.enabled, settings: state.settings, contact });
    for (const step of steps) {
      const a = step.automation;
      const text = step.status === "skipped" || step.status === "waiting" ? step.reason : messageFor(a, contact);
      if (a.ai && step.status !== "waiting") state.used++;
      if (step.status === "approval") state.approvals.unshift({ id: uid(), at: now, automation: a.id, contact: contact.name, text });
      state.activity.unshift({ id: uid(), at: now, name: a.name, contact: contact.name, channel: a.channel, text, status: step.status, sendAt: step.at });
    }
    render();
    const label = EVENTS.find((e) => e.trigger === trigger).label;
    const ran = steps.filter((s) => s.status !== "skipped" && s.status !== "waiting").length;
    const held = steps.length - ran;
    toast(!steps.length ? `${label}: nothing ran. No automation for this is switched on.`
      : `${label} (${contact.first_name}): ${ran} automation${ran === 1 ? "" : "s"} ran${held ? `, ${held} held back (see Activity)` : ""}.`);
  }

  /* ---------- drawing ---------- */
  function render() {
    const titles = { today: "Today", automations: "Automations", approvals: "Waiting for your approval", activity: "Activity", connections: "Connections", plan: "Plan" };
    const p = plan();
    const left = core.creditsLeft(state.plan, state.used);
    const on = core.CATALOG.filter(isOn).length;
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <div class="brand"><strong>Autopilot</strong><span>by HEURIAL</span></div>
        <nav aria-label="Sections">${VIEWS.map(([k, label]) => {
          const badge = k === "approvals" && state.approvals.length ? `<b aria-label="${state.approvals.length} waiting">${state.approvals.length}</b>` : k === "automations" ? `<small>${on}</small>` : "";
          return `<button class="nav${view === k ? " on" : ""}" data-view="${k}"${view === k ? ' aria-current="page"' : ""}>${label}${badge}</button>`;
        }).join("")}</nav>
        <div class="side-foot">
          <p><strong>Sample business.</strong> Nothing is sent or saved. Refresh to start over.</p>
          <div class="meter" role="group" aria-label="AI drafts this month">
            <p><span>${esc(p.name)} plan</span><span class="n">${left} of ${p.credits} AI drafts left</span></p>
            <i style="--w:${Math.round((left / p.credits) * 100)}%"></i>
          </div>
        </div>
      </aside>
      <main class="main" tabindex="-1">
        <header class="top"><h1>${titles[view]}</h1><span class="biz">${esc(state.business.name)}</span></header>
        ${{ today, automations, approvals, activity, connections, plans }[view === "plan" ? "plans" : view]()}
      </main>
    </div>
    ${editing ? dialog() : ""}
    <div class="toast" role="status" aria-live="polite"></div>`;
    const dlg = app.querySelector("dialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  const tile = (label, value, note = "", cls = "") => `<div class="tile"><p class="tile-label">${label}</p><p class="tile-value n">${value}</p>${note ? `<p class="tile-note ${cls}">${note}</p>` : ""}</div>`;

  function activityRows(list) {
    if (!list.length) return `<p class="empty">Nothing yet. Try an event above.</p>`;
    return `<ul class="feed">${list.map((x) => `<li>
      <span class="feed-time n">${when(x.at)}</span>
      <div><p><strong>${esc(x.name)}</strong> <span class="muted">· ${esc(x.contact)} · ${CHANNEL[x.channel] || ""}</span></p><p class="feed-text">${esc(x.text)}</p></div>
      ${chip(x.status, x.status === "queued" ? `sends ${when(x.sendAt)}` : "")}
    </li>`).join("")}</ul>`;
  }

  function today() {
    const unlockedCount = core.CATALOG.filter((a) => core.unlocked(a, state.plan)).length;
    const weekAgo = Date.now() - 7 * 24 * HOUR;
    const done = state.activity.filter((x) => x.at > weekAgo && ["sent", "logged", "queued"].includes(x.status)).length;
    const left = core.creditsLeft(state.plan, state.used);
    return `<section class="tiles">
        ${tile("Automations on", core.CATALOG.filter(isOn).length, `of ${unlockedCount} on your plan`)}
        ${tile("Done for you this week", done, "Texts, emails and updates")}
        ${tile("Waiting for you", state.approvals.length, state.approvals.length ? "AI drafts to approve" : "All clear", state.approvals.length ? "warn" : "up")}
        ${tile("AI drafts left", left, `of ${plan().credits} this month`)}
      </section>
      <section class="card" aria-labelledby="h-try">
        <h2 id="h-try">Try it</h2>
        <p class="hint">Pick something that happens in a working day and watch what Autopilot does. Results show up in Activity and Approvals. Nothing is really sent.</p>
        <div class="events">${EVENTS.map((e) => `<button class="event" data-run="${e.trigger}"><strong>${e.label}</strong><span>${e.note}</span></button>`).join("")}</div>
      </section>
      <div class="grid">
        <section class="card" aria-labelledby="h-wait">
          <h2 id="h-wait">Waiting for you</h2>
          ${state.approvals.length ? `<ul class="mini">${state.approvals.slice(0, 3).map((x) => `<li><span><strong>${esc(byId(x.automation).name)}</strong><br><span class="muted">${esc(x.contact)}</span></span><button class="btn small" data-view="approvals">Review</button></li>`).join("")}</ul>` : `<p class="empty">Nothing to approve.</p>`}
        </section>
        <section class="card" aria-labelledby="h-act">
          <h2 id="h-act">Latest activity</h2>
          ${activityRows(state.activity.slice(0, 4))}
          <button class="link" data-view="activity">All activity</button>
        </section>
      </div>`;
  }

  function automations() {
    const cats = ["All", ...core.CATEGORIES];
    const list = core.CATALOG.filter((a) => category === "All" || a.category === category);
    return `<div class="filters" role="group" aria-label="Category">${cats.map((c) => `<button class="pill${category === c ? " on" : ""}" data-cat="${esc(c)}" aria-pressed="${category === c}">${esc(c)}</button>`).join("")}</div>
      <div class="auto-grid">${list.map((a) => {
        const open = core.unlocked(a, state.plan);
        const on = isOn(a);
        return `<article class="auto${open ? "" : " locked"}${on ? " is-on" : ""}">
          <header>
            <h3>${esc(a.name)}</h3>
            ${open ? `<button class="switch" role="switch" aria-checked="${on}" aria-label="${esc(a.name)}" data-toggle="${a.id}"><i></i></button>` : `<span class="lock">${esc(core.unlockedBy(a).name)}</span>`}
          </header>
          <p>${esc(a.description)}</p>
          <footer>
            <span class="tag">${esc(CHANNEL[a.channel])}</span>${a.ai ? `<span class="tag ai">AI · you approve</span>` : ""}
            ${open ? ((a.template || a.ai) ? `<button class="link" data-edit="${a.id}">Settings</button>` : "") : `<button class="link" data-view="plan">Unlock with ${esc(core.unlockedBy(a).name)}</button>`}
          </footer>
        </article>`;
      }).join("")}</div>`;
  }

  function approvals() {
    if (!state.approvals.length) return `<section class="card"><p class="empty">Nothing waiting. AI-written messages land here before they go out, so nothing reaches a customer without your OK.</p></section>`;
    return `<p class="hint lead">Edit anything you like, then approve. Each draft used one AI credit when it was written.</p>
      <div class="approvals">${state.approvals.map((x) => {
        const a = byId(x.automation);
        return `<form class="card approval" data-form="approve" data-id="${x.id}">
          <header><p><strong>${esc(a.name)}</strong> <span class="muted">· to ${esc(x.contact)} by ${CHANNEL[a.channel].toLowerCase()}</span></p><span class="muted n">${when(x.at)}</span></header>
          <textarea name="text" rows="3" aria-label="Draft to ${esc(x.contact)}">${esc(x.text)}</textarea>
          <footer><button class="btn small ghost" type="button" data-discard="${x.id}">Discard</button><button class="btn small primary">Approve and send</button></footer>
        </form>`;
      }).join("")}</div>`;
  }

  function activity() {
    return `<p class="hint lead">Everything Autopilot did, newest first. Texts outside your business hours wait until you open.</p>
      <section class="card">${activityRows(state.activity)}</section>`;
  }

  function connections() {
    const c = state.connections;
    const row = (title, detail, status, action = "", locked = "") => `<li class="conn">
      <div><p><strong>${title}</strong></p><p class="muted">${detail}</p></div>
      ${locked ? `<span class="lock">${locked}</span>` : `<span class="status ${status[1]}">${status[0]}</span>`}
      ${action}</li>`;
    const proOk = core.unlocked({ plan: "pro" }, state.plan);
    const bizOk = core.unlocked({ plan: "business" }, state.plan);
    return `<section class="card">
        <h2>Phone and email</h2>
        <ul class="conns">
          ${row("Business number", "(555) 010-0199 · texts and missed calls", ["Connected", "up"], `<button class="btn small" data-demo="number">Change</button>`)}
          ${row("Texting registration", "US carriers require every business that texts customers to register. It usually takes a few days.", ["Approved", "up"])}
          ${row("Forwarding address", "northside@in.example.com · forward emails here and they become leads", ["Ready", "up"], `<button class="btn small" data-demo="copy">Copy</button>`)}
          ${row("Sending domain", "northsideplumbing.example · emails go out from your own address", ["Verified", "up"])}
        </ul>
      </section>
      <form class="card" data-form="business">
        <h2>Links and hours</h2>
        <p class="hint">Messages use these. Texts only go out between your opening and closing times.</p>
        <div class="fields">
          <label><span>Booking link</span><input name="booking_link" type="url" value="${esc(state.business.booking_link)}"></label>
          <label><span>Google review link</span><input name="review_link" type="url" value="${esc(state.business.review_link)}"></label>
          <label><span>Payment link</span><input name="pay_link" type="url" value="${esc(state.business.pay_link)}"></label>
          <label><span>Opens</span><input name="open" type="time" value="${esc(state.hours.open)}" required></label>
          <label><span>Closes</span><input name="close" type="time" value="${esc(state.hours.close)}" required></label>
        </div>
        <div class="row"><button class="btn small primary">Save</button></div>
      </form>
      <section class="card">
        <h2>Other tools</h2>
        <ul class="conns">
          ${row("Stripe or QuickBooks", "Invoices and payments, for invoice reminders and thank-yous", c.money ? ["Connected", "up"] : ["Not connected", "muted"], proOk && !c.money ? `<button class="btn small" data-connect="money">Connect</button>` : "", proOk ? "" : "Pro")}
          ${row("Google Business Profile", "Reviews, review replies and weekly posts", c.google ? ["Connected", "up"] : ["Not connected", "muted"], bizOk && !c.google ? `<button class="btn small" data-connect="google">Connect</button>` : "", bizOk ? "" : "Business")}
          ${row("Your website", "A chat assistant that answers from your FAQ and books calls", c.site ? ["Installed", "up"] : ["Not installed", "muted"], bizOk && !c.site ? `<button class="btn small" data-connect="site">Get the code</button>` : "", bizOk ? "" : "Business")}
        </ul>
      </section>`;
  }

  function plans() {
    let prev = [];
    const left = core.creditsLeft(state.plan, state.used);
    return `<p class="hint lead">${left} of ${plan().credits} AI drafts left this month on ${esc(plan().name)}. Switching plans in this demo is instant and free.</p>
      <div class="plans">${core.PLANS.map((p) => {
        const list = core.CATALOG.filter((a) => core.unlocked(a, p.id));
        const added = list.filter((a) => !prev.includes(a));
        const intro = prev.length ? `Everything in ${core.PLANS[core.PLANS.indexOf(p) - 1].name}, plus:` : "Includes:";
        prev = list;
        const current = p.id === state.plan;
        return `<section class="card plan${current ? " current" : ""}">
          <h2>${esc(p.name)}</h2>
          <p class="muted">${esc(p.note)}</p>
          <p class="plan-figs"><span><b class="n">${list.length}</b> automations</span><span><b class="n">${p.credits.toLocaleString("en-US")}</b> AI drafts a month</span></p>
          <p class="plan-intro">${intro}</p>
          <ul class="ticks">${added.map((a) => `<li>${esc(a.name)}</li>`).join("")}</ul>
          ${current ? `<p class="status up">Your plan</p>` : `<button class="btn ${core.PLANS.indexOf(p) > core.PLANS.findIndex((x) => x.id === state.plan) ? "primary" : ""}" data-plan="${p.id}">Switch to ${esc(p.name)}</button>`}
        </section>`;
      }).join("")}</div>`;
  }

  function dialog() {
    const a = byId(editing);
    const s = state.settings[a.id] || {};
    const template = s.template ?? (a.ai ? DRAFTS[a.id] : a.template) ?? "";
    const approve = s.approve ?? a.ai;
    const preview = core.render(template, vars(CONTACTS[0]));
    return `<dialog aria-labelledby="dlg-title">
      <form data-form="settings" method="dialog">
        <header><h2 id="dlg-title">${esc(a.name)}</h2><button class="x" type="button" data-act="close" aria-label="Close">×</button></header>
        <p class="muted">${esc(a.description)}</p>
        ${template ? `<label><span>${a.ai ? "Example of what the AI writes (it's rewritten for each customer)" : "Message"}</span><textarea name="template" rows="4"${a.ai ? " readonly" : ""}>${esc(template)}</textarea></label>
        <p class="hint">Placeholders: {first_name}, {business}, {booking_link}, {review_link}, {pay_link}, {topic}, {when}, {invoice}, {amount}.</p>
        <div class="preview"><p class="muted">Preview for ${esc(CONTACTS[0].name)}</p><p>${esc(preview.text)}</p>${preview.missing.length ? `<p class="down">Missing: ${preview.missing.map(esc).join(", ")}. Add it under Connections, or this message won't send.</p>` : ""}</div>` : ""}
        <label class="check"><input type="checkbox" name="approve"${approve ? " checked" : ""}> Ask me before it goes out</label>
        ${a.ai ? `<p class="hint">Recommended for anything AI writes. Each draft uses one AI credit.</p>` : ""}
        <footer><span></span><button class="btn" type="button" data-act="close">Cancel</button><button class="btn primary">Save</button></footer>
      </form>
    </dialog>`;
  }

  /* ---------- changes ---------- */
  app.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset;
    if (d.view) { view = d.view; render(); app.querySelector(".main")?.focus(); }
    else if (d.run) run(d.run);
    else if (d.cat) { category = d.cat; render(); }
    else if (d.toggle) {
      const a = byId(d.toggle);
      state.enabled = { ...state.enabled, [a.id]: !state.enabled[a.id] };
      render();
      app.querySelector(`[data-toggle="${a.id}"]`)?.focus();
      toast(`${a.name} is ${state.enabled[a.id] ? "on" : "off"}.`);
    }
    else if (d.edit) { editing = d.edit; render(); }
    else if (d.act === "close") app.querySelector("dialog")?.close();
    else if (d.plan) {
      state.plan = d.plan;
      render();
      toast(`You're on ${plan().name}: ${core.CATALOG.filter((a) => core.unlocked(a, state.plan)).length} automations and ${plan().credits.toLocaleString("en-US")} AI drafts a month.`);
    }
    else if (d.discard) {
      const x = state.approvals.find((y) => y.id === d.discard);
      state.approvals = state.approvals.filter((y) => y.id !== d.discard);
      state.activity.unshift({ id: uid(), at: Date.now(), name: byId(x.automation).name, contact: x.contact, channel: byId(x.automation).channel, text: x.text, status: "discarded" });
      render();
      toast("Discarded. Nothing was sent.");
    }
    else if (d.connect) { state.connections = { ...state.connections, [d.connect]: true }; render(); toast("Connected. In the real app this opens the other service to approve access."); }
    else if (d.demo === "number") toast("In the real app you can pick a new local number or bring your own.");
    else if (d.demo === "copy") toast("Copied northside@in.example.com.");
  });

  app.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const f = new FormData(form);
    if (form.dataset.form === "approve") {
      const x = state.approvals.find((y) => y.id === form.dataset.id);
      const a = byId(x.automation);
      state.approvals = state.approvals.filter((y) => y.id !== x.id);
      const text = String(f.get("text")).trim();
      const now = Date.now();
      const at = a.channel === "text" ? core.sendTime(now, state.hours) : now;
      state.activity.unshift({ id: uid(), at: now, name: a.name, contact: x.contact, channel: a.channel, text, status: at > now ? "queued" : "sent", sendAt: at });
      render();
      toast(at > now ? `Approved. It sends ${when(at)}, when you open.` : "Approved and sent. (In this demo, nothing really leaves.)");
    } else if (form.dataset.form === "settings") {
      const a = byId(editing);
      const next = { approve: f.get("approve") === "on" };
      if (!a.ai && f.has("template")) next.template = String(f.get("template"));
      state.settings = { ...state.settings, [a.id]: next };
      editing = null;
      render();
      toast("Saved.");
    } else if (form.dataset.form === "business") {
      const open = String(f.get("open")), close = String(f.get("close"));
      if (open >= close) { toast("Closing time has to be after opening time."); return; }
      state.business = { ...state.business, booking_link: String(f.get("booking_link")).trim(), review_link: String(f.get("review_link")).trim(), pay_link: String(f.get("pay_link")).trim() };
      state.hours = { open, close };
      render();
      toast("Saved. Messages use the new links from now on.");
    }
  });

  // Closing the dialog any way (Esc, Cancel, ×) drops the edit and redraws without it.
  app.addEventListener("close", (e) => { if (e.target.tagName === "DIALOG") { editing = null; render(); } }, true);

  /* ---------- sample business ---------- */
  function sample() {
    const now = Date.now();
    const enabled = {};
    for (const a of core.CATALOG) enabled[a.id] = a.plan !== "business" && !["revive", "call-recap"].includes(a.id);
    const ago = (h) => now - h * HOUR;
    const act = (h, id, contact, text, status) => ({ id: uid(), at: ago(h), name: byId(id).name, contact, channel: byId(id).channel, text, status });
    return {
      plan: "pro",
      used: 132,
      enabled,
      settings: {},
      hours: { open: "08:00", close: "20:00" },
      business: { name: "Northside Plumbing (sample)", booking_link: "https://example.com/book", review_link: "https://example.com/review", pay_link: "https://example.com/pay" },
      connections: { money: true, google: false, site: false },
      approvals: [
        { id: uid(), at: ago(1.5), automation: "quote-followup", contact: "Ben Carter", text: "Hi Ben, just checking the quote for the basement drain reached you. Happy to walk through it or adjust the scope if anything doesn't fit. I can hold the Thursday slot until Friday." },
        { id: uid(), at: ago(3), automation: "review-reply", contact: "Maria Gomez", text: "Thank you, Maria! Glad the water heater swap went smoothly. We appreciate you trusting us with it." },
      ],
      activity: [
        act(0.5, "missed-call", "Sam Okafor", "Hi Sam, sorry I missed your call. This is Northside Plumbing (sample). What can I help with?", "sent"),
        act(1.5, "quote-followup", "Ben Carter", "Draft ready for your approval.", "approval"),
        act(3, "review-reply", "Maria Gomez", "Draft ready for your approval.", "approval"),
        act(4, "review-ask", "Maria Gomez", "Thanks for choosing Northside Plumbing (sample), Maria. If you have a minute, a review helps a lot: https://example.com/review", "sent"),
        act(6, "invoice-chase", "Lena Hart", "Hi Lena, a quick reminder that invoice #1038 for $640 is now due. You can pay here: https://example.com/pay", "sent"),
        act(9, "daily-brief", "You", "Sent your morning briefing: 2 new leads, 3 follow-ups due, 4 appointments.", "sent"),
        act(14, "web-reply", "Chris Nolan", "Hi Chris, thanks for getting in touch with Northside Plumbing (sample). I'll reply properly within a few hours.", "sent"),
        act(20, "reminders", "Aisha Bello", "Hi Aisha, a reminder from Northside Plumbing (sample): see you tomorrow at 9:00 AM. Reply C to confirm or R to reschedule.", "sent"),
      ],
    };
  }

  state = sample();
  render();
})();
