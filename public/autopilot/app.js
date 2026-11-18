/* HEURIAL Autopilot: the demo page. Written for busy owners who aren't techy: plain words, big buttons, four
   screens (Home, Check messages, My automations, Settings). A made-up plumbing business; the rules are the real ones
   (core.js), the events and written messages are sample data, and nothing is sent or saved. */
(function () {
  const core = window.AutopilotCore;
  const HOUR = 3600e3;
  const BOOKING_URL = "https://heurial.zohobookings.com/4948260000000038065";
  const VIEWS = [["home", "Home"], ["approve", "Check messages"], ["automations", "My automations"], ["settings", "Settings"]];
  const CHANNEL = { text: "Text message", email: "Email", tracker: "Saved to my list", owner: "Sent to me", web: "On my website" };
  const STATUS = {
    sent: ["Sent", "up"], queued: ["Sends later", "warn"], approval: ["Waiting for your OK", "accent"], logged: ["Saved", "up"],
    skipped: ["Not sent", "muted"], waiting: ["Paused", "down"], discarded: ["Not sent", "muted"], optout: ["Asked to stop", "muted"],
  };
  // Things that happen in a working day. Each one fires a real trigger through core.plan.
  const EVENTS = [
    { trigger: "missed_call", label: "I miss a call", note: "I'm on a job and can't pick up." },
    { trigger: "web_inquiry", label: "Someone writes in on my website", note: "At 11 PM, while I'm asleep." },
    { trigger: "proposal_quiet", label: "A quote gets no answer", note: "Two days and nothing back." },
    { trigger: "job_paid", label: "A customer pays", note: "The job is done and paid." },
    { trigger: "invoice_overdue", label: "A bill is late", note: "Three days past due." },
    { trigger: "review_posted", label: "I get a 5-star review", note: "A happy customer posts one." },
    { trigger: "stop", label: "A customer texts STOP", note: "They don't want texts." },
  ];
  // Sample written messages, standing in for what the AI writes. Real ones are written for each customer.
  const DRAFTS = {
    "quote-followup": "Hi {first_name}, just checking the quote for {topic} reached you. Happy to go through it or change anything that doesn't fit. I can hold Thursday for you until Friday.",
    "revive": "Hi {first_name}, it's been a while since we talked about {topic}. Is it still on your list? I have openings next week.",
    "call-recap": "Thanks for the call, {first_name}. To recap: {topic}, and I'll send the written quote by tomorrow. If I missed anything, just reply here.",
    "review-reply": "Thank you, {first_name}! Glad the {topic} went smoothly. We appreciate you trusting us with it.",
    "receipts": "Filed a $48.20 receipt from a supply store under Materials.",
    "monthly-report": "October: 41 calls, 18 new customers, 11 jobs won ($9,860). You're replying faster. Next: 4 quotes still need a follow-up.",
    "seasonal": "Hi {first_name}, winter's coming. A quick check of your water heater and outdoor taps now saves a frozen-pipe call later. Book a time: {booking_link}",
    "site-assistant": "Answered “Do you do weekend calls?” and offered a booking link.",
    "social-drafts": "Another one done: {topic} for a happy customer this week. Need a hand with yours? Link in bio.",
    "gbp-posts": "This week we fixed 9 leaks and replaced 2 water heaters on the north side. Same-day visits most weekdays.",
  };
  const DONE = {
    "email-lead": "Added {name} to my list with their email.",
    "lead-source": "Noted that {name} found me through Google.",
    "hot-alert": "New request: {first_name} wants {topic}. Reply soon.",
    "stale-cleanup": "Closed 3 old requests with no news in 4 months.",
    "daily-brief": "Sent my morning summary: 2 new requests, 3 follow-ups, 4 appointments.",
    "weekly-numbers": "Sent my weekly numbers.",
    "expense-summary": "Sent last month's spending summary.",
    "booking-link": "Added my booking link to the reply.",
    "confirm": "Asked {first_name} to reply C to confirm or R to pick a new time.",
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
  let view = "home";
  let category = "All";
  let showAll = false;
  let editing = null; // automation id in the change-message window
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
    return days === 0 ? `Today ${clock(t)}` : days === 1 ? `Yesterday ${clock(t)}` : days < 0 ? `Tomorrow ${clock(t)}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${clock(t)}`;
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
    toast.t = setTimeout(() => el.classList.remove("show"), 4500);
  }
  const chip = (status, extra = "") => { const [label, tone] = STATUS[status]; return `<span class="status ${tone}">${label}${extra ? ` · ${esc(extra)}` : ""}</span>`; };
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

  /* ---------- running an event ---------- */
  function messageFor(a, contact) {
    const template = state.settings[a.id]?.template ?? (a.ai ? DRAFTS[a.id] : a.template) ?? "";
    return fill(template || DONE[a.id] || `${a.name}: done.`, contact);
  }

  function run(trigger) {
    const contact = CONTACTS[nextContact++ % CONTACTS.length];
    const now = Date.now();
    if (trigger === "stop") {
      contact.optedOut = true;
      state.activity.unshift({ id: uid(), at: now, name: "Stopped texts", contact: contact.name, channel: "text", text: `${contact.first_name} replied STOP. They won't get any more texts.`, status: "optout" });
      render();
      toast(`${contact.first_name} won't get any more texts.`);
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
    const waiting = steps.filter((s) => s.status === "approval").length;
    const done = steps.filter((s) => !["skipped", "waiting", "approval"].includes(s.status)).length;
    const held = steps.filter((s) => s.status === "skipped" || s.status === "waiting").length;
    if (!steps.length) { toast("Nothing happened: none of your automations handle this yet. Turn one on in My automations."); return; }
    const parts = [];
    if (done) parts.push(`${done} thing${done === 1 ? "" : "s"} done for you`);
    if (waiting) parts.push(`${waiting} message${waiting === 1 ? "" : "s"} waiting for your OK`);
    if (held) parts.push(`${held} held back`);
    toast(`${contact.first_name}: ${parts.join(", ")}. See below.`);
  }

  /* ---------- drawing ---------- */
  function render() {
    const titles = { home: `${greeting()}.`, approve: "Check messages", automations: "My automations", settings: "Settings" };
    const p = plan();
    const left = core.creditsLeft(state.plan, state.used);
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <div class="brand"><strong>Autopilot</strong><span>by HEURIAL</span></div>
        <nav aria-label="Sections">${VIEWS.map(([k, label]) => {
          const badge = k === "approve" && state.approvals.length ? `<b aria-label="${state.approvals.length} waiting">${state.approvals.length}</b>` : "";
          return `<button class="nav${view === k ? " on" : ""}" data-view="${k}"${view === k ? ' aria-current="page"' : ""}>${label}${badge}</button>`;
        }).join("")}</nav>
        <div class="side-foot">
          <p class="sample"><strong>This is a sample business.</strong> Nothing is really sent.</p>
          <div class="help">
            <p><strong>Want it set up for you?</strong> I'll do it with you on a call.</p>
            <a class="btn light" href="${BOOKING_URL}" target="_blank" rel="noopener noreferrer">Book a free call</a>
          </div>
          <div class="meter" role="group" aria-label="Written messages left this month">
            <p><span>${esc(p.name)} plan</span><span class="n">${left} of ${p.credits} written messages left</span></p>
            <i style="--w:${Math.round((left / p.credits) * 100)}%"></i>
          </div>
        </div>
      </aside>
      <main class="main" tabindex="-1">
        <header class="top"><h1>${titles[view]}</h1><span class="biz">${esc(state.business.name)}</span></header>
        ${{ home, approve, automations, settings }[view]()}
      </main>
    </div>
    ${editing ? dialog() : ""}
    <div class="toast" role="status" aria-live="polite"></div>`;
    const dlg = app.querySelector("dialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  const tile = (label, value, note = "") => `<div class="tile"><p class="tile-label">${label}</p><p class="tile-value n">${value}</p>${note ? `<p class="tile-note">${note}</p>` : ""}</div>`;

  function feed(list) {
    if (!list.length) return `<p class="empty">Nothing yet. Tap something above to see it work.</p>`;
    return `<ul class="feed">${list.map((x) => `<li>
      <div class="feed-head"><strong>${esc(x.name)}</strong>${chip(x.status, x.status === "queued" ? when(x.sendAt) : "")}</div>
      <p class="muted">${esc(x.contact)} · ${CHANNEL[x.channel] || ""} · ${when(x.at)}</p>
      <p class="feed-text">${esc(x.text)}</p>
    </li>`).join("")}</ul>`;
  }

  function home() {
    const weekAgo = Date.now() - 7 * 24 * HOUR;
    const done = state.activity.filter((x) => x.at > weekAgo && ["sent", "logged", "queued"].includes(x.status)).length;
    const n = state.approvals.length;
    const list = showAll ? state.activity : state.activity.slice(0, 5);
    return `<section class="banner${n ? " needs" : ""}" aria-live="polite">
        ${n ? `<p><strong>${n} message${n === 1 ? " is" : "s are"} waiting for your OK.</strong> Nothing goes to a customer until you say so.</p><button class="btn primary big" data-view="approve">Check ${n === 1 ? "it" : "them"} now</button>`
          : `<p><strong>Nothing needs you right now.</strong> Autopilot is handling the rest.</p>`}
      </section>
      <section class="tiles three">
        ${tile("Working for you", core.CATALOG.filter(isOn).length, "automations turned on")}
        ${tile("Done this week", done, "texts, emails and updates")}
        ${tile("Written messages left", core.creditsLeft(state.plan, state.used), `of ${plan().credits} this month`)}
      </section>
      <section class="card" aria-labelledby="h-try">
        <h2 id="h-try">See it work</h2>
        <p class="hint">Tap something that happens in your day. You'll see what Autopilot does about it below.</p>
        <div class="events">${EVENTS.map((e) => `<button class="event" data-run="${e.trigger}"><strong>${e.label}</strong><span>${e.note}</span></button>`).join("")}</div>
      </section>
      <section class="card" aria-labelledby="h-act">
        <h2 id="h-act">What happened</h2>
        ${feed(list)}
        ${state.activity.length > 5 ? `<button class="btn" data-act="more">${showAll ? "Show less" : `Show everything (${state.activity.length})`}</button>` : ""}
      </section>`;
  }

  function approve() {
    if (!state.approvals.length) return `<section class="card"><p class="empty">Nothing to check. When Autopilot writes a message for you, it waits here until you say it's OK.</p><button class="btn" data-view="home">Back to Home</button></section>`;
    return `<p class="lead">Read each message. Change anything you like, then send it, or choose not to.</p>
      <div class="approvals">${state.approvals.map((x) => {
        const a = byId(x.automation);
        return `<form class="card approval" data-form="approve" data-id="${x.id}">
          <p><strong>To ${esc(x.contact)}</strong> <span class="muted">by ${CHANNEL[a.channel].toLowerCase()} · ${esc(a.name)}</span></p>
          <textarea name="text" rows="4" aria-label="Message to ${esc(x.contact)}">${esc(x.text)}</textarea>
          <footer><button class="btn primary big">Looks good, send it</button><button class="btn big" type="button" data-discard="${x.id}">Don't send</button></footer>
        </form>`;
      }).join("")}</div>`;
  }

  function automations() {
    const cats = ["All", ...core.CATEGORIES];
    const list = core.CATALOG.filter((a) => category === "All" || a.category === category);
    return `<p class="lead">Turn on what you want Autopilot to handle. You can change your mind any time.</p>
      <div class="filters" role="group" aria-label="Show">${cats.map((c) => `<button class="pill${category === c ? " on" : ""}" data-cat="${esc(c)}" aria-pressed="${category === c}">${esc(c)}</button>`).join("")}</div>
      <div class="auto-grid">${list.map((a) => {
        const open = core.unlocked(a, state.plan);
        const on = isOn(a);
        return `<article class="auto${open ? "" : " locked"}${on ? " is-on" : ""}">
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.description)}</p>
          ${a.ai ? `<p class="ai-note">Written for you. You check it before it's sent.</p>` : ""}
          <footer>
            ${open ? `<button class="switch" role="switch" aria-checked="${on}" data-toggle="${a.id}"><i></i><span>${on ? "On" : "Off"}</span><span class="sr">${esc(a.name)}</span></button>
              ${(a.template || a.ai) ? `<button class="link" data-edit="${a.id}">${a.ai ? "See an example" : "Change the message"}</button>` : ""}`
              : `<span class="lock">In the ${esc(core.unlockedBy(a).name)} plan</span><button class="link" data-view="settings">See plans</button>`}
          </footer>
        </article>`;
      }).join("")}</div>`;
  }

  function settings() {
    const c = state.connections;
    const row = (title, detail, status, action = "") => `<li class="conn"><div><p><strong>${title}</strong></p><p class="muted">${detail}</p></div><span class="status ${status[1]}">${status[0]}</span>${action}</li>`;
    const proOk = core.unlocked({ plan: "pro" }, state.plan);
    const bizOk = core.unlocked({ plan: "business" }, state.plan);
    const left = core.creditsLeft(state.plan, state.used);
    let prev = [];
    return `<section class="card">
        <h2>My plan</h2>
        <p class="hint">${left} of ${plan().credits} written messages left this month. In this sample, changing plans is free and instant.</p>
        <div class="plans">${core.PLANS.map((p) => {
          const list = core.CATALOG.filter((a) => core.unlocked(a, p.id));
          const added = list.filter((a) => !prev.includes(a));
          const intro = prev.length ? `Everything in ${core.PLANS[core.PLANS.indexOf(p) - 1].name}, plus:` : "Includes:";
          prev = list;
          const current = p.id === state.plan;
          return `<section class="plan${current ? " current" : ""}">
            <h3>${esc(p.name)}</h3>
            <p class="muted">${esc(p.note)}</p>
            <p class="plan-figs"><span><b class="n">${list.length}</b> automations</span><span><b class="n">${p.credits.toLocaleString("en-US")}</b> written messages a month</span></p>
            ${current ? `<p class="status up">Your plan</p>` : `<button class="btn ${core.PLANS.indexOf(p) > core.PLANS.findIndex((x) => x.id === state.plan) ? "primary" : ""}" data-plan="${p.id}">Switch to ${esc(p.name)}</button>`}
            <details><summary>${intro.replace(":", "")} (${added.length})</summary><ul class="ticks">${added.map((a) => `<li>${esc(a.name)}</li>`).join("")}</ul></details>
          </section>`;
        }).join("")}</div>
      </section>
      <section class="card">
        <h2>My phone and email</h2>
        <ul class="conns">
          ${row("Business number", "(555) 010-0199. Texts and missed calls come through here.", ["Ready", "up"])}
          ${row("Texting approval", "Phone companies approve every business before it can text customers. Done for you.", ["Approved", "up"])}
          ${row("Email forwarding", "Forward emails to northside@in.example.com and they're added to your list.", ["Ready", "up"])}
        </ul>
      </section>
      <form class="card" data-form="business">
        <h2>My links and hours</h2>
        <p class="hint">Messages use these. Texts are only sent between your opening and closing times.</p>
        <div class="fields">
          <label><span>Link to book a time with me</span><input name="booking_link" type="url" value="${esc(state.business.booking_link)}"></label>
          <label><span>Link to my Google reviews</span><input name="review_link" type="url" value="${esc(state.business.review_link)}"></label>
          <label><span>Link to pay me</span><input name="pay_link" type="url" value="${esc(state.business.pay_link)}"></label>
          <label><span>I open at</span><input name="open" type="time" value="${esc(state.hours.open)}" required></label>
          <label><span>I close at</span><input name="close" type="time" value="${esc(state.hours.close)}" required></label>
        </div>
        <div class="row"><button class="btn primary big">Save</button></div>
      </form>
      <section class="card">
        <h2>Other accounts</h2>
        <ul class="conns">
          ${row("Payments (Stripe or QuickBooks)", "Lets Autopilot see bills and payments.", c.money ? ["Connected", "up"] : proOk ? ["Not connected", "muted"] : ["In the Pro plan", "muted"], proOk && !c.money ? `<button class="btn" data-connect="money">Connect</button>` : "")}
          ${row("Google listing", "For reviews, replies and weekly posts.", c.google ? ["Connected", "up"] : bizOk ? ["Not connected", "muted"] : ["In the Business plan", "muted"], bizOk && !c.google ? `<button class="btn" data-connect="google">Connect</button>` : "")}
        </ul>
      </section>`;
  }

  function dialog() {
    const a = byId(editing);
    const s = state.settings[a.id] || {};
    const template = s.template ?? (a.ai ? DRAFTS[a.id] : a.template) ?? "";
    const approveFirst = s.approve ?? a.ai;
    const preview = core.render(template, vars(CONTACTS[0]));
    return `<dialog aria-labelledby="dlg-title">
      <form data-form="settings" method="dialog">
        <header><h2 id="dlg-title">${esc(a.name)}</h2><button class="x" type="button" data-act="close" aria-label="Close">×</button></header>
        <p class="muted">${esc(a.description)}</p>
        ${a.ai ? `<p>Here's an example. A new one is written for each customer, and you check it first.</p><div class="preview"><p>${esc(preview.text)}</p></div>`
          : `<label><span>The message</span><textarea name="template" rows="4">${esc(template)}</textarea></label>
        <p class="hint">Words in {curly brackets} are filled in for you, like {first_name} for the customer's first name.</p>
        <div class="preview"><p class="muted">How ${esc(CONTACTS[0].first_name)} would see it:</p><p>${esc(preview.text)}</p>${preview.missing.length ? `<p class="down">Missing: ${preview.missing.map(esc).join(", ")}. Add it in Settings, or this message won't be sent.</p>` : ""}</div>`}
        <label class="check"><input type="checkbox" name="approve"${approveFirst ? " checked" : ""}> Let me check it before it's sent</label>
        <footer><span></span><button class="btn big" type="button" data-act="close">Cancel</button><button class="btn primary big">Save</button></footer>
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
    else if (d.act === "more") { showAll = !showAll; render(); }
    else if (d.toggle) {
      const a = byId(d.toggle);
      state.enabled = { ...state.enabled, [a.id]: !state.enabled[a.id] };
      render();
      app.querySelector(`[data-toggle="${a.id}"]`)?.focus();
      toast(`“${a.name}” is ${state.enabled[a.id] ? "on" : "off"}.`);
    }
    else if (d.edit) { editing = d.edit; render(); }
    else if (d.act === "close") app.querySelector("dialog")?.close();
    else if (d.plan) {
      state.plan = d.plan;
      render();
      toast(`You're on ${plan().name} now: ${core.CATALOG.filter((a) => core.unlocked(a, state.plan)).length} automations.`);
    }
    else if (d.discard) {
      const x = state.approvals.find((y) => y.id === d.discard);
      state.approvals = state.approvals.filter((y) => y.id !== d.discard);
      state.activity.unshift({ id: uid(), at: Date.now(), name: byId(x.automation).name, contact: x.contact, channel: byId(x.automation).channel, text: x.text, status: "discarded" });
      render();
      toast("OK. That message won't be sent.");
    }
    else if (d.connect) { state.connections = { ...state.connections, [d.connect]: true }; render(); toast("Connected. (In the real app you'd sign in to that account to allow it.)"); }
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
      toast(at > now ? `Done. It will be sent ${when(at)}, when you're open.` : `Sent to ${x.contact}. (In this sample, nothing really leaves.)`);
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
      if (open >= close) { toast("Your closing time needs to be after your opening time."); return; }
      state.business = { ...state.business, booking_link: String(f.get("booking_link")).trim(), review_link: String(f.get("review_link")).trim(), pay_link: String(f.get("pay_link")).trim() };
      state.hours = { open, close };
      render();
      toast("Saved. Your messages use these from now on.");
    }
  });

  // Closing the window any way (Esc, Cancel, ×) drops the change and redraws without it.
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
      connections: { money: true, google: false },
      approvals: [
        { id: uid(), at: ago(1.5), automation: "quote-followup", contact: "Ben Carter", text: "Hi Ben, just checking the quote for the basement drain reached you. Happy to go through it or change anything that doesn't fit. I can hold Thursday for you until Friday." },
        { id: uid(), at: ago(3), automation: "review-reply", contact: "Maria Gomez", text: "Thank you, Maria! Glad the water heater swap went smoothly. We appreciate you trusting us with it." },
      ],
      activity: [
        act(0.5, "missed-call", "Sam Okafor", "Hi Sam, sorry I missed your call. This is Northside Plumbing (sample). What can I help with?", "sent"),
        act(1.5, "quote-followup", "Ben Carter", "A follow-up is written and waiting for your OK.", "approval"),
        act(3, "review-reply", "Maria Gomez", "A reply to her review is written and waiting for your OK.", "approval"),
        act(4, "review-ask", "Maria Gomez", "Thanks for choosing Northside Plumbing (sample), Maria. If you have a minute, a review helps a lot: https://example.com/review", "sent"),
        act(6, "invoice-chase", "Lena Hart", "Hi Lena, a quick reminder that invoice #1038 for $640 is now due. You can pay here: https://example.com/pay", "sent"),
        act(9, "daily-brief", "You", "Sent my morning summary: 2 new requests, 3 follow-ups, 4 appointments.", "sent"),
        act(14, "web-reply", "Chris Nolan", "Hi Chris, thanks for getting in touch with Northside Plumbing (sample). I'll reply properly within a few hours.", "sent"),
        act(20, "reminders", "Aisha Bello", "Hi Aisha, a reminder from Northside Plumbing (sample): see you tomorrow at 9:00 AM. Reply C to confirm or R to reschedule.", "sent"),
      ],
    };
  }

  state = sample();
  render();
})();
