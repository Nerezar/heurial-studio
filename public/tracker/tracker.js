/* HEURIAL follow-up tracker: the workspace app behind the real tracker (/admin) and the sample-data page.
 *
 * Each page supplies a data source and calls
 *   HeurialTracker.start({ mode, api, auth })
 *     mode  "live" or "demo"
 *     api   async (path, method, body) => JSON. Paths look like "/api/data?range=30". Throws Error with .status.
 *     auth  optional { check(), signIn(password), signOut() } for the real tracker's sign-in
 *     device  optional { installed, ios, canInstall(), install(), pushState(), enablePush(), disablePush(), testPush() }
 *           for the installed app and notifications on this device (the real tracker only)
 *
 * Layout: an icon rail, a top bar, a strip of key figures, the current section, a lead panel that docks
 * on the right, and a status bar. Everything shown comes from the API: no invented numbers, history or
 * connection states.
 */
(function () {
  "use strict";

  const ORDER = ["booked", "held", "proposal", "paid", "lost", "no_show"];
  const OPEN = ["booked", "held", "proposal"];
  const STATUS = {
    booked: { label: "Call booked", short: "Booked", c: "--accent" },
    held: { label: "Call held", short: "Held", c: "--cyan" },
    proposal: { label: "Proposal sent", short: "Proposal", c: "--warn" },
    paid: { label: "Paid", short: "Paid", c: "--up" },
    lost: { label: "Lost", short: "Lost", c: "--mute" },
    no_show: { label: "No-show", short: "No-show", c: "--down" },
  };
  // When a lead reaches one of these stages and has no follow-up, suggest one.
  const FOLLOW_PLAN = { held: [3, "Send a follow-up after the call"], proposal: [3, "Check in on the proposal"], paid: [14, "Ask for a testimonial"] };
  // A range of N days is today and the N-1 days before it, on every screen and in the chart.
  const RANGES = [["1", "1D", "today"], ["7", "1W", "last 7 days"], ["30", "1M", "last 30 days"], ["90", "3M", "last 90 days"], ["365", "1Y", "last 12 months"], ["all", "ALL", "all time"]];
  // Every screen. The first five lead the sidebar's five sections, so the number keys 1 to 5 open them.
  const VIEWS = {
    overview: ["Overview", "overview"], money: ["Money", "wallet"], pipeline: ["Lead board", "leads"], tasks: ["Tasks", "tasks"],
    connections: ["Settings", "gear"], leads: ["Lead list", "leads"], time: ["Time", "time"], messages: ["Messages", "messages"],
  };
  // The sidebar: a section's name, its icon, and the screens inside it (more than one shows as tabs at the top).
  const SECTIONS = [
    ["Overview", "overview", ["overview"]], ["Money", "wallet", ["money"]],
    ["Leads", "leads", ["pipeline", "leads", "time", "messages"]], ["Tasks", "tasks", ["tasks"]], ["Settings", "gear", ["connections"]],
  ];
  const sectionOf = (view) => SECTIONS.find((sec) => sec[2].includes(view));
  const TAB_NAME = { pipeline: "Board", leads: "List", time: "Time", messages: "Messages" };
  // The client panel's tabs: key, name, and the panel each one shows.
  const TABS = [["timeline", "Timeline", "linePanel"], ["details", "Details", "leadForm"], ["messages", "Messages", "msgPanel"], ["time", "Time", "timePanel"]];
  const CHANNEL = { note: ["Note", "note"], email: ["Email", "mail"], sms: ["Text", "sms"], call: ["Call", "phone"] };
  const DUE_BUCKETS = [["late", "Overdue", "--down"], ["today", "Due today", "--warn"], ["week", "Next 7 days", "--accent"], ["later", "Later", "--mute"], ["none", "None set", "--mute"]];
  const ICONS = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    pipeline: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
    leads: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.9 3 2.8 3 5.7"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
    tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    messages: '<path d="M4 5h16v11H9l-5 4z"/>',
    plug: '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    down: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sms: '<path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    note: '<path d="M5 4h14v12l-4 4H5zM15 20v-4h4"/>',
    send: '<path d="m4 12 16-8-6 16-3-7z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    inbound: '<path d="M4 13v6h16v-6M12 4v10m0 0-4-4m4 4 4-4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    arrow: '<path d="M5 12h14m0 0-5-5m5 5-5 5"/>',
    out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
  };
  const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const CMD_KEY = MAC ? "⌘K" : "Ctrl K";

  // ---------- Formatting ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Whole dollars read cleanly; an amount with cents shows them, so nothing is rounded away.
  const money = (cents) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Math.round(cents) % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const usd = (dollars) => "$" + Math.round(dollars).toLocaleString("en-US");
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
  const hrs = (h) => (Math.round(h * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const at = (s) => new Date(s + "T12:00:00");
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const d = at(s); d.setDate(d.getDate() + n); return ymd(d); };
  const mondayOf = (s) => { const d = at(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
  const dayDiff = (a, b) => Math.round((at(a) - at(b)) / 864e5);
  const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  /** "Nov 12", with the year added when it isn't this year. */
  function niceDate(s) {
    if (!s) return "–";
    const sameYear = !state.data || s.slice(0, 4) === state.data.today.slice(0, 4);
    return at(s).toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }
  function stamp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  function ago(iso) {
    const h = Math.round((Date.now() - Date.parse(iso)) / 36e5);
    return h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  }
  const tag = (status) => `<span class="tag" style="--c:var(${STATUS[status].c})">${STATUS[status].short}</span>`;
  /** A follow-up date as words plus a class: overdue and today stand out, later dates don't. */
  function due(date) {
    if (!date) return { text: "–", cls: "", long: "–" };
    const d = dayDiff(date, state.data.today);
    if (d < 0) return { text: `${-d}d late`, cls: "late", long: `${plural(-d, "day")} overdue` };
    if (d === 0) return { text: "Today", cls: "today", long: "Due today" };
    if (d === 1) return { text: "Tomorrow", cls: "", long: "Tomorrow" };
    return { text: niceDate(date), cls: "", long: niceDate(date) };
  }
  const dueTag = (date) => { const x = due(date); return `<span class="due ${x.cls}">${x.text}</span>`; };
  function dueBucket(lead) {
    if (!lead.follow_up_at) return "none";
    const d = dayDiff(lead.follow_up_at, state.data.today);
    return d < 0 ? "late" : d === 0 ? "today" : d <= 7 ? "week" : "later";
  }

  // ---------- State ----------
  let cfg = null;
  const state = {
    data: null, all: [], loading: true, error: "", online: false, lastSync: 0,
    view: "overview", range: "30", loadedRange: "", ovTab: "conversion", moneyTab: "all", taskTab: "open",
    query: "", facets: { stage: new Set(), source: new Set(), due: new Set() }, sort: { key: "booked_at", dir: "desc" },
    time: null, timeLoading: false,
    lead: null, isNew: false, tab: "timeline", dirty: false, thread: null, leadTime: null,
    next: [], nextAt: 0, pick: null, txFocus: "", review: null, ai: {},
  };
  const stored = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const store = (key, value) => {
    if (cfg.mode === "demo" && key !== "hp-theme") return; // the sample-data page always starts fresh
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  };
  const rangeText = () => RANGES.find((r) => r[0] === state.range)[2];
  /** "in the last 30 days", "today", or "across all time". */
  const inPeriod = () => (state.range === "all" ? "across all time" : state.range === "1" ? "today" : `in the ${rangeText()}`);
  /** Your own tasks that are due today or overdue. */
  const dueTasks = (d) => (state.tasks || []).filter((t) => !t.done_at && t.due_at && t.due_at <= d.today);
  const urgentCount = (d) => d.inbox.length + d.stale.length + d.followups.filter((f) => f.follow_up_at <= d.today).length + dueTasks(d).length;
  /** What makes up that count, as words: "2 follow-ups · 1 inquiry". */
  const urgentParts = (d) => [
    [d.followups.filter((f) => f.follow_up_at <= d.today).length, "follow-up"], [d.inbox.length, "inquiry", "inquiries"],
    [d.stale.length, "call to record", "calls to record"], [dueTasks(d).length, "task"],
  ].filter(([n]) => n).map(([n, one, many]) => plural(n, one, many)).join(" · ");
  /** Whether a part of the back end is there. The sample-data page has everything. */
  const has = (part) => cfg.mode === "demo" || Boolean(services() && services()[part]);
  const matches = (lead, q) => !q || [lead.name, lead.business, lead.email, lead.phone, lead.source].some((v) => String(v || "").toLowerCase().includes(q));
  const services = () => (state.data && state.data.services) || null;

  /** All API calls go through here, so an expired session always leads back to sign-in. */
  // The lead that was just changed keeps a highlight for a moment, so the eye finds it after the list redraws.
  let touchTimer = 0;
  function touch(id) {
    state.touched = String(id);
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => { state.touched = null; }, 2600);
  }
  /** Let a finished item slide away before its list redraws. */
  function leave(el) {
    const row = el && el.closest(".q-row");
    if (!row || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
    row.classList.add("is-leaving");
    return new Promise((done) => setTimeout(done, 260));
  }

  async function call(path, method, body) {
    try {
      const result = await cfg.api(path, method || "GET", body);
      if (method && method !== "GET") {
        const changed = (/^\/api\/leads\/([^/]+)$/.exec(path) || [])[1] || (result && path.endsWith("/convert") && result.leadId) || (result && path === "/api/leads" && result.id);
        if (changed) touch(changed);
      }
      return result;
    } catch (err) {
      if (err && err.status === 401 && cfg.auth) showSignIn();
      throw err;
    }
  }

  let toastTimer = 0;
  function toast(message, isError) {
    const t = $("toast");
    t.textContent = message;
    t.classList.toggle("err", Boolean(isError));
    t.setAttribute("role", isError ? "alert" : "status");
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), isError ? 5000 : 2800);
  }

  /** Run an action from a button: disabled while it runs (no double submits), and failures are reported. */
  async function act(button, fn) {
    if (button && button.disabled) return;
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    try {
      await fn();
    } catch (err) {
      toast(err.message || "Something went wrong.", true);
    } finally {
      if (button && button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); }
    }
  }

  // Each load is numbered. If the range changes while one is on its way, the older answer is dropped when it
  // arrives, so a slow reply for 30 days can never overwrite the 7 days chosen after it.
  let loadSeq = 0;
  async function load() {
    const seq = ++loadSeq, range = state.range;
    try {
      // The chosen period, and every lead there has ever been: the money line starts from what was earned before the period.
      const [data, ever] = await Promise.all([call("/api/data?range=" + range), range === "all" ? null : call("/api/data?range=all")]);
      if (seq !== loadSeq) return;
      state.data = data;
      state.all = (ever || data).leads;
      state.tx = (ever || data).transactions || []; // every money entry, client payments included
      state.tasks = (ever || data).tasks || [];
      state.next = (ever || data).next || [];
      state.loadedRange = range;
      state.error = "";
      state.online = true;
      state.lastSync = Date.now();
      state.time = Array.isArray(state.data.time) ? state.data.time : null;
    } catch (err) {
      if (seq !== loadSeq) return;
      state.error = err.message || "Couldn't load the tracker.";
      state.online = false;
      // Keep the range control honest: it should name the period the figures on screen cover.
      if (state.data && state.loadedRange) state.range = state.loadedRange;
    }
    state.loading = false;
    render();
    if (state.view === "time") ensureTime();
    if (pendingLink && state.data) { const link = pendingLink; pendingLink = ""; follow(link); }
  }

  // Links from notifications: /admin#lead=ID&tab=messages or /admin#view=overview.
  let pendingLink = "";
  function follow(url) {
    const hash = String(url || "").split("#")[1] || "";
    if (!hash) return;
    if (!state.data) { pendingLink = url; return; }
    const p = new URLSearchParams(hash);
    try { history.replaceState(null, "", location.pathname); } catch { /* not important */ }
    if (p.get("view") && VIEWS[p.get("view")]) setView(p.get("view"));
    if (/^\d{1,20}$/.test(p.get("lead") || "")) openById(p.get("lead"), TABS.some(([key]) => key === p.get("tab")) ? p.get("tab") : "timeline");
  }

  // This device: installed app and notifications. Checked when Connections is shown.
  async function refreshDevice() {
    if (!cfg.device) return;
    const next = await cfg.device.pushState().catch(() => "unsupported");
    if (next !== state.pushState) { state.pushState = next; if (state.view === "connections") render(); }
  }

  // ---------- Frame ----------
  const railBtn = ([name, ico, views]) => `<button class="rail-btn" type="button" data-action="view" data-view="${views[0]}" title="${name}">${icon(ico)}<span>${name}</span>${name === "Tasks" ? `<b class="rail-badge" id="railBadge" hidden></b>` : ""}</button>`;

  function mount() {
    const demo = cfg.mode === "demo";
    document.body.insertAdjacentHTML("afterbegin", `
<div class="app" id="app">
  ${demo ? `<div class="demo-bar" role="note">Sample data. Nothing here is saved or sent, and a refresh starts over.</div>` : ""}
  <nav class="rail" aria-label="Sections">
    <div class="rail-mark" aria-hidden="true"><i class="mark sym"></i><i class="mark word"></i></div>
    <div class="rail-nav">${SECTIONS.map(railBtn).join("")}</div>
    <div class="rail-foot">
      ${cfg.auth ? `<button class="rail-btn" type="button" data-action="signout" data-m="hide" title="Sign out">${icon("out")}<span>Sign out</span></button>` : ""}
      <div class="rail-status" id="status"></div>
    </div>
  </nav>
  <header class="top">
    <div class="top-id"><span class="mark word" role="img" aria-label="HEURIAL"></span><div><h1 id="viewTitle">Overview</h1><p id="viewSub"></p></div></div>
    <button class="cmd" type="button" data-action="palette" aria-haspopup="dialog">${icon("search")}<span>Search leads or run a command</span><kbd>${CMD_KEY}</kbd></button>
    <div class="seg" id="rangeSeg" role="group" aria-label="Date range">${RANGES.map(([value, label, long]) => `<button type="button" data-action="range" data-range="${value}" title="${long[0].toUpperCase() + long.slice(1)}${value === "1" || value === "all" ? "" : ", today included"}">${label}</button>`).join("")}</div>
    <button class="btn primary" type="button" id="newBtn" data-action="main">${icon("plus")}<span>New lead</span></button>
  </header>
  <main class="main" id="view" tabindex="-1"></main>

  <aside class="insp" id="insp" hidden aria-labelledby="inspName">
    <header class="insp-head">
      <div class="insp-title"><span id="inspTag"></span><h2 id="inspName" tabindex="-1"></h2><p id="inspSub"></p></div>
      <button class="btn ghost icon" type="button" data-action="insp-close" aria-label="Close the lead panel">${icon("x")}</button>
    </header>
    <dl class="insp-stats" id="inspStats"></dl>
    <div class="tabs" id="inspTabs" role="tablist" aria-label="Lead sections">
      <button class="tab" type="button" role="tab" id="tab-timeline" data-action="tab" data-tab="timeline" aria-controls="linePanel">Timeline</button>
      <button class="tab" type="button" role="tab" id="tab-details" data-action="tab" data-tab="details" aria-controls="leadForm">Details</button>
      <button class="tab" type="button" role="tab" id="tab-messages" data-action="tab" data-tab="messages" aria-controls="msgPanel">Messages<span class="count" id="msgCount" hidden></span></button>
      <button class="tab" type="button" role="tab" id="tab-time" data-action="tab" data-tab="time" aria-controls="timePanel">Time<span class="count" id="timeCount" hidden></span></button>
    </div>

    <section class="insp-panel" id="linePanel" role="tabpanel" aria-labelledby="tab-timeline" hidden>
      <div class="insp-scroll">
        <dl class="tl-facts" id="tlFacts"></dl>
        <form class="tl-ctx" id="ctxForm" novalidate>
          <label class="field"><span>What matters to this client</span><textarea name="notes" rows="3" maxlength="4000" placeholder="What they need, who decides, how they like to be reached…"></textarea></label>
          <div class="tl-ctx-foot"><span class="form-note" id="ctxNote" role="status"></span><button class="btn sm" type="submit" id="ctxSave" disabled>Save</button></div>
        </form>
        <div class="tl-ai" id="tlAi"></div>
        <h3 class="sub-head">Everything with this client, oldest first</h3>
        <ol class="tl" id="tl"></ol>
      </div>
    </section>

    <form class="insp-panel" id="leadForm" role="tabpanel" aria-labelledby="tab-details" novalidate>
      <div class="insp-scroll">
        <fieldset class="fs">
          <legend>Stage</legend>
          <div class="segr" role="radiogroup" aria-label="Stage">${ORDER.map((s) => `<label style="--c:var(${STATUS[s].c})"><input type="radio" name="status" value="${s}"><span>${STATUS[s].label}</span></label>`).join("")}</div>
        </fieldset>
        <fieldset class="fs">
          <legend>Contact</legend>
          <div class="fields">
            <label class="field wide"><span>Name (required)</span><input name="name" maxlength="120" autocomplete="off" aria-describedby="e-name"><small class="field-err" id="e-name" hidden></small></label>
            <label class="field"><span>Business</span><input name="business" maxlength="120" autocomplete="off"></label>
            <label class="field"><span>Source</span><input name="source" list="sourceList" maxlength="60" placeholder="Referral, Website…" autocomplete="off"><datalist id="sourceList"></datalist></label>
            <label class="field"><span>Email</span><input name="email" type="email" maxlength="254" autocomplete="off" aria-describedby="e-email"><small class="field-err" id="e-email" hidden></small></label>
            <label class="field"><span>Phone</span><input name="phone" type="tel" maxlength="40" autocomplete="off"></label>
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend>Dates and value</legend>
          <div class="fields">
            <label class="field"><span>Date booked</span><input name="booked_at" type="date"></label>
            <label class="field"><span>Call date</span><input name="call_at" type="date"></label>
            <label class="field wide"><span>Proposed value (USD)</span><input name="value" type="number" min="0" step="1" inputmode="decimal" aria-describedby="e-value"><small class="field-err" id="e-value" hidden></small></label>
            <label class="field" id="paidField" hidden><span>Paid on</span><input name="paid_at" type="date"></label>
            <p class="field-hint wide" id="paidHint" hidden>The payment is already recorded on Money with its own date and amount. Changing the value or the date here won't change it.</p>
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend>Next action</legend>
          <div class="fields">
            <label class="field"><span>Follow up on</span><input name="follow_up_at" type="date"></label>
            <label class="field"><span>What to do</span><input name="follow_up_note" maxlength="300" placeholder="What to do or say"></label>
          </div>
          <div class="quick">
            <button class="btn sm" type="button" data-fu="1">Tomorrow</button>
            <button class="btn sm" type="button" data-fu="3">In 3 days</button>
            <button class="btn sm" type="button" data-fu="7">In a week</button>
            <button class="btn sm ghost" type="button" data-fu="clear">Clear</button>
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend>What matters to this client</legend>
          <label class="field"><span class="sr">What matters to this client</span><textarea name="notes" rows="4" maxlength="4000" placeholder="What they need, what you discussed…"></textarea></label>
        </fieldset>
      </div>
      <div class="insp-foot">
        <button class="btn danger" type="button" id="delBtn" hidden>Delete</button>
        <span class="form-note" id="leadNote" role="status"></span>
        <button class="btn primary" type="submit" id="saveBtn">Save</button>
      </div>
    </form>

    <section class="insp-panel" id="msgPanel" role="tabpanel" aria-labelledby="tab-messages" hidden>
      <ol class="thread" id="thread" aria-label="Messages with this lead"></ol>
      <form class="compose" id="composeForm" novalidate>
        <div class="segr plain" role="radiogroup" aria-label="Type">${Object.entries(CHANNEL).map(([key, [label]]) => `<label><input type="radio" name="channel" value="${key}" ${key === "note" ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>
        <div class="compose-row" id="composeMeta" hidden>
          <select class="in" name="direction" aria-label="Who wrote it"><option value="out">From me</option><option value="in">From them</option></select>
          <input class="in" name="subject" maxlength="200" placeholder="Subject" aria-label="Subject">
        </div>
        <textarea class="in" name="body" rows="3" maxlength="4000" aria-label="Message" aria-describedby="composeErr"></textarea>
        <small class="field-err" id="composeErr" hidden></small>
        <div class="compose-foot">
          <span class="form-note" id="composeHint"></span>
          <label class="check" id="logOnlyWrap" hidden><input type="checkbox" name="logonly"> Log only, don't send</label>
          <a class="btn sm" id="composeOpen" hidden></a>
          <button class="btn sm" type="button" id="draftBtn" data-action="draft" hidden
            title="Claude writes the next message from this thread. Anything typed above is used as instructions. Nothing is sent until you approve it.">${icon("spark")}<span>Draft with AI</span></button>
          <button class="btn primary sm" type="submit" id="composeBtn">Save note</button>
        </div>
      </form>
    </section>

    <section class="insp-panel" id="timePanel" role="tabpanel" aria-labelledby="tab-time" hidden>
      <form class="lead-time" id="leadTimeForm" novalidate>
        <label class="field"><span>Date</span><input type="date" name="entry_date"></label>
        <label class="field"><span>Hours</span><input type="number" name="hours" min="0.25" max="24" step="0.25" inputmode="decimal" aria-describedby="e-time"></label>
        <label class="field"><span>What you did</span><input type="text" name="note" maxlength="300"></label>
        <button class="btn" type="submit">Log</button>
      </form>
      <small class="field-err" id="e-time" hidden></small>
      <ul class="time-list" id="tList"></ul>
      <p class="time-total" id="tTotal"></p>
    </section>
  </aside>

</div>

<dialog class="palette" id="palette" aria-label="Search and commands">
  <div class="pal-in">${icon("search")}<input id="palInput" type="text" placeholder="Search leads or type a command" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list"><kbd>Esc</kbd></div>
  <div class="pal-list" id="palList" role="listbox" aria-label="Results"></div>
</dialog>

<dialog class="modal lg" id="digestDlg" aria-labelledby="digestSubject">
  <div class="dlg-head"><div><h2 id="digestSubject">Daily email</h2><p>${demo ? "The summary email the tracker sends each morning. On this sample-data page, nothing is ever sent." : "Preview of the daily summary. Nothing is sent until you choose Send now."}</p></div><button class="btn ghost icon" type="button" data-close aria-label="Close">${icon("x")}</button></div>
  <iframe id="digestFrame" title="Email preview" sandbox=""></iframe>
  <div class="dlg-foot"><button class="btn" type="button" data-close>Close</button><button class="btn primary" type="button" id="digestSend">${demo ? "Send (sample)" : "Send now"}</button></div>
</dialog>

<dialog class="modal review" id="reviewDlg" aria-labelledby="reviewTitle">
  <div class="dlg-head"><div><h2 id="reviewTitle">Daily review</h2><p id="reviewStep"></p></div><button class="btn ghost icon" type="button" data-action="review-close" aria-label="Close the review">${icon("x")}</button></div>
  <div class="rv-track" aria-hidden="true"><i id="reviewBar"></i></div>
  <div class="dlg-body" id="reviewBody"></div>
</dialog>

<dialog class="modal" id="confirmDlg" aria-labelledby="confirmTitle" aria-describedby="confirmText">
  <div class="dlg-head"><div><h2 id="confirmTitle"></h2></div></div>
  <div class="dlg-body"><p id="confirmText" class="muted"></p></div>
  <div class="dlg-foot"><button class="btn" type="button" id="confirmNo">Cancel</button><button class="btn primary" type="button" id="confirmYes">Confirm</button></div>
</dialog>

${cfg.auth ? `<div class="signin" id="signin" hidden>
  <form class="signin-card" id="signinForm">
    <div class="signin-brand" role="img" aria-label="HEURIAL"><i class="mark word"></i></div>
    <h1>Sign in to the tracker</h1>
    <label class="field"><span>Password</span><input id="pw" type="password" autocomplete="current-password" required maxlength="200" aria-describedby="signinErr"></label>
    <p class="field-err" id="signinErr" role="alert"></p>
    <button class="btn primary" type="submit" id="signinBtn">Sign in</button>
  </form>
</div>` : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  }

  // ---------- Rendering ----------
  function render() { renderChrome(); renderView(); syncInspector(); }

  function renderChrome() {
    const d = state.data, urgent = d ? urgentCount(d) : 0;
    document.querySelectorAll(".rail-btn[data-view]").forEach((b) => {
      if (sectionOf(state.view)[2][0] === b.dataset.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $("railBadge").hidden = !urgent;
    $("railBadge").textContent = urgent;
    $("railBadge").setAttribute("aria-label", `${urgent} need attention`);
    document.title = `${urgent ? `(${urgent}) ` : ""}${VIEWS[state.view][0]} · HEURIAL tracker${cfg.mode === "demo" ? " (sample data)" : ""}`;
    const [title, sub] = heading(d);
    $("viewTitle").textContent = title;
    $("viewSub").textContent = sub;
    document.querySelectorAll("#rangeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === state.range)));
    // One main action, the one that fits the section. Tasks and Settings don't depend on the date range.
    const main = MAIN[sectionOf(state.view)[0]];
    $("newBtn").hidden = !main;
    if (main) { $("newBtn").querySelector("span").textContent = main; $("newBtn").setAttribute("aria-label", main); }
    $("rangeSeg").hidden = state.view === "tasks" || state.view === "connections";
    renderStatus();
  }

  const MAIN = { Overview: "New lead", Leads: "New lead", Money: "Add transaction", Tasks: "Add task" };
  const SUBTITLE = {
    pipeline: "Every lead by stage. Drag a card to move it, and scroll sideways for more stages.", leads: "Everyone who booked a call, with filters.",
    time: "Hours logged on each lead.", messages: "Notes, calls, emails and texts.", connections: "Appearance, and what the tracker is connected to.",
    money: "What came in, what went out, and what is left.", tasks: "Everything waiting on you.",
  };
  /** The page heading: a greeting and what needs you on Overview, a plain line elsewhere. */
  function heading(d) {
    if (state.view !== "overview") return [sectionOf(state.view)[0], SUBTITLE[state.view] || ""];
    const h = new Date().getHours();
    const hello = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    if (!d) return ["Overview", hello + "."];
    const n = urgentCount(d);
    return ["Overview", `${hello}. ${n ? `${plural(n, "thing needs", "things need")} you today.` : "Nothing is waiting on you."}`];
  }

  /**
   * What feeds the money chart, worked out in money.js: every saved entry (a client's payment is one of them, with
   * its own date and amount), plus any paid lead that has no payment record yet. Each carries its lead when it has one.
   */
  function moneyEntries() {
    const byId = Object.fromEntries((state.all || []).map((l) => [l.id, l]));
    return HeurialMoney.entries(state.all || [], state.tx || []).map((e) => ({ ...e, key: e.id || "lead-" + e.lead_id, lead: byId[e.lead_id] || null }));
  }
  /**
   * The money line for the chosen period. Built from the entries themselves, so the line, the sums under it and
   * the table always agree.
   */
  const moneyPath = () => HeurialMoney.series(moneyEntries(), { today: state.data.today, days: state.range === "all" ? null : Number(state.range) });
  const KIND = {
    income: ["Income", "--up", "↑"], expense: ["Expense", "--down", "↓"], transfer_in: ["Transfer in", "--accent", "→"],
    transfer_out: ["Transfer out", "--mute", "←"], out: ["Needs a category", "--warn", "?"],
  };
  /** An entry's amount with its sign: money in is +, money out is −. */
  const signed = (entry) => `${HeurialMoney.SIGN[entry.kind] < 0 ? "−" : "+"}${money(entry.cents)}`;
  /** What a client has actually paid, from the payment records (and the lead itself where none exists yet). */
  const receivedFrom = (lead) => moneyEntries().filter((e) => e.kind === "income" && e.lead_id === lead.id && e.date <= state.data.today);
  const sentence = (text) => text[0].toUpperCase() + text.slice(1);
  /** Roll the headline figures to their values on first view and whenever they change. */
  const shownStats = {};
  function rollStats() {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".stat, .money-head").forEach((card) => {
      const el = card.querySelector(".stat-v"), key = card.querySelector(".stat-l").textContent, text = el.textContent;
      const to = Number(text.replace(/[^0-9.]/g, "")), from = shownStats[key] ?? 0;
      if (!/\d/.test(text) || /[−-]/.test(text)) return; // a balance below zero is shown as it is, not rolled
      shownStats[key] = to;
      if (still || from === to) return;
      const prefix = text.startsWith("$") ? "$" : "", t0 = performance.now();
      const step = (now) => {
        if (!el.isConnected) return;
        const p = Math.min(1, (now - t0) / 700);
        el.textContent = p === 1 ? text : prefix + Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function renderStatus() {
    const demo = cfg.mode === "demo";
    const dot = demo ? "warn" : state.data && state.online ? "" : state.data ? "off" : "warn";
    const text = demo ? "Sample data · nothing is saved"
      : !state.data ? (state.loading ? "Connecting…" : "Not connected")
      : state.online ? "Connected" : "Offline · showing the last data loaded";
    $("status").innerHTML = `<i class="dot ${dot}"></i><span><b>${text}</b>${state.lastSync ? `Updated ${clock(state.lastSync)}` : ""}</span>
      <button type="button" data-action="refresh" aria-label="Refresh">${icon("refresh")}</button>`;
  }

  const skeleton = () => `<div class="skeleton" aria-busy="true" aria-label="Loading">${"<i></i>".repeat(6)}</div>`;

  function renderView() {
    const view = $("view"), d = state.data;
    const focused = document.activeElement && view.contains(document.activeElement) ? document.activeElement.dataset.fk : "";
    const keep = {}, scroll = {};
    view.querySelectorAll("[data-keep]").forEach((el) => { keep[el.dataset.keep] = el.value; });
    view.querySelectorAll("[data-scroll]").forEach((el) => { scroll[el.dataset.scroll] = [el.scrollLeft, el.scrollTop]; });

    let html = state.error ? `<div class="banner" role="alert"><span>${esc(state.error)}</span><button class="btn sm" type="button" data-action="refresh">Try again</button></div>` : "";
    if (!d) html += state.loading ? `<div class="vw pane">${skeleton()}</div>` : "";
    else {
      // A section with several screens (Leads) gets a row of tabs to move between them.
      const tabs = sectionOf(state.view)[2];
      if (tabs.length > 1) html += `<div class="seg sect-tabs" role="group" aria-label="${sectionOf(state.view)[0]} screens">${tabs.map((key) => `<button type="button" data-action="view" data-view="${key}" data-fk="sect-${key}" aria-pressed="${key === state.view}">${TAB_NAME[key]}</button>`).join("")}</div>`;
      html += { overview: viewOverview, money: viewMoney, pipeline: viewPipeline, leads: viewLeads, time: viewTime, messages: viewMessages, tasks: viewTasks, connections: viewConnections }[state.view]();
    }
    // Where each board card sits now, so one that changes column can travel to its new place.
    const was = new Map([...view.querySelectorAll(".board .card[data-id]")].map((el) => [el.dataset.id, el.getBoundingClientRect()]));
    if (flyFrom) was.set(flyFrom.id, flyFrom.box);
    flyFrom = null;
    view.innerHTML = html;

    view.querySelectorAll("[data-keep]").forEach((el) => { if (keep[el.dataset.keep]) el.value = keep[el.dataset.keep]; });
    view.querySelectorAll("[data-scroll]").forEach((el) => { const s = scroll[el.dataset.scroll]; if (s) { el.scrollLeft = s[0]; el.scrollTop = s[1]; } });
    if (focused) {
      const el = [...view.querySelectorAll("[data-fk]")].find((x) => x.dataset.fk === focused);
      if (el) {
        el.focus({ preventScroll: true });
        if (el.tagName === "INPUT" && el.type === "search") el.setSelectionRange(el.value.length, el.value.length);
      }
    }
    if (d && (state.view === "overview" || state.view === "money")) { drawChart(); rollStats(); }
    if (was.size && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of view.querySelectorAll(".board .card[data-id]")) {
        const a = was.get(el.dataset.id), b = el.getBoundingClientRect();
        if (!a || Math.abs(a.left - b.left) + Math.abs(a.top - b.top) < 2) continue;
        const across = Math.abs(a.left - b.left) > 40; // it changed column: lift it on the way over
        if (across) el.classList.add("is-moving");
        el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: across ? 640 : 320, easing: "cubic-bezier(.2, .7, .3, 1)" })
          .onfinish = () => el.classList.remove("is-moving");
      }
    }
  }

  // ----- Overview -----
  /** What needs doing today, as one short list: new inquiries, calls that need a status, and follow-ups that are due. */
  function todayItems(d) {
    const open = (id) => `data-action="open" data-id="${id}"`;
    return [
      ...d.inbox.map((i) => ({ key: "i" + i.id, when: ago(i.created_at), cls: "new", title: `Reply to ${i.name}`, sub: i.source, act: `data-action="view" data-view="tasks"` })),
      ...d.stale.map((x) => ({ key: "s" + x.id, when: niceDate(x.call_at), cls: "late", title: `Record the call with ${x.name}`, sub: "Still marked as booked", act: open(x.id) })),
      ...dueTasks(d).map((t) => ({ key: "t" + t.id, ...due(t.due_at), when: due(t.due_at).text, title: t.title, sub: "Your task", act: `data-action="view" data-view="tasks"` })),
      ...d.followups.filter((f) => f.follow_up_at <= d.today).map((f) => ({ key: "f" + f.id, ...due(f.follow_up_at), when: due(f.follow_up_at).text, title: f.follow_up_note || "Follow up", sub: f.name, act: open(f.id) })),
    ];
  }
  /** Dates inside a sentence from the back end ("2026-11-08") read the way the rest of the tracker writes them. */
  const prettyDates = (s) => String(s).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (x) => niceDate(x));
  /** The soonest thing with a date after today: a follow-up or one of your tasks. */
  function nextCommitment(d) {
    const items = [
      ...d.followups.filter((f) => f.follow_up_at > d.today).map((f) => ({ date: f.follow_up_at, text: `${f.follow_up_note || "Follow up"} (${f.name})` })),
      ...(state.tasks || []).filter((t) => !t.done_at && t.due_at > d.today).map((t) => ({ date: t.due_at, text: t.title })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return items[0] ? `Next commitment: ${at(items[0].date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}, ${items[0].text}.` : "";
  }
  /** The buttons that finish a suggestion. Each one is an action the tracker already had. */
  function nextButtons(n) {
    const b = (cls, attrs, label, fk) => `<button class="btn ${cls}" type="button" ${attrs} data-fk="nx-${fk}">${label}</button>`;
    const open = n.lead_id ? b("", `data-action="open" data-id="${n.lead_id}"`, "Open client", "open") : "";
    switch (n.kind) {
      case "followup": return b("primary", `data-action="open" data-id="${n.lead_id}" data-tab="messages"`, n.has_draft ? "Review draft" : "Write follow-up", "a")
        + b("", `data-action="fu" data-days="1" data-id="${n.lead_id}"`, "Tomorrow", "b") + b("", `data-action="fu" data-days="done" data-id="${n.lead_id}"`, "Mark done", "c") + open;
      case "task": return b("primary", `data-action="task-toggle" data-done="1" data-id="${n.task_id}"`, "Mark done", "a") + b("", `data-action="task-due" data-days="1" data-id="${n.task_id}"`, "Tomorrow", "b")
        + b("", `data-action="view" data-view="tasks"`, "Open Tasks", "c");
      case "inquiry": return b("primary", `data-action="inbox-convert" data-id="${n.inquiry_id}"`, "Add to pipeline", "a") + b("", `data-action="view" data-view="tasks"`, "Read it in Tasks", "b");
      case "call": return b("primary", `data-action="stale" data-status="held" data-id="${n.lead_id}"`, "Call held", "a") + b("", `data-action="stale" data-status="no_show" data-id="${n.lead_id}"`, "No-show", "b") + open;
      default: return b("primary", `data-action="prop-fu" data-id="${n.lead_id}"`, "Follow up in 3 days", "a") + open;
    }
  }
  /** One thing to do next, picked by fixed rules in the back end (core.nextMoves), with why and what it is based on. */
  function nextPane() {
    const list = state.next || [], d = state.data;
    if (!list.length) {
      return `<section class="pane next is-clear" aria-labelledby="nextTitle"><p class="eyebrow">Your next move</p>
    <h2 id="nextTitle">Nothing is waiting on you</h2>
    <p class="next-why">No overdue follow-ups or tasks, no unanswered inquiries, no calls to record and nothing due today. ${esc(nextCommitment(d))}</p></section>`;
    }
    const i = Math.min(state.nextAt, list.length - 1), n = list[i];
    return `<section class="pane next" aria-labelledby="nextTitle"><p class="eyebrow">Your next move</p>
    <h2 id="nextTitle">${esc(n.title)}</h2>
    <p class="next-why">${esc(n.reason)}</p>
    <ul class="next-ev" aria-label="What this is based on">${n.evidence.map((e) => `<li><span>${esc(prettyDates(e.label))}</span>${esc(e.text)}</li>`).join("")}</ul>
    <div class="next-acts">${nextButtons(n)}</div>
    <p class="next-rule">${list.length > 1 ? `${i + 1} of ${list.length}. ` : ""}Picked by fixed rules: overdue promises first, then new inquiries, calls to record, what is due today, and proposals with no next step.
      ${list.length > 1 ? `<button class="more" type="button" data-action="next-skip" data-fk="nx-skip">Show the next one</button>` : ""}</p>
  </section>`;
  }
  function viewOverview() {
    const d = state.data, urgent = urgentCount(d), today = todayItems(d);
    const late = (l) => l.follow_up_at || "9999";
    const open = (state.all || []).filter((l) => OPEN.includes(l.status)).sort((a, b) => late(a).localeCompare(late(b)) || b.value_cents - a.value_cents);
    return `<div class="vw ov">
  ${nextPane()}
  ${moneyPane(false)}
  <section class="pane ov-today" aria-labelledby="todayTitle">
    <div class="pane-head"><h2 id="todayTitle">Today</h2>${urgent ? `<span class="count hot">${urgent}</span>` : ""}<span class="pane-meta">${urgentParts(d)}</span></div>
    <div class="pane-body">${today.length ? `<ul class="todo">${today.slice(0, 5).map((x) => `<li><button class="todo-row" type="button" ${x.act} data-fk="td-${x.key}">
        <span class="q-when ${x.cls}">${esc(x.when)}</span><span class="todo-t">${esc(x.title)}<small>${esc(x.sub || "")}</small></span></button></li>`).join("")}</ul>`
      : `<div class="empty"><b>Nothing needs you today.</b>No new inquiries, no calls to record, and no follow-ups or tasks due.</div>`}
      <button class="more" type="button" data-action="view" data-view="tasks" data-fk="all-tasks">${today.length > 5 ? `All ${today.length} in Tasks` : "Open Tasks"} →</button></div>
  </section>
  <section class="pane ov-leads" aria-labelledby="leadsTitle">
    <div class="pane-head"><h2 id="leadsTitle">Active leads</h2><span class="pane-meta">${open.length} open · ${money(open.reduce((a, l) => a + l.value_cents, 0))} proposed, not received</span></div>
    <div class="pane-body">${open.length ? `<ul class="todo">${open.slice(0, 5).map((l) => `<li><button class="todo-row is-lead" type="button" data-action="open" data-id="${l.id}" data-fk="ol-${l.id}">
        <span class="todo-t">${esc(l.business || l.name)}<small>${esc(l.follow_up_at ? l.follow_up_note || "Follow up" : "No next step set")}</small></span>
        <span class="num">${l.value_cents ? money(l.value_cents) : ""}</span>${l.follow_up_at ? dueTag(l.follow_up_at) : `<span class="due">–</span>`}</button></li>`).join("")}</ul>`
      : `<div class="empty">No open leads.</div>`}
      <button class="more" type="button" data-action="view" data-view="pipeline" data-fk="all-leads">Open the lead board →</button></div>
  </section>
</div>`;
  }
  /**
   * The money card: the balance, how the chosen period changed it, the line, and the entries behind a chosen point.
   * `full` (the Money screen) adds the period's sums by kind. "Balance change" includes transfers; profit doesn't.
   */
  function moneyPane(full) {
    const m = moneyPath(), gain = m.total - m.start, profit = m.earned - m.spent;
    const title = m.transfers ? "Balance" : "Total received";
    const change = !m.steps.length && !m.start ? "No money recorded yet"
      : !m.steps.length ? `No change ${inPeriod()}`
      : `<span class="money-k">Balance change</span><b${gain < 0 ? ` class="is-down"` : ""}>${gain < 0 ? "▼" : "▲"} ${money(Math.abs(gain))}</b> ${inPeriod()}`;
    const earned = m.steps.length && m.transfers ? `<p class="money-d"><span class="money-k">Profit</span><b class="${profit < 0 ? "is-down" : ""}">${money(profit)}</b> income minus expenses</p>` : "";
    const label = `${title} ${money(m.total)}. ${m.steps.length ? `Balance ${gain < 0 ? "down" : "up"} ${money(Math.abs(gain))} ${inPeriod()}. Profit ${money(profit)}` : `No change ${inPeriod()}`}`;
    const cell = (kind, name, cents) => `<div><i style="--c:var(${KIND[kind][1]})" aria-hidden="true">${KIND[kind][2]}</i><span>${name}</span><b>${money(cents)}</b></div>`;
    const flow = full && m.steps.length ? `<div class="flow">${cell("income", "Income", m.earned)}${cell("expense", "Expenses", m.spent)}${cell("transfer_in", "Transfers in", m.moved_in)}${cell("transfer_out", "Transfers out", m.moved_out)}${m.unsorted ? cell("out", "Needs a category", m.unsorted) : ""}</div>
    <p class="recon">${niceDate(m.first)} closed at ${money(m.start)}. Plus ${money(m.earned)} income, minus ${money(m.spent)} expenses, plus ${money(m.moved_in)} in, minus ${money(m.moved_out)} out${m.unsorted ? `, minus ${money(m.unsorted)} not yet categorised` : ""}: ${money(m.total)} today. Transfers change the balance, not the profit.</p>` : "";
    return `<section class="pane ov-money" aria-labelledby="moneyTitle">
    <div class="money-head">
      <div><h2 class="stat-l" id="moneyTitle">${title}</h2><b class="stat-v">${money(m.total)}</b><p class="money-d">${change}</p>${earned}</div>
      <div class="read" id="chartRead"></div>
    </div>
    <div class="chart" id="chart" tabindex="0" role="group" aria-label="${esc(label)}. Left and right arrow keys step through the entries; Escape clears the choice."></div>
    <div class="pick" id="chartPick" aria-live="polite"></div>
    ${flow}
  </section>`;
  }

  // ----- Money -----
  /** The balance and chart, the add bar, every entry behind the line with its client, what is scheduled, and the reports. */
  function viewMoney() {
    const d = state.data, m = moneyPath(), tab = state.moneyTab, all = moneyEntries();
    const inTab = (e) => tab === "all" || (tab === "transfers" ? e.kind === "transfer_in" || e.kind === "transfer_out" : tab === "expense" ? e.kind === "expense" || e.kind === "out" : e.kind === tab);
    const rows = m.steps.slice().reverse().map((x) => x.entry).filter(inTab);
    const tabs = [["all", "All"], ["income", "Income"], ["expense", "Expenses"], ["transfers", "Transfers"]];
    // Entries dated after today are not in the balance, the chart or the sums. They get a list of their own.
    const ahead = all.filter((e) => e.date > d.today).sort((a, b) => a.date.localeCompare(b.date));
    const derived = all.filter((e) => e.derived), undated = derived.filter((e) => e.undated).length, dated = derived.length - undated;
    const client = (e) => (e.lead
      ? `<button class="who" type="button" data-action="open" data-id="${e.lead.id}" data-fk="tx-${e.key}">${esc(e.lead.name)}${e.lead.business ? `<span> · ${esc(e.lead.business)}</span>` : ""}</button>`
      : `<span class="faint">${e.lead_id ? "Client removed" : "–"}</span>`);
    const kind = (e, future) => (e.kind === "out" && e.id && has("money")
      ? `<select class="in sm" data-change="tx-kind" data-id="${e.id}" data-fk="xk-${e.id}" aria-label="Category for ${esc(e.label)}"><option value="">Needs a category…</option><option value="expense">Expense</option><option value="transfer_out">Transfer out</option></select>`
      : `<span class="kind" style="--c:var(${future ? "--mute" : KIND[e.kind][1]})">${KIND[e.kind][2]} ${KIND[e.kind][0]}</span>`);
    const line = (e, future) => `<tr id="tx-${e.key}" class="${future ? "is-future" : ""}${state.txFocus === e.key ? " is-touched" : ""}"><td class="n">${niceDate(e.date)}</td>
        <td>${esc(e.label)}${e.derived ? `<span class="faint"> · read from the lead${e.undated ? ", no paid date" : ""}</span>` : ""}</td><td>${client(e)}</td><td>${kind(e, future)}</td>
        <td class="r amt${HeurialMoney.SIGN[e.kind] < 0 ? " out" : ""}">${signed(e)}</td>
        <td class="r">${e.id ? `<button class="btn ghost sm icon" type="button" data-action="tx-del" data-id="${e.id}" data-fk="xd-${e.id}" aria-label="Delete ${esc(e.label)}, ${signed(e)}">${icon("x")}</button>` : ""}</td></tr>`;
    const head = `<thead><tr><th>Date</th><th>Description</th><th>Client</th><th>Type</th><th class="r">Amount</th><th><span class="sr">Delete</span></th></tr></thead>`;
    const leads = [...(state.all || [])].sort((a, b) => a.name.localeCompare(b.name));
    const add = has("money") ? `<form class="pane tm-add" data-submit="tx-add" novalidate aria-label="Add a transaction">
    <div class="time-row is-tx">
      <label class="field"><span>Type</span><select name="kind" data-keep="x-kind" data-fk="x-kind"><option value="income">Income</option><option value="expense">Expense</option><option value="transfer_in">Transfer in</option><option value="transfer_out">Transfer out</option></select></label>
      <label class="field"><span>Date</span><input type="date" name="date" data-keep="x-date" data-fk="x-date" value="${d.today}"></label>
      <label class="field"><span>Amount</span><input type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" data-keep="x-amt" data-fk="x-amt"></label>
      <label class="field"><span>Description</span><input type="text" name="label" maxlength="120" data-keep="x-label" data-fk="x-label"></label>
      <label class="field"><span>Client (income only)</span><select name="lead_id" data-keep="x-lead" data-fk="x-lead"><option value="">No client</option>${leads.map((l) => `<option value="${l.id}">${esc(l.name)}${l.business ? ` · ${esc(l.business)}` : ""}</option>`).join("")}</select></label>
      <button class="btn primary" type="submit" data-fk="x-submit">${icon("plus")}Add</button>
    </div>
    <p class="field-err foot-note" id="txAddErr" role="alert" hidden></p>
  </form>` : `<p class="foot-note setup-note">Adding transactions is off until the Transactions table exists. The steps are in catalyst/TRACKER-SETUP.md.</p>`;
    const rtabs = [["conversion", "Conversion"], ["sources", "Sources"], ["rates", "Earned per hour"]];
    return `<div class="vw mn">
  ${moneyPane(true)}
  ${add}
  <section class="pane" aria-labelledby="txTitle">
    <div class="pane-head"><h2 id="txTitle">Received and spent</h2><span class="pane-meta">${sentence(inPeriod())}${m.steps.length ? ` · ${plural(m.steps.length, "entry", "entries")}` : ""}</span>
      <div class="pane-tools"><div class="tabs" role="tablist" aria-label="Type">${tabs.map(([key, name]) => `<button class="tab" type="button" role="tab" data-action="moneytab" data-tab="${key}" data-fk="mt-${key}" aria-selected="${tab === key}">${name}</button>`).join("")}</div></div></div>
    ${dated && has("money") ? `<div class="strip"><span>${plural(dated, "payment")} from before payments were kept as records still ${dated === 1 ? "follows its" : "follow their"} lead, so editing the lead changes ${dated === 1 ? "it" : "them"}. Recording ${dated === 1 ? "it" : "them"} uses each lead's own paid date and value.</span>
      <button class="btn sm" type="button" data-action="backfill" data-fk="backfill">Record ${dated === 1 ? "it" : `all ${dated}`}</button></div>` : ""}
    <div class="pane-body">${rows.length ? `<table class="tbl">${head}<tbody>${rows.map((e) => line(e, false)).join("")}</tbody></table>`
      : `<div class="empty"><b>Nothing here ${inPeriod()}.</b>When you move a lead to Paid, its payment is recorded here as income.</div>`}
    ${undated ? `<p class="foot-note">${plural(undated, "paid lead has", "paid leads have")} no paid date, so ${undated === 1 ? "it sits" : "they sit"} on the day the call was booked and ${undated === 1 ? "is" : "are"} not recorded as ${undated === 1 ? "a payment" : "payments"}. Open the lead and fill in Paid on: nothing is dated for you.</p>` : ""}</div>
  </section>
  ${ahead.length ? `<section class="pane" aria-labelledby="schedTitle">
    <div class="pane-head"><h2 id="schedTitle">Scheduled</h2><span class="pane-meta">Dated after today. Not in the balance, the chart or the sums until the day comes.</span></div>
    <div class="pane-body"><table class="tbl">${head}<tbody>${ahead.map((e) => line(e, true)).join("")}</tbody></table></div>
  </section>` : ""}
  <section class="pane ov-tabs" aria-label="Reports">
    <div class="pane-head"><h2>Reports</h2><span class="pane-meta">Leads booked ${inPeriod()}</span><div class="pane-tools"><div class="tabs" role="tablist" aria-label="Reports">${rtabs.map(([key, name]) => `<button class="tab" type="button" role="tab" data-action="ovtab" data-tab="${key}" data-fk="ov-${key}" aria-selected="${state.ovTab === key}">${name}</button>`).join("")}</div></div></div>
    <div class="pane-body" role="tabpanel">${{ conversion: reportFunnel, sources: reportSources, rates: reportRates }[state.ovTab]()}</div>
  </section>
</div>`;
  }

  // ----- Tasks -----
  /** Everything a daily review walks through, in order. Each item is looked up fresh when its turn comes. */
  function reviewQueue(d) {
    return [
      ...d.inbox.map((i) => ({ type: "inquiry", id: i.id })),
      ...d.stale.map((s) => ({ type: "call", id: s.id })),
      ...d.followups.filter((f) => f.follow_up_at <= d.today).map((f) => ({ type: "followup", id: f.id })),
      ...dueTasks(d).map((t) => ({ type: "task", id: t.id })),
      ...(has("money") ? (state.tx || []).filter((t) => t.kind === "out").map((t) => ({ type: "tx", id: t.id })) : []),
    ];
  }
  /** Everything waiting on you, with its buttons, beside the follow-ups that are further out. */
  function viewTasks() {
    const d = state.data, urgent = urgentCount(d), queue = reviewQueue(d), sort = queue.filter((q) => q.type === "tx").length;
    const later = d.followups.filter((f) => f.follow_up_at > addDays(d.today, 7));
    const mine = state.tasks || [], tab = state.taskTab, shown = mine.filter((t) => (tab === "done") === Boolean(t.done_at));
    const tabs = [["open", "Open", mine.filter((t) => !t.done_at).length], ["done", "Completed", mine.filter((t) => t.done_at).length]];
    const parts = [urgentParts(d), sort && plural(sort, "transaction to categorise", "transactions to categorise")].filter(Boolean).join(" · ");
    return `<div class="vw tk">
  <section class="pane review-bar" aria-labelledby="needTitle">
    <div><h2 id="needTitle">Needs attention${urgent ? ` <span class="count hot">${urgent}</span>` : ""}</h2><p>${parts || "Nothing is overdue or due today."}</p></div>
    <button class="btn primary" type="button" data-action="review-start" data-fk="review" ${queue.length ? "" : "disabled"}>${queue.length ? `Start daily review · ${queue.length}` : "Nothing to review"}</button>
  </section>
  <div class="tk-main">
  <section class="pane" aria-labelledby="mineTitle">
    <div class="pane-head"><h2 id="mineTitle">Your tasks</h2>
      <div class="pane-tools"><div class="tabs" role="tablist" aria-label="Show">${tabs.map(([key, name, n]) => `<button class="tab" type="button" role="tab" data-action="tasktab" data-tab="${key}" data-fk="kt-${key}" aria-selected="${tab === key}">${name}<span class="count">${n}</span></button>`).join("")}</div></div></div>
    ${has("tasks") ? `<form data-submit="task-add" novalidate aria-label="Add a task">
      <div class="time-row is-task">
        <label class="field"><span>Task</span><input type="text" name="title" maxlength="200" data-keep="k-title" data-fk="k-title"></label>
        <label class="field"><span>Due (optional)</span><input type="date" name="due_at" data-keep="k-due" data-fk="k-due"></label>
        <button class="btn" type="submit" data-fk="k-submit">${icon("plus")}Add task</button>
      </div>
      <p class="field-err foot-note" id="taskAddErr" role="alert" hidden></p>
    </form>` : `<p class="foot-note setup-note">Adding tasks is off until the Tasks table exists. The steps are in catalyst/TRACKER-SETUP.md.</p>`}
    <div class="pane-body">${shown.length ? `<ul class="task-list">${shown.map((t) => `<li class="task${t.done_at ? " is-done" : ""}">
        <button class="task-box" type="button" role="checkbox" aria-checked="${Boolean(t.done_at)}" data-action="task-toggle" data-id="${t.id}" data-done="${t.done_at ? "" : "1"}" data-fk="tk-${t.id}" aria-label="${t.done_at ? "Reopen" : "Finish"}: ${esc(t.title)}"><i>${icon("check")}</i></button>
        <span class="task-t">${esc(t.title)}</span>
        ${t.done_at ? `<span class="due">Done ${niceDate(t.done_at)}</span>` : t.due_at ? dueTag(t.due_at) : ""}
        <button class="btn ghost sm icon" type="button" data-action="task-del" data-id="${t.id}" data-fk="tkd-${t.id}" aria-label="Delete task: ${esc(t.title)}">${icon("x")}</button></li>`).join("")}</ul>`
      : `<div class="empty">${tab === "done" ? "Nothing finished yet." : has("tasks") ? "No tasks of your own. Add one above." : "No tasks of your own."}</div>`}</div>
  </section>
  <section class="pane" aria-labelledby="queueTitle">
    <div class="pane-head"><h2 id="queueTitle">From your leads</h2>
      <div class="pane-tools"><button class="btn ghost sm" type="button" data-action="digest" data-fk="digest">${icon("mail")}Daily email</button></div></div>
    <div class="pane-body" data-scroll="queue">${queueHtml()}</div>
  </section>
  </div>
  <section class="pane" aria-labelledby="laterTitle">
    <div class="pane-head"><h2 id="laterTitle">Later follow-ups</h2>${later.length ? `<span class="count">${later.length}</span>` : ""}</div>
    <div class="pane-body">${later.length ? later.map((f) => `<div class="q-row">
        <span class="q-when">${niceDate(f.follow_up_at)}</span>
        <div class="q-main"><button class="who" type="button" data-action="open" data-id="${f.id}" data-fk="up-${f.id}">${esc(f.name)}${f.business ? `<span> · ${esc(f.business)}</span>` : ""}</button><p>${esc(f.follow_up_note || "Follow up")}</p></div>
      </div>`).join("") : `<div class="empty">Nothing scheduled after this week.</div>`}</div>
  </section>
</div>`;
  }

  // ----- AI help, inside the work -----
  // Each request is kept under a key ("inq-ID", "lead-ID-catch_up"), so its answer shows where it was asked for.
  // Without AI connected the buttons aren't shown, and nothing else depends on them.
  const aiButton = (key, kind, id, label) => (has("assist")
    ? `<button class="btn ghost sm" type="button" data-action="assist" data-key="${key}" data-kind="${kind}" data-id="${id}" data-fk="ai-${key}" ${state.ai[key] && state.ai[key].loading ? "disabled" : ""}>${icon("spark")}${label}</button>` : "");
  function aiBox(key) {
    const a = state.ai[key];
    if (!a) return "";
    if (a.loading) return `<div class="ai-box" role="status">Reading the records…</div>`;
    if (a.error) return `<div class="ai-box err" role="alert"><p class="ai-t">${esc(a.error)} Everything here works without it.</p></div>`;
    const r = a.result;
    return `<div class="ai-box"><p class="ai-h">${icon("spark")}<span>${cfg.mode === "demo" ? "Sample output, not written by AI" : "Written by AI from your records. Check it against them."}</span>
        <button class="btn ghost sm icon" type="button" data-action="assist-close" data-key="${key}" aria-label="Close">${icon("x")}</button></p>
      ${r.text ? `<p class="ai-t">${esc(r.text)}</p>` : ""}
      ${r.tasks.length ? `<ul class="ai-tasks">${r.tasks.map((t, i) => `<li><span>${esc(t.title)}${t.due_at ? ` · due ${niceDate(t.due_at)}` : ""}</span>
        ${t.added ? `<span class="due">Added</span>` : has("tasks") ? `<button class="btn sm" type="button" data-action="assist-add" data-key="${key}" data-i="${i}">Add task</button>` : ""}</li>`).join("")}</ul>` : ""}
      <details class="ai-src"><summary>Based on ${plural(r.sources.length, "record")}</summary><ul>${r.sources.map((s) => `<li><b>${esc(prettyDates(s.label))}</b>${esc(s.text)}</li>`).join("")}</ul></details></div>`;
  }
  /** Redraw wherever an AI answer can be showing. */
  function paintAi() {
    renderView();
    if (!$("insp").hidden && state.tab === "timeline") paintTimeline();
    if (state.review) paintReview();
  }
  async function runAssist(key, kind, id) {
    state.ai[key] = { loading: true };
    paintAi();
    try {
      state.ai[key] = { result: await call("/api/assist", "POST", kind === "inquiry_summary" ? { kind, inquiry_id: id } : { kind, lead_id: id }) };
    } catch (err) {
      state.ai[key] = { error: err.message || "The AI couldn't do that just now." };
    }
    paintAi();
  }

  // ----- Daily review: one item at a time, then an honest count of what happened -----
  const REVIEW = {
    inquiry: ["New inquiry", (d, id) => d.inbox.find((x) => x.id === id)], call: ["Call needing an outcome", (d, id) => d.stale.find((x) => x.id === id)],
    followup: ["Follow-up due", (d, id) => d.followups.find((x) => x.id === id)], task: ["Your task", (d, id) => (state.tasks || []).find((x) => x.id === id)],
    tx: ["Transaction to categorise", (d, id) => (state.tx || []).find((x) => x.id === id)],
  };
  function startReview() {
    const queue = reviewQueue(state.data);
    if (!queue.length) return;
    state.review = { queue, at: 0, tally: { completed: 0, rescheduled: 0, reviewed: 0 }, changed: false };
    paintReview();
    $("reviewDlg").showModal();
  }
  function paintReview() {
    const R = state.review, d = state.data, body = $("reviewBody");
    if (!R) return;
    const total = R.queue.length, finished = R.at >= total;
    $("reviewBar").style.width = `${(Math.min(R.at, total) / total) * 100}%`;
    if (finished) {
      const left = urgentCount(d), t = R.tally;
      $("reviewStep").textContent = `${plural(total, "item")} gone through`;
      body.innerHTML = `<div class="rv-card"><p class="eyebrow">Review complete</p>
        <ul class="rv-sum"><li><b>${t.completed}</b>completed</li><li><b>${t.rescheduled}</b>moved to a later day</li><li><b>${t.reviewed}</b>looked at and left as ${t.reviewed === 1 ? "it is" : "they are"}</li><li><b>0</b>sent: nothing is sent from the review</li></ul>
        <p class="rv-why">${left ? `${plural(left, "item still needs", "items still need")} attention today.` : "Nothing is overdue or due today now."} ${esc(nextCommitment(d))}</p>
        <div class="rv-acts"><button class="btn primary" type="button" data-action="review-close">Done</button></div></div>`;
      return;
    }
    const q = R.queue[R.at], [group, find] = REVIEW[q.type], x = find(d, q.id);
    $("reviewStep").textContent = `${R.at + 1} of ${total} · ${group}`;
    const b = (what, label, cls) => `<button class="btn ${cls || ""}" type="button" data-action="review-do" data-do="${what}">${label}</button>`;
    const skip = b("skip", "Skip for now", "ghost");
    let card;
    if (!x) card = `<h3>This one was already handled.</h3><div class="rv-acts">${b("skip", "Next", "primary")}</div>`;
    else if (q.type === "inquiry") card = `<h3>${esc(x.name)}${x.company ? ` · ${esc(x.company)}` : ""}</h3><p class="rv-why">${esc(x.source)} · ${ago(x.created_at)}</p><blockquote>${esc(x.message)}</blockquote>
      ${aiBox(`inq-${x.id}`)}<div class="rv-acts">${b("convert", "Add to pipeline", "primary")}${b("dismiss", "Dismiss")}${aiButton(`inq-${x.id}`, "inquiry_summary", x.id, "Summarize")}${skip}</div>`;
    else if (q.type === "call") card = `<h3>Did the call with ${esc(x.name)} happen?</h3><p class="rv-why">${x.business ? `${esc(x.business)} · ` : ""}Call date ${niceDate(x.call_at)}, still marked as booked.</p>
      <div class="rv-acts">${b("held", "Call held", "primary")}${b("no_show", "No-show")}${skip}</div>`;
    else if (q.type === "followup") card = `<h3>${esc(x.follow_up_note || "Follow up")}</h3><p class="rv-why">${esc(x.name)}${x.business ? ` · ${esc(x.business)}` : ""} · ${due(x.follow_up_at).long}</p>
      <div class="rv-acts">${b("done", "Done", "primary")}${b("tomorrow", "Tomorrow")}${b("week", "In a week")}${skip}</div>`;
    else if (q.type === "task") card = `<h3>${esc(x.title)}</h3><p class="rv-why">Your task · ${due(x.due_at).long}</p>
      <div class="rv-acts">${b("task-done", "Done", "primary")}${b("task-tomorrow", "Tomorrow")}${skip}</div>`;
    else card = `<h3>${esc(x.label)}</h3><p class="rv-why">${money(x.amount_cents)} left the balance on ${niceDate(x.date)}. Was it a business expense, or money you took out?</p>
      <div class="rv-acts">${b("expense", "Business expense", "primary")}${b("transfer_out", "Transfer out")}${skip}</div>`;
    body.innerHTML = `<div class="rv-card"><p class="eyebrow">${group}</p>${card}</div>`;
    const first = body.querySelector(".rv-acts .btn");
    if (first && $("reviewDlg").open) first.focus();
  }
  async function reviewDo(what) {
    const R = state.review, q = R.queue[R.at], d = state.data;
    const lead = (body) => call("/api/leads/" + q.id, "PATCH", body);
    const held = () => { const row = d.stale.find((s) => s.id === q.id); return lead({ status: "held", ...(row && row.follow_up_at ? {} : { follow_up_at: addDays(d.today, FOLLOW_PLAN.held[0]), follow_up_note: FOLLOW_PLAN.held[1] }) }); };
    const run = {
      convert: () => call(`/api/inbox/${q.id}/convert`, "POST"), dismiss: () => call(`/api/inbox/${q.id}/dismiss`, "POST"),
      held, no_show: () => lead({ status: "no_show" }),
      done: () => lead({ follow_up_at: "", follow_up_note: "" }), tomorrow: () => lead({ follow_up_at: addDays(d.today, 1) }), week: () => lead({ follow_up_at: addDays(d.today, 7) }),
      "task-done": () => call("/api/tasks/" + q.id, "PATCH", { done: true }), "task-tomorrow": () => call("/api/tasks/" + q.id, "PATCH", { due_at: addDays(d.today, 1) }),
      expense: () => call("/api/transactions/" + q.id, "PATCH", { kind: "expense" }), transfer_out: () => call("/api/transactions/" + q.id, "PATCH", { kind: "transfer_out" }),
    }[what];
    if (run) { await run(); R.changed = true; } // a failure throws here: the item stays up and nothing is counted
    R.tally[!run ? "reviewed" : ["tomorrow", "week", "task-tomorrow"].includes(what) ? "rescheduled" : "completed"]++;
    R.at++;
    if (R.at >= R.queue.length && R.changed) await load(); // the closing count is read from fresh data
    paintReview();
  }
  function closeReview() {
    const R = state.review;
    state.review = null;
    if ($("reviewDlg").open) $("reviewDlg").close();
    if (R && R.changed) load();
  }

  function queueHtml() {
    const d = state.data, t = d.today;
    const upcoming = d.followups.filter((f) => f.follow_up_at <= addDays(t, 7));
    const who = (id, name, biz) => `<button class="who" type="button" data-action="open" data-id="${id}" data-fk="who-${id}">${esc(name)}${biz ? `<span> · ${esc(biz)}</span>` : ""}</button>`;
    let html = "";
    if (d.inbox.length) {
      html += `<h3 class="q-title">New from the website <span class="count">${d.inbox.length}</span></h3>` + d.inbox.map((i) => `
        <div class="q-row new">
          <span class="q-when new">${ago(i.created_at)}</span>
          <div class="q-main"><span class="who">${esc(i.name)}${i.company ? `<span> · ${esc(i.company)}</span>` : ""}</span>
            <p>${esc(i.source)}</p><p class="q-quote">${esc(i.message)}</p></div>
          <div class="q-acts"><button class="btn sm primary" type="button" data-action="inbox-convert" data-id="${i.id}" data-fk="conv-${i.id}">Add to pipeline</button>
            <button class="btn sm" type="button" data-action="inbox-dismiss" data-id="${i.id}" data-fk="dis-${i.id}">Dismiss</button>
            ${aiButton(`inq-${i.id}`, "inquiry_summary", i.id, "Summarize")}</div>
          ${aiBox(`inq-${i.id}`)}
        </div>`).join("");
    }
    if (d.stale.length) {
      html += `<h3 class="q-title">Calls to update <span class="count">${d.stale.length}</span></h3>` + d.stale.map((s) => `
        <div class="q-row late">
          <span class="q-when late">${niceDate(s.call_at)}</span>
          <div class="q-main">${who(s.id, s.name, s.business)}<p>Still marked as booked. Did this call happen?</p></div>
          <div class="q-acts"><button class="btn sm" type="button" data-action="stale" data-status="held" data-id="${s.id}" data-fk="held-${s.id}">Call held</button>
            <button class="btn sm" type="button" data-action="stale" data-status="no_show" data-id="${s.id}" data-fk="ns-${s.id}">No-show</button></div>
        </div>`).join("");
    }
    if (upcoming.length) {
      html += `<h3 class="q-title">Follow-ups this week <span class="count">${upcoming.length}</span></h3>` + upcoming.map((f) => {
        const x = due(f.follow_up_at);
        return `<div class="q-row ${x.cls}">
          <span class="q-when ${x.cls}">${x.text}</span>
          <div class="q-main">${who(f.id, f.name, f.business)}<p>${esc(f.follow_up_note || "Follow up")}</p></div>
          <div class="q-acts"><button class="btn sm" type="button" data-action="fu" data-days="done" data-id="${f.id}" data-fk="fd-${f.id}">${icon("check")}Done</button>
            <button class="btn ghost sm" type="button" data-action="fu" data-days="1" data-id="${f.id}" data-fk="f1-${f.id}" aria-label="Move to tomorrow">+1 day</button>
            <button class="btn ghost sm" type="button" data-action="fu" data-days="7" data-id="${f.id}" data-fk="f7-${f.id}" aria-label="Move one week out">+1 week</button></div>
        </div>`;
      }).join("");
    }
    if (!html) html = `<div class="empty"><b>Nothing needs you right now.</b>No new inquiries, no calls to update, and no follow-ups due in the next 7 days.</div>`;
    return html;
  }

  function reportFunnel() {
    const L = state.data.leads;
    const reached = [
      ["Booked", L.length, "--accent"],
      ["Showed up", L.filter((l) => ["held", "proposal", "paid", "lost"].includes(l.status)).length, "--cyan"],
      ["Proposal sent", L.filter((l) => ["proposal", "paid"].includes(l.status)).length, "--warn"],
      ["Paid", L.filter((l) => l.status === "paid").length, "--up"],
    ];
    const total = reached[0][1], count = (st) => L.filter((l) => l.status === st).length;
    if (!total) return `<div class="empty">No calls booked ${inPeriod()}.</div>`;
    return `<table class="tbl"><thead><tr><th>Stage reached</th><th class="r">Leads</th><th class="meter-col">Share of booked</th><th class="r">Of booked</th><th class="r">From previous stage</th></tr></thead><tbody>
      ${reached.map(([name, value, c], i) => `<tr><td>${name}</td><td class="r">${value}</td><td class="meter-col"><div class="meter" style="--c:var(${c})"><i style="width:${(value / total) * 100}%"></i></div></td><td class="r">${pct(value, total)}</td><td class="r">${i ? pct(value, reached[i - 1][1]) : "–"}</td></tr>`).join("")}
      </tbody></table><p class="foot-note">${count("booked") + count("held") + count("proposal")} still open · ${count("lost")} lost · ${count("no_show")} no-show. A lead counts toward every stage it has passed.</p>`;
  }
  function reportSources() {
    const rows = state.data.sources;
    if (!rows.length) return `<div class="empty">No calls booked ${inPeriod()}.</div>`;
    const max = Math.max(1, ...rows.map((x) => x.booked));
    return `<table class="tbl"><thead><tr><th>Source</th><th class="r">Booked</th><th class="meter-col">Share</th><th class="r">Paid</th><th class="r">Close rate</th><th class="r">Revenue</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${esc(x.source)}</td><td class="r">${x.booked}</td><td class="meter-col"><div class="meter"><i style="width:${(x.booked / max) * 100}%"></i></div></td><td class="r">${x.paid}</td><td class="r">${pct(x.paid, x.booked)}</td><td class="r">${money(x.revenue_cents)}</td></tr>`).join("")}
      </tbody></table>`;
  }
  function reportRates() {
    const d = state.data;
    const rows = d.leads.filter((l) => l.status === "paid" && l.hours > 0)
      .map((l) => ({ id: l.id, name: l.business || l.name, value: l.value_cents, hours: l.hours, rate: l.value_cents / l.hours }))
      .sort((a, b) => b.rate - a.rate).slice(0, 8);
    if (!rows.length) return `<div class="empty">Log hours on paid projects to see what each one earned per hour.</div>`;
    const overall = d.summary.hours ? d.summary.revenue_cents / d.summary.hours : 0;
    return `<table class="tbl"><thead><tr><th>Paid project</th><th class="r">Value</th><th class="r">Hours</th><th class="r">Per hour</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><button class="who" type="button" data-action="open" data-id="${r.id}" data-fk="rate-${r.id}">${esc(r.name)}</button></td><td class="r">${money(r.value)}</td><td class="r">${hrs(r.hours)}</td><td class="r">${money(r.rate)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="3">All logged hours, including calls that didn't turn into paid work</td><td class="r">${money(overall)}</td></tr></tfoot></table>`;
  }

  // ----- The chart: the running balance across the period, stepping at each entry. Every point can be chosen. -----
  let geo = null, chartSig = "";
  function niceScale(max, ticks) {
    const raw = max / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { step, top: Math.ceil(max / step - 1e-9) * step };
  }
  function drawChart() {
    const el = $("chart"), d = state.data;
    if (!el || !d) return;
    const m = moneyPath();
    if (!m.steps.length && !m.start) {
      el.innerHTML = `<p class="chart-note">No money recorded yet. Mark a lead Paid, or add a transaction, and the line starts here.</p>`;
      geo = null;
      $("chartRead").textContent = "";
      $("chartPick").innerHTML = "";
      return;
    }
    // The drawing-in animation plays only when the numbers are new, not on every refresh.
    const sig = state.range + m.start + m.steps.map((x) => x.day + ":" + x.total).join();
    const fresh = sig !== chartSig;
    chartSig = sig;
    const W = Math.max(280, Math.round(el.clientWidth)), H = Math.max(180, Math.round(el.clientHeight));
    const x0 = 14, x1 = W - 64, y0 = 34, y1 = H - 28;
    // The scale runs from the lowest balance to the highest, so a balance below zero stays inside the plot.
    const high = Math.max(m.start / 100, ...m.steps.map((x) => x.total / 100), 100), low = Math.min(0, m.low / 100);
    const { step } = niceScale(high - low, H < 260 ? 3 : 4);
    const bottom = Math.floor(low / step + 1e-9) * step, top = Math.ceil(high / step - 1e-9) * step;
    const px = (day) => x0 + (day / m.span) * (x1 - x0), py = (cents) => y1 - ((cents / 100 - bottom) / (top - bottom)) * (y1 - y0);

    let grid = "";
    for (let v = bottom; v <= top + 1e-6; v += step) {
      const y = Math.round(py(v * 100)) + .5;
      grid += `<line class="g-grid${bottom < 0 && Math.abs(v) < 1e-6 ? " is-zero" : ""}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="g-axis" x="${x1 + 10}" y="${y + 4}">${v < 0 ? "−" : ""}${usd(Math.abs(v))}</text>`;
    }
    // Flat until an entry, then a short eased rise that lands exactly on its day at its exact value. The curve only
    // softens the corner inside that one day; every day's balance is the real one.
    const ease = Math.min(14, (x1 - x0) / m.span);
    let line = `M${x0},${py(m.start).toFixed(1)}`, lastX = x0, lastY = py(m.start);
    for (const x of m.steps) {
      const toX = px(x.day), toY = py(x.total), fromX = Math.max(lastX, toX - ease), mid = ((fromX + toX) / 2).toFixed(1);
      line += toX - fromX < 1 ? `V${toY.toFixed(1)}` : `H${fromX.toFixed(1)}C${mid},${lastY.toFixed(1)} ${mid},${toY.toFixed(1)} ${toX.toFixed(1)},${toY.toFixed(1)}`;
      lastX = toX; lastY = toY;
    }
    line += `H${x1}`;
    const pays = m.steps.map((x) => `<circle class="g-pay${x.entry.kind === "income" ? "" : " is-transfer"}" cx="${px(x.day).toFixed(1)}" cy="${py(x.total).toFixed(1)}" r="4"/>`).join("");
    const marks = m.span < 3 ? [0, 1] : [0, 1 / 3, 2 / 3, 1];
    const dates = marks.map((f, i) => `<text class="g-axis" text-anchor="${i === 0 ? "start" : f === 1 ? "end" : "middle"}" x="${px(f * m.span).toFixed(1)}" y="${H - 8}">${f === 1 ? "Today" : niceDate(addDays(m.first, Math.round(f * m.span)))}</text>`).join("");
    // The balance going in and the balance now, as small labels above the line's two ends.
    const tag = (x, y, cents) => {
      const text = money(cents), w = text.length * 8 + 18, left = Math.max(2, Math.min(W - w - 2, x - w / 2)), top = Math.max(2, y - 34);
      return `<g class="g-tag"><rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w}" height="24" rx="8"/><text x="${(left + w / 2).toFixed(1)}" y="${(top + 16.5).toFixed(1)}">${text}</text></g>`;
    };
    el.innerHTML = `<svg${fresh ? ` class="fresh"` : ""} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ga0"/><stop offset="1" class="ga1"/></linearGradient></defs>
      ${grid}
      <path class="g-area" d="${line}V${y1}H${x0}Z"/><path class="g-line" pathLength="1" d="${line}"/>
      ${pays}
      <circle class="g-dot" cx="${x1}" cy="${py(m.total).toFixed(1)}" r="4"/>
      ${dates}
      ${tag(x0 + 28, py(m.start), m.start) + tag(x1, py(m.total), m.total)}
      <g class="g-x" id="gx" visibility="hidden"><line id="gxv" y1="${y0}" y2="${y1}"/><circle class="g-dot" id="gxd" r="5.5"/></g>
    </svg>`;
    geo = { m, px, py, at: -1 };
    const days = [...new Set(m.steps.map((x) => x.day))];
    const picked = () => (state.pick ? dayDiff(state.pick, m.first) : -1);
    /** The day under the pointer; within a thumb's width of an entry it lands on that entry. */
    const dayAt = (e) => {
      const x = e.clientX - el.getBoundingClientRect().left;
      let day = Math.max(0, Math.min(m.span, Math.round(((x - x0) / (x1 - x0)) * m.span))), near = 18;
      for (const s of m.steps) { const gap = Math.abs(px(s.day) - x); if (gap < near) { near = gap; day = s.day; } }
      return day;
    };
    el.onpointermove = (e) => { if (e.pointerType === "mouse") hoverDay(dayAt(e)); };
    // A click or tap chooses the entry there and keeps it shown; away from any entry it clears the choice.
    el.onpointerdown = (e) => { const day = dayAt(e); pickDay(days.includes(day) ? day : null); if (!days.includes(day)) hoverDay(day); };
    el.onpointerleave = (e) => { if (e.pointerType === "mouse") hoverDay(picked()); };
    el.onblur = () => hoverDay(picked());
    el.onkeydown = (e) => {
      if (e.key === "Escape" && state.pick) { e.stopPropagation(); return pickDay(null); }
      const move = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[e.key];
      if (!move || !days.length) return;
      e.preventDefault();
      // The first press lands on the latest entry; after that the arrows step through them.
      const i = days.indexOf(picked());
      pickDay(days[i < 0 ? days.length - 1 : Math.max(0, Math.min(days.length - 1, i + move))]);
    };
    paintPick();
    hoverDay(picked());
  }
  /** Move the crosshair to a day of the period, or hide it (-1) and say what the line covers. */
  function hoverDay(day) {
    const read = $("chartRead"), gx = $("gx");
    if (!geo || !read || !gx) return;
    geo.at = day;
    const { m, px, py } = geo;
    if (day < 0) {
      gx.setAttribute("visibility", "hidden");
      read.innerHTML = `<span>${plural(m.steps.length, "entry", "entries")} ${inPeriod()}</span>`;
      return;
    }
    const sofar = m.steps.filter((x) => x.day <= day), total = sofar.length ? sofar[sofar.length - 1].total : m.start;
    const x = px(day).toFixed(1);
    gx.setAttribute("visibility", "visible");
    $("gxv").setAttribute("x1", x); $("gxv").setAttribute("x2", x);
    $("gxd").setAttribute("cx", x); $("gxd").setAttribute("cy", py(total).toFixed(1));
    read.innerHTML = `<span>${day === m.span ? "Today" : niceDate(addDays(m.first, day))} · balance <b>${money(total)}</b></span>`
      + sofar.filter((s) => s.day === day).map(({ entry }) => `<span${entry.kind === "income" ? ` class="plus"` : ""}><b>${signed(entry)}</b> ${esc(entry.kind === "income" ? entry.label : KIND[entry.kind][0])}</span>`).join("");
  }
  /** Choose a point on the line (a day of the period), or clear the choice with null. */
  function pickDay(day) {
    if (!geo) return;
    state.pick = day == null ? null : addDays(geo.m.first, day);
    paintPick();
    hoverDay(day == null ? -1 : day);
  }
  /** Under the chart: what changed the balance at the chosen point, with its client and a way to the table row. */
  function paintPick() {
    const box = $("chartPick");
    if (!box || !geo) return;
    const { m } = geo, hits = state.pick ? m.steps.filter((s) => s.entry.date === state.pick) : [];
    if (!hits.length) {
      state.pick = null;
      box.innerHTML = m.steps.length ? `<p class="pick-hint">Select a point on the line to see what changed the balance.</p>` : "";
      return;
    }
    box.innerHTML = `<div class="pick-h"><b>${niceDate(state.pick)}</b><span>Balance after: <b class="num">${money(hits[hits.length - 1].total)}</b></span>
        <button class="btn ghost sm" type="button" data-action="pick-clear">Clear</button></div>
      <ul>${hits.map(({ entry: e }) => `<li><b class="amt${HeurialMoney.SIGN[e.kind] < 0 ? " out" : ""}">${signed(e)}</b>
        <span class="kind" style="--c:var(${KIND[e.kind][1]})">${KIND[e.kind][0]}</span><span class="pick-what">${esc(e.label)}${e.derived ? " (read from the lead)" : ""}</span>
        ${e.lead ? `<button class="who" type="button" data-action="open" data-id="${e.lead.id}">${esc(e.lead.name)}${e.lead.business ? `<span> · ${esc(e.lead.business)}</span>` : ""}</button>` : ""}
        <button class="btn sm" type="button" data-action="tx-show" data-key="${e.key}">${state.view === "money" ? "Show in the table" : "Open in Money"}</button></li>`).join("")}</ul>`;
  }

  // ----- Pipeline -----
  /** Open leads and what was proposed to them, as two large figures above the board. */
  function leadSum(d, note) {
    const open = d.leads.filter((l) => OPEN.includes(l.status));
    return `<div class="lead-sum"><p><b>${open.length}</b>open ${open.length === 1 ? "lead" : "leads"}</p><p><b>${money(open.reduce((a, l) => a + l.value_cents, 0))}</b>proposed</p>${note ? `<span>${note}</span>` : ""}</div>`;
  }
  function viewPipeline() {
    const d = state.data;
    const by = (st) => d.leads.filter((l) => l.status === st);
    const lanes = ORDER.map((st) => {
      const leads = by(st), total = leads.reduce((a, l) => a + l.value_cents, 0);
      return `<section class="lane" data-status="${st}" aria-label="${STATUS[st].label}, ${plural(leads.length, "lead")}">
        <div class="lane-head"><h2>${STATUS[st].label}</h2><span class="count">${leads.length}</span>${total ? `<span class="sum">${money(total)}</span>` : ""}</div>
        <div class="lane-list">${leads.length ? leads.map(cardHtml).join("") : `<div class="lane-empty">No leads at this stage</div>`}</div>
      </section>`;
    }).join("");
    return `<div class="vw pl">
      ${leadSum(d, `${plural(d.leads.length, "lead")} booked ${inPeriod()}`)}
      <div class="board-wrap"><div class="board" data-scroll="board" tabindex="0" aria-label="Lead board: six stages, scroll sideways to see them all">${lanes}</div></div>
    </div>`;
  }
  /** One lead on the board: a dot for how urgent it is, the name, the business, and what happens next. */
  function cardHtml(l) {
    const x = l.follow_up_at ? due(l.follow_up_at) : null;
    const c = x && x.cls === "late" ? "--down" : x && x.cls === "today" ? "--warn" : l.status === "paid" ? "--up" : x ? "--accent" : "--mute";
    const next = x ? `${x.long}${l.follow_up_note ? " · " + esc(l.follow_up_note) : ""}` : l.status === "paid" ? "Paid" : "No follow-up set";
    return `<article class="card ${state.lead && state.lead.id === l.id ? "is-selected" : ""}${state.touched === l.id ? " is-touched" : ""}" data-id="${l.id}" style="--c:var(${c})" title="Source: ${esc(l.source)} · booked ${niceDate(l.booked_at)}">
      <div class="card-top"><i class="card-dot"></i><button class="card-name" type="button" data-action="open" data-id="${l.id}" data-fk="card-${l.id}">${esc(l.name)}</button>${l.value_cents ? `<span class="num">${money(l.value_cents)}</span>` : ""}</div>
      <div class="card-biz">${esc(l.business || "No business name")}</div>
      <div class="card-next ${x ? x.cls : ""}">${next}</div>
      <select class="in" data-change="move" data-id="${l.id}" data-fk="move-${l.id}" aria-label="Move ${esc(l.name)} to another stage">
        ${ORDER.map((st) => `<option value="${st}" ${st === l.status ? "selected" : ""}>${st === l.status ? "Move…" : STATUS[st].label}</option>`).join("")}
      </select>
    </article>`;
  }

  // ----- Leads -----
  const COLUMNS = [
    ["name", "Lead", "", ""], ["status", "Stage", "", ""], ["source", "Source", "", "col-opt"], ["booked_at", "Booked", "", ""], ["call_at", "Call", "", "col-opt"],
    ["follow_up_at", "Follow-up", "", ""], ["follow_up_note", "Next action", "", "col-opt"], ["value_cents", "Value", "r", ""], ["hours", "Hours", "r", ""],
  ];
  function filteredLeads() {
    const d = state.data, q = state.query.trim().toLowerCase(), f = state.facets;
    const rows = d.leads.filter((l) => matches(l, q)
      && (!f.stage.size || f.stage.has(l.status)) && (!f.source.size || f.source.has(l.source)) && (!f.due.size || f.due.has(dueBucket(l))));
    const { key, dir } = state.sort, sign = dir === "asc" ? 1 : -1;
    const value = (l) => (key === "status" ? ORDER.indexOf(l.status) : l[key]);
    return rows.sort((a, b) => {
      const x = value(a), y = value(b), ex = x === "" || x == null, ey = y === "" || y == null;
      if (ex !== ey) return ex ? 1 : -1; // empty dates and text always sort last
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "en", { sensitivity: "base" });
      return cmp * sign || a.name.localeCompare(b.name);
    });
  }
  function facetBlock(key, title, rows) {
    const max = Math.max(1, ...rows.map((r) => r[2])), sel = state.facets[key];
    return `<section class="facet" aria-label="Filter by ${title.toLowerCase()}"><h3>${title}${sel.size ? `<button type="button" data-action="facet-clear" data-facet="${key}" data-fk="fc-${key}">Clear</button>` : ""}</h3>
      ${rows.map(([value, label, count, c], i) => `<button class="facet-row" type="button" data-action="facet" data-facet="${key}" data-value="${esc(value)}" data-fk="f-${key}-${i}" aria-pressed="${sel.has(value)}" style="--c:var(${c})">
        <span>${esc(label)}</span><span class="num">${count}</span><span class="fr-bar"><i style="width:${(count / max) * 100}%"></i></span></button>`).join("")}</section>`;
  }
  function viewLeads() {
    const d = state.data, q = state.query.trim().toLowerCase(), f = state.facets;
    const pool = d.leads.filter((l) => matches(l, q)); // facet counts follow the text filter
    const sources = [...new Set(d.leads.map((l) => l.source))].sort((a, b) => a.localeCompare(b));
    for (const s of [...f.source]) if (!sources.includes(s)) f.source.delete(s);
    const rows = filteredLeads();
    const filtered = q || f.stage.size || f.source.size || f.due.size;
    const facets = facetBlock("stage", "Stage", ORDER.map((st) => [st, STATUS[st].label, pool.filter((l) => l.status === st).length, STATUS[st].c]))
      + facetBlock("due", "Follow-up", DUE_BUCKETS.map(([key, label, c]) => [key, label, pool.filter((l) => dueBucket(l) === key).length, c]))
      + facetBlock("source", "Source", sources.map((s) => [s, s, pool.filter((l) => l.source === s).length, "--mute"]));
    let body;
    if (!d.leads.length) body = `<div class="empty"><b>No leads booked ${inPeriod()}.</b>Choose a longer date range, or add the first one.<br><button class="btn primary" type="button" data-action="new-lead">${icon("plus")}New lead</button></div>`;
    else if (!rows.length) body = `<div class="empty"><b>No leads match these filters.</b><button class="btn" type="button" data-action="clear-filters">Clear filters</button></div>`;
    else body = `<table class="tbl" id="leadTable">
      <thead><tr>${COLUMNS.map(([key, label, align, opt]) => `<th class="sortable ${align} ${opt}" scope="col" ${state.sort.key === key ? `aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : ""}>
        <button class="sort" type="button" data-action="sort" data-key="${key}" data-fk="sort-${key}">${label}</button></th>`).join("")}</tr></thead>
      <tbody>${rows.map((l) => `<tr data-action="open" data-id="${l.id}" class="${state.lead && state.lead.id === l.id ? "is-selected" : ""}${state.touched === l.id ? " is-touched" : ""}">
        <td><button class="who" type="button" data-action="open" data-id="${l.id}" data-fk="row-${l.id}">${esc(l.name)}${l.business ? `<span> · ${esc(l.business)}</span>` : ""}</button></td>
        <td>${tag(l.status)}</td><td class="col-opt">${esc(l.source)}</td><td class="n">${niceDate(l.booked_at)}</td><td class="n col-opt">${niceDate(l.call_at)}</td>
        <td>${l.follow_up_at ? dueTag(l.follow_up_at) : `<span class="faint">–</span>`}</td><td class="col-opt"><div class="trunc muted">${esc(l.follow_up_note || "–")}</div></td>
        <td class="r">${l.value_cents ? money(l.value_cents) : "–"}</td><td class="r">${l.hours ? hrs(l.hours) : "–"}</td></tr>`).join("")}</tbody>
    </table>`;
    return `<div class="vw ld">
      <aside class="pane facets" aria-label="Filters">${facets}</aside>
      <section class="pane ld-table" aria-label="Leads">
        <div class="toolbar">
          <input class="in" type="search" data-input="lead-filter" data-fk="lead-filter" value="${esc(state.query)}" placeholder="Filter by name, business, email or source" aria-label="Filter leads">
          ${filtered ? `<button class="btn ghost sm" type="button" data-action="clear-filters" data-fk="clear-filters">Clear filters</button>` : ""}
          <span class="result-count" role="status">${filtered ? `${rows.length} of ${d.leads.length}` : plural(d.leads.length, "lead")} · booked ${inPeriod()}</span>
          <span class="spacer"></span>
          <button class="btn sm" type="button" data-action="export" data-fk="export">${icon("down")}Export CSV</button>
        </div>
        <div class="pane-body" data-scroll="leads">${body}</div>
      </section>
    </div>`;
  }

  // ----- Time -----
  /** Older back ends don't include time entries in /data, so fetch them per lead as a fallback. */
  async function ensureTime() {
    if (state.time || state.timeLoading || !state.data) return;
    state.timeLoading = true;
    try {
      const leads = state.data.leads.filter((l) => l.hours > 0);
      const lists = await Promise.all(leads.map((l) => call(`/api/leads/${l.id}/time`).then((rows) => rows.map((r) => ({ ...r, lead_id: l.id, lead_name: l.name, lead_business: l.business })))));
      state.time = lists.flat().sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    } catch (err) {
      state.time = [];
      toast(err.message || "Couldn't load time entries.", true);
    }
    state.timeLoading = false;
    if (state.view === "time") renderView();
  }
  function viewTime() {
    const d = state.data;
    const leads = [...d.leads].sort((a, b) => a.name.localeCompare(b.name));
    const cutoff = state.range === "all" ? "" : addDays(d.today, -Number(state.range));
    const entries = (state.time || []).filter((e) => e.entry_date >= cutoff);
    const total = entries.reduce((a, e) => a + e.hours, 0);
    const weeks = d.weekly.map((x) => x.week), sums = weeks.map(() => 0);
    for (const e of state.time || []) { const i = weeks.indexOf(mondayOf(e.entry_date)); if (i >= 0) sums[i] += e.hours; }
    const maxH = Math.max(1, ...sums), sum12 = sums.reduce((a, b) => a + b, 0);
    const byLead = d.leads.filter((l) => l.hours > 0).sort((a, b) => b.hours - a.hours);

    const list = !state.time ? skeleton() : entries.length ? `<table class="tbl"><thead><tr><th>Date</th><th>Lead</th><th>What you did</th><th class="r">Hours</th><th><span class="sr">Delete</span></th></tr></thead><tbody>
      ${entries.map((e) => `<tr><td class="n">${niceDate(e.entry_date)}</td>
        <td><button class="who" type="button" data-action="open" data-id="${e.lead_id}" data-tab="time" data-fk="te-${e.id}">${esc(e.lead_name || "Lead")}</button></td>
        <td><div class="trunc muted" title="${esc(e.note)}">${esc(e.note || "–")}</div></td><td class="r">${hrs(e.hours)}</td>
        <td class="r"><button class="btn ghost sm icon" type="button" data-action="time-del" data-id="${e.id}" data-fk="td-${e.id}" aria-label="Delete ${hrs(e.hours)} hours on ${niceDate(e.entry_date)} for ${esc(e.lead_name || "lead")}">${icon("x")}</button></td></tr>`).join("")}
      </tbody></table>` : `<div class="empty"><b>No time logged ${inPeriod()}.</b>Log the hours you spend on a lead to see what each project earns per hour.</div>`;

    return `<div class="vw tm">
      <form class="pane tm-add" data-submit="time-add" novalidate aria-label="Log time">
        <div class="time-row">
          <label class="field"><span>Lead</span><select name="lead_id" data-keep="t-lead" data-fk="t-lead"><option value="">${leads.length ? "Choose a lead…" : "No leads in this date range"}</option>${leads.map((l) => `<option value="${l.id}">${esc(l.name)}${l.business ? ` · ${esc(l.business)}` : ""}</option>`).join("")}</select></label>
          <label class="field"><span>Date</span><input type="date" name="entry_date" data-keep="t-date" data-fk="t-date" value="${d.today}"></label>
          <label class="field"><span>Hours</span><input type="number" name="hours" min="0.25" max="24" step="0.25" inputmode="decimal" data-keep="t-hours" data-fk="t-hours"></label>
          <label class="field"><span>What you did</span><input type="text" name="note" maxlength="300" data-keep="t-note" data-fk="t-note"></label>
          <button class="btn primary" type="submit" data-fk="t-submit">${icon("plus")}Log time</button>
        </div>
        <p class="field-err foot-note" id="timeAddErr" role="alert" hidden></p>
      </form>
      <section class="pane" aria-labelledby="teTitle">
        <div class="pane-head"><h2 id="teTitle">Time entries</h2><span class="pane-meta">${state.time ? `${hrs(total)} h in ${plural(entries.length, "entry", "entries")} · ${rangeText()}` : "Loading…"}</span></div>
        <div class="pane-body" data-scroll="time">${list}</div>
      </section>
      <section class="pane" aria-labelledby="hwTitle">
        <div class="pane-head"><h2 id="hwTitle">Hours per week</h2><span class="pane-meta">${hrs(sum12)} h · last 12 weeks</span></div>
        <div class="pane-body">
          <div class="hours" role="img" aria-label="Hours logged per week over the last 12 weeks: ${hrs(sum12)} in total."><span class="cap">${hrs(maxH)} h</span>
            ${sums.map((h, i) => `<div class="col" title="Week of ${niceDate(weeks[i])}: ${hrs(h)} h"><div class="bar ${h ? "" : "zero"}" style="height:${(h / maxH) * 100}%"></div></div>`).join("")}</div>
          <div class="x-labels" aria-hidden="true">${weeks.map((wk, i) => `<span>${i % 3 ? "" : niceDate(wk)}</span>`).join("")}</div>
          <h3 class="sub-head">Hours by lead</h3>
          ${byLead.length ? `<table class="tbl"><thead><tr><th>Lead</th><th>Stage</th><th class="r">Hours</th><th class="r">Per hour</th></tr></thead><tbody>
            ${byLead.map((l) => `<tr><td><button class="who" type="button" data-action="open" data-id="${l.id}" data-tab="time" data-fk="tl-${l.id}">${esc(l.name)}</button></td><td>${tag(l.status)}</td><td class="r">${hrs(l.hours)}</td>
              <td class="r">${l.status === "paid" && l.value_cents ? money(l.value_cents / l.hours) : "–"}</td></tr>`).join("")}</tbody></table>
            <p class="foot-note">All hours ever logged on leads booked ${inPeriod()}. Per hour is shown for paid projects only.</p>`
            : `<div class="empty">No hours logged on these leads yet.</div>`}
        </div>
      </section>
    </div>`;
  }

  // ----- Messages -----
  function viewMessages() {
    const d = state.data, sv = services(), demo = cfg.mode === "demo";
    const svc = (on, label) => `<span class="svc ${on && !demo ? "on" : ""}"><i></i>${label}: ${demo ? "sample data" : on ? "connected" : "not connected"}</span>`;
    const strip = `<div class="strip">${sv ? svc(sv.email, "Email sending") + svc(sv.sms, "Text sending") + svc(sv.inbound || sv.twilio, "Incoming messages") + svc(sv.ai, "AI drafts")
      : `<span>This version of the back end doesn't report what's connected.</span>`}
      <button class="btn sm" type="button" data-action="view" data-view="connections" data-fk="to-conn">${icon("gear")}Settings</button></div>`;
    const inbox = d.inbox.length ? `<div class="strip"><span>${plural(d.inbox.length, "new website inquiry", "new website inquiries")} waiting for a decision.</span>
      <button class="btn sm" type="button" data-action="view" data-view="tasks" data-fk="to-ov">Review in Tasks</button></div>` : "";
    let body;
    if (sv && sv.messages === false) {
      body = `<div class="empty"><b>The message log isn't set up yet.</b>Create the Messages table in the Catalyst Data Store, then refresh. The rest of the tracker works without it.</div>`;
    } else {
      const msgs = d.messages || [], threads = new Map();
      for (const m of msgs) { // newest first, so the first one seen for a lead is its latest
        if (!m.lead_id) continue;
        const t = threads.get(m.lead_id);
        if (t) t.count++; else threads.set(m.lead_id, { latest: m, count: 1 });
      }
      const unmatched = msgs.filter((m) => !m.lead_id);
      const excerpt = (m) => `${m.status === "draft" ? "Draft" : m.channel === "note" ? "Note" : m.direction === "in" ? "Them" : "You"}: ${esc(m.subject ? `${m.subject} — ` : "")}${esc(m.body)}`;
      const chan = (m) => `<span class="tag">${CHANNEL[m.channel][0]}</span>`;
      body = threads.size || unmatched.length ? `<table class="tbl"><thead><tr><th>Lead</th><th>Type</th><th>Latest message</th><th>When</th><th class="r">In thread</th></tr></thead><tbody>
        ${unmatched.map((m) => `<tr><td><span class="who">${esc(m.sender || "Unknown sender")}<span> · not matched to a lead</span></span></td><td>${chan(m)}</td>
          <td><div class="trunc muted" title="${esc(m.body)}">${excerpt(m)}</div></td><td class="n">${stamp(m.created_at)}</td>
          <td class="r"><button class="btn ghost sm icon" type="button" data-action="msg-del" data-id="${m.id}" data-fk="um-${m.id}" aria-label="Delete this unmatched message">${icon("x")}</button></td></tr>`).join("")}
        ${[...threads.values()].map(({ latest: m, count }) => `<tr data-action="open" data-id="${m.lead_id}" data-tab="messages" class="${state.lead && state.lead.id === m.lead_id ? "is-selected" : ""}">
          <td><button class="who" type="button" data-action="open" data-id="${m.lead_id}" data-tab="messages" data-fk="mt-${m.lead_id}">${esc(m.lead_name || "Lead")}${m.lead_business ? `<span> · ${esc(m.lead_business)}</span>` : ""}</button></td>
          <td>${chan(m)}</td><td><div class="trunc muted">${excerpt(m)}</div></td><td class="n">${stamp(m.created_at)}</td><td class="r">${count}</td></tr>`).join("")}
        </tbody></table>`
        : `<div class="empty"><b>No messages yet.</b>Open a lead and use its Messages tab to write a note, log a call, or write an email or text.<br><button class="btn" type="button" data-action="view" data-view="leads">${icon("leads")}Go to Leads</button></div>`;
    }
    return `<div class="vw pane">
      <div class="pane-head"><h2>Conversations</h2><span class="pane-meta">Notes, calls, emails and texts, newest first</span></div>
      ${strip}${inbox}
      <div class="pane-body" data-scroll="messages">${body}</div>
    </div>`;
  }

  function deviceRows(sv) {
    const dev = cfg.device;
    if (!dev) return "";
    if (state.pushState === undefined) { state.pushState = "checking"; refreshDevice(); }
    const tag = (c, label) => `<span class="tag" style="--c:var(${c})">${label}</span>`;
    const installNote = dev.installed ? "You're using the installed app on this device."
      : dev.ios ? "In Safari, tap Share, then Add to Home Screen. It opens full screen with its own icon."
      : dev.canInstall() ? "Add the tracker to this device as an app, with its own icon and window."
      : "Use your browser's Install or Add to Home Screen option. On iPhone, use Safari.";
    const install = `<div class="conn"><div class="conn-ico">${icon("down")}</div><h3>App on this device</h3><p>${installNote}</p>
      <div class="conn-side">${dev.installed ? tag("--up", "Installed") : dev.canInstall()
        ? `<button class="btn sm" type="button" data-action="install" data-fk="c-install">Install</button>` : tag("--mute", "Not installed")}</div></div>`;
    const ps = state.pushState;
    const pushNote = !sv || !sv.push ? "Get a notification on this device for new inquiries and replies. Needs <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> on the pipeline function, and the <code>PushSubscriptions</code> table."
      : ps === "needs-install" ? "On iPhone and iPad, notifications work once the tracker is installed. Add it to your Home Screen first, then open it from there."
      : ps === "blocked" ? "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here."
      : ps === "unsupported" ? "This browser can't show notifications from websites."
      : ps === "on" ? "New inquiries and replies show up as notifications on this device."
      : "Get a notification on this device for new inquiries and replies.";
    const pushSide = !sv || !sv.push ? tag("--mute", "Not connected")
      : ps === "on" ? `${tag("--up", "On")}<button class="btn sm" type="button" data-action="push-test" data-fk="c-ptest">Send test</button><button class="btn ghost sm" type="button" data-action="push-off" data-fk="c-poff">Turn off</button>`
      : ps === "off" ? `<button class="btn sm primary" type="button" data-action="push-on" data-fk="c-pon">Turn on</button>`
      : tag("--mute", ps === "checking" ? "Checking" : ps === "blocked" ? "Blocked" : "Not available");
    return `<h3 class="sub-head">This device</h3>${install}
      <div class="conn"><div class="conn-ico">${icon("bell")}</div><h3>Notifications</h3><p>${pushNote}</p><div class="conn-side">${pushSide}</div></div>`;
  }

  // ----- Connections -----
  function viewConnections() {
    const d = state.data, sv = services(), demo = cfg.mode === "demo";
    const dark = (document.documentElement.dataset.theme || "light") === "dark";
    const st = (on) => (demo ? ["--warn", "Sample data"] : !sv ? ["--mute", "Unknown"] : on ? ["--up", "Connected"] : ["--mute", "Not connected"]);
    // One line each: what it is, whether it is on, and the one thing you can do. Setup steps open on request.
    const rows = [
      ["leads", "Website inquiry form", `${plural(d.inbox.length, "inquiry", "inquiries")} waiting in Tasks.`, demo ? ["--warn", "Sample data"] : ["--up", "Active"], "",
        `<button class="btn sm" type="button" data-action="view" data-view="tasks" data-fk="c-ov">Open Tasks</button>`],
      ["mail", "Daily summary email", "Each morning: inquiries, calls to record, follow-ups and tasks due.", st(sv && sv.digest),
        "Needs <code>DIGEST_FROM</code> (a sender verified in Catalyst Mail), <code>DIGEST_TO</code>, and the daily job.",
        `<button class="btn sm" type="button" data-action="digest" data-fk="c-digest">Preview</button>`],
      ["send", "Email to leads", "Send from a client's Messages tab. Off: emails are logged and you send them yourself.", st(sv && sv.email),
        "Needs <code>MESSAGES_FROM</code>: a sender verified in Catalyst Mail.", ""],
      ["sms", "Text messages", "Send texts from a client's Messages tab through Twilio.", st(sv && sv.sms),
        "Needs <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_FROM</code> (your Twilio number). Another text service can use <code>MESSAGE_WEBHOOK_URL</code> instead.", ""],
      ["inbound", "Incoming texts", "Replies land in the right client's thread, matched by phone number.", st(sv && sv.twilio),
        "Needs <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_WEBHOOK_URL</code>: the pipeline function's <code>/twilio/sms</code> address, also set as the number's incoming-message webhook in Twilio.", ""],
      ["mail", "Incoming email", "Replies land in the right client's thread, matched by email address.", st(sv && sv.inbound),
        "Needs <code>INBOUND_KEY</code>. Point your mail provider's inbound webhook (Postmark, Mailgun or SendGrid) at the pipeline function's <code>/inbound/email?key=…</code> address.", ""],
      ["spark", "AI drafts and summaries", "Drafts, summaries and task suggestions. Nothing is sent or added until you approve it.", st(sv && sv.ai && sv.assist !== false),
        "Needs <code>ANTHROPIC_API_KEY</code> on the pipeline function.", ""],
      ["note", "Message log", "Where notes, calls, emails and texts are stored.", st(sv && sv.messages),
        "Needs the <code>Messages</code> table in the Catalyst Data Store.", ""],
      ["wallet", "Money and payments", "Transactions, and each client payment as its own record.", st(sv && sv.money),
        "Needs the <code>Transactions</code> table, with its <code>lead_id</code> column for client payments.", ""],
    ];
    const row = ([ic, name, desc, [c, label], how, action]) => `<div class="conn"><div class="conn-ico">${icon(ic)}</div><h3>${name}</h3>
      <p>${desc}</p>${how && !demo && label !== "Connected" ? `<details class="how"><summary>How to connect</summary><p>${how}</p></details>` : ""}
      <div class="conn-side"><span class="tag" style="--c:var(${c})">${label}</span>${action}</div></div>`;
    return `<div class="vw pane">
      <div class="pane-head"><h2>Workspace and connections</h2><span class="pane-meta">${demo ? "Sample data. The real tracker shows what is connected."
        : !sv ? "This back end doesn't report what is connected. Deploy the current pipeline function."
        : "Set on the Catalyst pipeline function. Steps: catalyst/TRACKER-SETUP.md."}</span></div>
      <div class="pane-body"><div class="conn-list">
        <h3 class="sub-head">Workspace</h3>
        <div class="conn"><div class="conn-ico">${icon(dark ? "moon" : "sun")}</div><h3>Appearance</h3><p>${dark ? "Dark" : "Light"} look.</p>
          <div class="conn-side"><button class="btn sm" type="button" data-action="theme" data-fk="c-theme">Switch to ${dark ? "light" : "dark"}</button></div></div>
        <div class="conn"><div class="conn-ico">${icon("down")}</div><h3>Export</h3><p>Leads booked ${inPeriod()}, as a CSV file.</p>
          <div class="conn-side"><button class="btn sm" type="button" data-action="export" data-fk="c-export">Export CSV</button></div></div>
        ${cfg.auth ? `<div class="conn"><div class="conn-ico">${icon("out")}</div><h3>Session</h3><p>Signed in on this browser.</p>
          <div class="conn-side"><button class="btn sm" type="button" data-action="signout" data-fk="c-out">Sign out</button></div></div>` : ""}
        <h3 class="sub-head">Connections</h3>
        ${rows.map(row).join("")}
        ${deviceRows(sv)}
      </div></div>
    </div>`;
  }

  // ---------- Actions ----------
  function setView(next) {
    if (!VIEWS[next]) return;
    const swap = () => {
      state.view = next;
      store("hp-view", next);
      render();
      $("view").scrollTop = 0;
      if (getComputedStyle(document.body).overflow !== "hidden") window.scrollTo(0, 0);
      if (next === "time") ensureTime();
    };
    // Where the browser can, the old section lifts away and the new one rises in (styled in tracker.css).
    // In a background tab the browser skips the animation and rejects these promises; the swap itself still runs.
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const move = document.startViewTransition(swap); move.ready.catch(() => {}); move.finished.catch(() => {}); }
    else swap();
  }
  function setRange(range) {
    if (range === state.range) return;
    state.range = range;
    store("hp-range", range);
    state.time = null;
    renderChrome();
    load();
  }
  function toggleTheme() {
    const next = (document.documentElement.dataset.theme || "light") === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store("hp-theme", next);
    paintTheme();
    if (state.view === "connections") renderView();
  }
  function paintTheme() {
    const dark = (document.documentElement.dataset.theme || "light") === "dark";
    if (!$("themeBtn")) return; // the switch now lives in Settings
    $("themeBtn").innerHTML = `${icon(dark ? "sun" : "moon")}<span>${dark ? "Light" : "Dark"}</span>`;
    $("themeBtn").title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  function confirmBox({ title, text, action, danger }) {
    return new Promise((resolve) => {
      const dlg = $("confirmDlg"), yes = $("confirmYes");
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      yes.textContent = action;
      yes.className = danger ? "btn danger" : "btn primary";
      const done = (value) => { dlg.removeEventListener("close", onClose); yes.onclick = null; $("confirmNo").onclick = null; if (dlg.open) dlg.close(); resolve(value); };
      const onClose = () => done(false);
      dlg.addEventListener("close", onClose);
      yes.onclick = () => done(true);
      $("confirmNo").onclick = () => done(false);
      dlg.showModal();
      $("confirmNo").focus();
    });
  }

  async function openDigest(button) {
    return act(button, async () => {
      const d = await call("/api/digest?preview=1", "POST");
      $("digestSubject").textContent = d.subject;
      $("digestFrame").srcdoc = d.html;
      $("digestDlg").showModal();
    });
  }
  async function signOut(button) {
    if (!cfg.auth || !(await leaveDirty())) return;
    return act(button, async () => {
      await cfg.auth.signOut();
      state.data = null; state.time = null; state.error = ""; state.lead = null; state.isNew = false; state.dirty = false;
      $("insp").hidden = true;
      render();
      showSignIn("");
    });
  }

  async function onAction(e) {
    if (suppressClick) return;
    let el = e.target.closest("[data-action]");
    if (!el) {
      // A click anywhere on a pipeline card (except its Move menu) opens the lead.
      const card = e.target.closest(".board .card");
      if (card && !e.target.closest("select")) openById(card.dataset.id);
      return;
    }
    // Clicking a control inside a table row shouldn't also trigger the row.
    if (el.tagName === "TR" && e.target.closest("button, select, a, input")) return;
    const d = state.data, id = el.dataset.id, button = el.tagName === "BUTTON" ? el : null;
    switch (el.dataset.action) {
      case "view": return setView(el.dataset.view);
      case "range": return setRange(el.dataset.range);
      case "palette": return openPalette();
      case "refresh": return act(button, load);
      case "theme": return toggleTheme();
      case "install": return act(button, async () => { await cfg.device.install(); render(); });
      case "push-on": return act(button, async () => {
        await cfg.device.enablePush();
        state.pushState = "on"; render();
        toast("Notifications are on for this device");
      });
      case "push-off": return act(button, async () => {
        await cfg.device.disablePush();
        state.pushState = "off"; render();
        toast("Notifications are off for this device");
      });
      case "push-test": return act(button, async () => { await cfg.device.testPush(); toast("Test sent. It should arrive in a few seconds."); });
      case "signout": return signOut(button);
      case "digest": return openDigest(button);
      case "export": return exportCsv();
      case "new-lead": return d ? openLead(null) : undefined;
      case "main": {
        const section = sectionOf(state.view)[0];
        if (!d) return;
        if (section !== "Money" && section !== "Tasks") return openLead(null);
        const field = $("view").querySelector(`[data-fk="${section === "Money" ? "x-amt" : "k-title"}"]`);
        if (field) { field.scrollIntoView({ block: "center" }); field.focus(); }
        return;
      }
      case "next-skip": state.nextAt = (state.nextAt + 1) % Math.max(1, state.next.length); return renderView();
      case "pick-clear": pickDay(null); return $("chart") && $("chart").focus();
      case "tx-show": return showTx(el.dataset.key);
      case "review-start": return startReview();
      case "review-close": return closeReview();
      case "review-do": return act(button, () => reviewDo(el.dataset.do));
      case "assist": return runAssist(el.dataset.key, el.dataset.kind, id);
      case "assist-close": delete state.ai[el.dataset.key]; return paintAi();
      case "assist-add": return act(button, async () => {
        const t = state.ai[el.dataset.key].result.tasks[Number(el.dataset.i)];
        await call("/api/tasks", "POST", { title: t.title, due_at: t.due_at });
        t.added = true;
        toast("Task added");
        await load();
        paintAi();
      });
      case "backfill": return act(button, async () => {
        const r = await call("/api/payments/backfill", "POST");
        toast(r.failed ? `${plural(r.created, "payment")} recorded, ${r.failed} couldn't be: the Transactions table may need its lead_id column.` : `${plural(r.created, "payment")} recorded from ${r.created === 1 ? "its lead" : "their leads"}`, Boolean(r.failed));
        await load();
      });
      case "task-due": return act(button, async () => {
        const next = addDays(d.today, Number(el.dataset.days));
        await call("/api/tasks/" + id, "PATCH", { due_at: next });
        toast(`Task moved to ${niceDate(next)}`);
        await load();
      });
      case "prop-fu": return act(button, async () => {
        const next = addDays(d.today, FOLLOW_PLAN.proposal[0]);
        await call("/api/leads/" + id, "PATCH", { follow_up_at: next, follow_up_note: FOLLOW_PLAN.proposal[1] });
        toast(`Follow-up set for ${niceDate(next)}`);
        await load();
      });
      case "msg-confirm": return act(button, async () => {
        await call(`/api/messages/${id}/approve`, "POST", { send: false });
        toast("Marked as sent by you");
        await loadThread();
        await load();
      });
      case "open": return openById(id, el.dataset.tab);
      case "insp-close": return closeInspector();
      case "tab": return showTab(el.dataset.tab);
      case "ovtab": state.ovTab = el.dataset.tab; return renderView();
      case "moneytab": state.moneyTab = el.dataset.tab; return renderView();
      case "tasktab": state.taskTab = el.dataset.tab; return renderView();
      case "sort": {
        const key = el.dataset.key;
        state.sort = state.sort.key === key ? { key, dir: state.sort.dir === "asc" ? "desc" : "asc" } : { key, dir: ["value_cents", "hours", "booked_at"].includes(key) ? "desc" : "asc" };
        return renderView();
      }
      case "facet": { const set = state.facets[el.dataset.facet], v = el.dataset.value; if (set.has(v)) set.delete(v); else set.add(v); return renderView(); }
      case "facet-clear": state.facets[el.dataset.facet].clear(); return renderView();
      case "clear-filters": state.query = ""; for (const set of Object.values(state.facets)) set.clear(); return renderView();
      case "inbox-convert": return act(button, async () => {
        const item = d.inbox.find((i) => i.id === id);
        const r = await call(`/api/inbox/${id}/convert`, "POST");
        toast(`Added ${item ? item.name : "the lead"} to the pipeline. Next: reply to schedule the call.`);
        await leave(button);
        await load();
        if (r.leadId) openById(r.leadId);
      });
      case "inbox-dismiss": {
        const item = d.inbox.find((i) => i.id === id);
        const ok = await confirmBox({ title: "Dismiss this inquiry?", text: `The inquiry from ${item ? item.name : "this person"} leaves your list. ${cfg.mode === "demo" ? "This is sample data, so nothing real changes." : "It stays stored in Catalyst."}`, action: "Dismiss" });
        if (!ok) return;
        return act(button, async () => { await call(`/api/inbox/${id}/dismiss`, "POST"); toast("Inquiry dismissed"); await leave(button); await load(); });
      }
      case "stale": return act(button, async () => {
        const body = { status: el.dataset.status }, row = d.stale.find((s) => s.id === id);
        if (body.status === "held" && !(row && row.follow_up_at)) { body.follow_up_at = addDays(d.today, FOLLOW_PLAN.held[0]); body.follow_up_note = FOLLOW_PLAN.held[1]; }
        await call("/api/leads/" + id, "PATCH", body);
        toast(body.follow_up_at ? `Marked as held. Follow-up set for ${niceDate(body.follow_up_at)}.` : `Marked as ${STATUS[body.status].label.toLowerCase()}`);
        await leave(button);
        await load();
      });
      case "fu": return act(button, async () => {
        const next = el.dataset.days === "done" ? "" : addDays(d.today, Number(el.dataset.days));
        await call("/api/leads/" + id, "PATCH", { follow_up_at: next, ...(next ? {} : { follow_up_note: "" }) });
        toast(next ? `Follow-up moved to ${niceDate(next)}` : "Follow-up done");
        await leave(button);
        await load();
      });
      case "tx-del": {
        const ok = await confirmBox({ title: "Delete this transaction?", text: "It comes off the balance. This can't be undone.", action: "Delete", danger: true });
        if (!ok) return;
        return act(button, async () => { await call("/api/transactions/" + id, "DELETE"); toast("Transaction deleted"); await load(); });
      }
      case "task-toggle": return act(button, async () => { await call("/api/tasks/" + id, "PATCH", { done: Boolean(el.dataset.done) }); await load(); });
      case "task-del": return act(button, async () => { await call("/api/tasks/" + id, "DELETE"); toast("Task deleted"); await load(); });
      case "time-del": {
        const ok = await confirmBox({ title: "Delete this time entry?", text: "The hours come off the lead's total. This can't be undone.", action: "Delete entry", danger: true });
        if (!ok) return;
        return act(button, async () => { await call("/api/time/" + id, "DELETE"); toast("Time entry deleted"); if (state.tab === "time") loadLeadTime(); await load(); });
      }
      case "draft": {
        const c = $("composeForm"), lead = state.lead;
        if (!lead || state.isNew) return;
        const label = button.querySelector("span");
        return act(button, async () => {
          label.textContent = "Drafting…";
          try {
            await call(`/api/leads/${lead.id}/draft`, "POST", { channel: c.channel.value, instructions: c.body.value.trim() });
          } finally { label.textContent = "Draft with AI"; }
          c.body.value = "";
          paintComposer();
          toast("Draft ready. Read it before you approve it.");
          await loadThread();
          await load();
        });
      }
      case "draft-approve": case "draft-discard": case "draft-open": {
        const li = el.closest("li"), lead = state.lead;
        if (!li || !lead) return;
        const subject = li.querySelector('[name="dsubject"]'), text = li.querySelector("textarea").value.trim();
        const ch = li.dataset.channel, to = ch === "email" ? lead.email : lead.phone;
        if (el.dataset.action === "draft-open") {
          window.location.href = ch === "email"
            ? `mailto:${encodeURI(to)}?subject=${encodeURIComponent(subject ? subject.value : "")}&body=${encodeURIComponent(text)}`
            : `sms:${to.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(text)}`;
          return;
        }
        if (el.dataset.action === "draft-discard") {
          return act(button, async () => { await call("/api/messages/" + id, "DELETE"); toast("Draft discarded"); await loadThread(); await load(); });
        }
        if (!text) { toast("The draft is empty. Write something or discard it.", true); return; }
        const send = el.dataset.send === "1";
        return act(button, async () => {
          let r;
          // A failed send is kept in the thread as "not sent", with the text as it was, ready to retry.
          try { r = await call(`/api/messages/${id}/approve`, "POST", { subject: subject ? subject.value : "", body: text, send }); }
          catch (err) { await loadThread(); throw err; }
          sentNote(r, send ? `${ch === "email" ? "Email" : "Text"} sent to ${to}` : "Saved to the log as sent");
          await loadThread();
          await load();
        });
      }
      case "msg-del": {
        const ok = await confirmBox({ title: "Delete this message?", text: "It's removed from the log. If it was sent, the other person still has it.", action: "Delete message", danger: true });
        if (!ok) return;
        return act(button, async () => { await call("/api/messages/" + id, "DELETE"); toast("Message deleted"); if (state.lead && !state.isNew) await loadThread(); await load(); });
      }
    }
  }

  function onChange(e) {
    const el = e.target.closest("[data-change]");
    if (el && el.dataset.change === "move") moveLead(el.dataset.id, el.value);
    if (el && el.dataset.change === "tx-kind" && el.value) {
      el.disabled = true;
      call("/api/transactions/" + el.dataset.id, "PATCH", { kind: el.value })
        .then(() => toast(`Saved as ${KIND[el.value][0].toLowerCase()}`), (err) => toast(err.message || "Couldn't save the category.", true))
        .finally(load);
    }
  }
  /** Go to an entry's row in the Money table and mark it for a moment. */
  let txTimer = 0;
  function showTx(key) {
    state.txFocus = key;
    state.moneyTab = "all";
    clearTimeout(txTimer);
    txTimer = setTimeout(() => { state.txFocus = ""; }, 2600);
    const land = () => { const row = $("tx-" + key); if (row) row.scrollIntoView({ block: "center" }); };
    if (state.view !== "money") { setView("money"); setTimeout(land, 450); } else { renderView(); land(); }
  }
  /** After a send: say it went, and say so plainly if the log couldn't be updated to match. */
  function sentNote(r, text) {
    if (r && r.recorded === false) toast("It was sent, but the log couldn't be updated and still says sending. Don't send it again: use Mark as sent.", true);
    else toast(text);
  }
  function onInput(e) {
    const el = e.target.closest("[data-input]");
    if (el && el.dataset.input === "lead-filter") { state.query = el.value; renderView(); }
  }

  async function moveLead(id, status) {
    const lead = state.data.leads.find((l) => l.id === id);
    if (!lead || lead.status === status || !STATUS[status]) return;
    const body = { status }, plan = FOLLOW_PLAN[status], before = lead.status;
    if (plan && !lead.follow_up_at) { body.follow_up_at = addDays(state.data.today, plan[0]); body.follow_up_note = plan[1]; }
    lead.status = status;
    renderView();
    try {
      const r = await call("/api/leads/" + id, "PATCH", body);
      savedNote(r, `${lead.name} moved to ${STATUS[status].label}${body.follow_up_at ? `. Follow-up set for ${niceDate(body.follow_up_at)}` : ""}`);
    } catch (err) {
      lead.status = before;
      toast(err.message || "Couldn't move the lead.", true);
    }
    await load();
  }

  function exportCsv() {
    const d = state.data;
    if (!d) return;
    // Cells that start with a formula character get a leading quote so spreadsheets don't run them.
    const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["name", "business", "email", "phone", "source", "status", "booked_at", "call_at", "paid_at", "follow_up_at", "follow_up_note", "value_usd", "hours", "notes"];
    const rows = d.leads.map((l) => [l.name, l.business, l.email, l.phone, l.source, l.status, l.booked_at, l.call_at, l.paid_at, l.follow_up_at, l.follow_up_note, (l.value_cents / 100).toFixed(2), l.hours, l.notes].map(cell).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `heurial-leads-${d.today}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${plural(d.leads.length, "lead")}`);
  }

  // ---------- Pipeline drag and drop (mouse, trackpad and touch; press and hold on phones) ----------
  let drag = null, suppressClick = false, flyFrom = null; // flyFrom: where a dropped card was let go, so it travels on from there
  function bindDrag(view) {
    view.addEventListener("pointerdown", (e) => {
      const card = e.target.closest(".board .card");
      if (!card || e.button !== 0 || e.target.closest("select")) return;
      const touch = e.pointerType === "touch";
      drag = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, active: false, ready: !touch };
      if (touch) drag.timer = setTimeout(() => { if (drag && !drag.active) { drag.ready = true; card.classList.add("lifted"); if (navigator.vibrate) navigator.vibrate(10); } }, 280);
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
        if (!drag.ready) return cancelDrag(); // the finger moved before the hold finished: it's a scroll
        const r = drag.card.getBoundingClientRect();
        drag.active = true; drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top;
        drag.ghost = drag.card.cloneNode(true);
        drag.ghost.classList.add("ghost"); drag.ghost.classList.remove("lifted"); drag.ghost.style.width = r.width + "px";
        document.body.appendChild(drag.ghost);
        drag.card.classList.add("dragging");
        document.body.classList.add("is-dragging");
      }
      drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)`;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const lane = hit ? hit.closest(".lane") : null;
      view.querySelectorAll(".lane.over").forEach((l) => l !== lane && l.classList.remove("over"));
      if (lane) lane.classList.add("over");
      drag.lane = lane;
      const board = view.querySelector(".board"), b = board.getBoundingClientRect();
      if (e.clientX > b.right - 48) board.scrollLeft += 14; else if (e.clientX < b.left + 48) board.scrollLeft -= 14;
    });
    window.addEventListener("pointerup", (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const { active, lane, id } = drag;
      if (active && lane && drag.ghost) flyFrom = { id, box: drag.ghost.getBoundingClientRect() };
      cancelDrag();
      if (!active) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      if (lane) moveLead(id, lane.dataset.status);
    });
    window.addEventListener("pointercancel", cancelDrag);
    view.addEventListener("touchmove", (e) => { if (drag && drag.ready) e.preventDefault(); }, { passive: false });
    view.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".board")) e.preventDefault(); });
  }
  function cancelDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.ghost) drag.ghost.remove();
    drag.card.classList.remove("dragging", "lifted");
    document.querySelectorAll(".lane.over").forEach((l) => l.classList.remove("over"));
    document.body.classList.remove("is-dragging");
    drag = null;
  }

  // ---------- Lead panel ----------
  const fieldError = (id, input, message) => {
    const el = $(id);
    el.textContent = message || ""; el.hidden = !message;
    if (input) { if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
  };

  /** True if it's fine to replace or close what's in the panel. */
  async function leaveDirty() {
    if (!state.dirty && !state.ctxDirty) return true;
    const ok = await confirmBox({ title: "Discard unsaved changes?", text: "You've edited this lead without saving.", action: "Discard changes", danger: true });
    if (ok) state.ctxDirty = false;
    return ok;
  }

  async function openById(id, tab) {
    try {
      const lead = state.data.leads.find((l) => l.id === String(id)) || await call("/api/leads/" + id);
      await openLead(lead, tab);
    } catch (err) { toast(err.message || "Couldn't open that lead.", true); }
  }

  /** Show a lead in the panel, or a blank form for a new one (lead = null). */
  async function openLead(lead, tab) {
    const same = Boolean(lead && state.lead && !state.isNew && state.lead.id === lead.id);
    if (!same && !(await leaveDirty())) return;
    state.lead = lead;
    state.isNew = !lead;
    if (!same) { state.dirty = false; state.ctxDirty = false; state.thread = null; state.leadTime = null; }
    state.tab = lead ? (tab || (same ? state.tab : "timeline")) : "details";
    $("insp").hidden = false;
    paintInspector(!same);
    showTab(state.tab);
    renderView(); // selection highlight, and layout when the panel docks
    if (!lead) $("leadForm").name.focus();
  }

  async function closeInspector() {
    if ($("insp").hidden || !(await leaveDirty())) return;
    const id = state.lead && state.lead.id;
    state.lead = null; state.isNew = false; state.dirty = false; state.ctxDirty = false;
    $("insp").hidden = true;
    renderView();
    const back = id && [...$("view").querySelectorAll("[data-fk]")].find((x) => ["row-" + id, "card-" + id, "who-" + id].includes(x.dataset.fk));
    if (back) back.focus({ preventScroll: true });
  }

  /** After new data arrives: refresh the header and counts, and the form too unless it has unsaved edits. */
  function syncInspector() {
    if ($("insp").hidden) return;
    if (state.lead && !state.isNew && state.data) {
      const fresh = (state.all || state.data.leads).find((l) => l.id === state.lead.id);
      if (fresh) state.lead = fresh;
    }
    paintInspector(!state.dirty && !state.isNew);
  }

  function paintInspector(fillForm) {
    const lead = state.lead, d = state.data, f = $("leadForm");
    $("inspTag").innerHTML = lead ? tag(lead.status) : `<span class="tag" style="--c:var(--accent)">New</span>`;
    $("inspName").textContent = lead ? lead.name : "New lead";
    $("inspSub").textContent = lead ? [lead.business, lead.source, lead.email, lead.phone].filter(Boolean).join(" · ") : "A newly booked call. You can change the stage later.";
    $("inspStats").hidden = !lead;
    $("inspTabs").hidden = !lead;
    if (lead) {
      // What was proposed and what was actually received are different numbers, and are never added together.
      const got = receivedFrom(lead).reduce((sum, e) => sum + e.cents, 0);
      $("inspStats").innerHTML = [["Proposed", lead.value_cents ? money(lead.value_cents) : "–"], ["Received", got ? money(got) : "–"], ["Hours", lead.hours ? hrs(lead.hours) : "–"], ["Follow-up", lead.follow_up_at ? dueTag(lead.follow_up_at) : "–"]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
      const msgN = state.thread ? state.thread.length : d && d.messages ? d.messages.filter((m) => m.lead_id === lead.id).length : 0;
      const timeN = state.leadTime ? state.leadTime.length : state.time ? state.time.filter((t) => t.lead_id === lead.id).length : 0;
      $("msgCount").hidden = !msgN; $("msgCount").textContent = msgN;
      $("timeCount").hidden = !timeN; $("timeCount").textContent = timeN;
    }
    if (fillForm) {
      for (const [id, name] of [["e-name", "name"], ["e-email", "email"], ["e-value", "value"]]) fieldError(id, f[name], "");
      f.name.value = lead ? lead.name : ""; f.business.value = lead ? lead.business : ""; f.email.value = lead ? lead.email : "";
      f.phone.value = lead ? lead.phone || "" : ""; f.source.value = lead ? lead.source : ""; f.status.value = lead ? lead.status : "booked";
      f.value.value = lead ? lead.value_cents / 100 || "" : "";
      f.booked_at.value = lead ? lead.booked_at : d.today; f.call_at.value = lead ? lead.call_at : ""; f.notes.value = lead ? lead.notes : "";
      f.follow_up_at.value = lead ? lead.follow_up_at : ""; f.follow_up_note.value = lead ? lead.follow_up_note : "";
      f.paid_at.value = lead ? lead.paid_at || "" : "";
      paintPaidField();
      const known = ["Referral", "Personal network", "Cold outreach", "Website", "Social media", "Partner", "Other", ...d.leads.map((l) => l.source)];
      $("sourceList").innerHTML = [...new Set(known)].map((s) => `<option>${esc(s)}</option>`).join("");
      state.dirty = false;
      paintFormState("");
    }
    if (!state.ctxDirty) { $("ctxForm").notes.value = lead ? lead.notes : ""; paintCtx(""); }
    paintComposer();
    if (lead && !state.isNew && state.tab === "timeline") paintTimeline();
  }
  /** "Paid on" sits beside the value for paid leads only. A lead that is just becoming paid starts on today. */
  function paintPaidField() {
    const f = $("leadForm"), paid = f.status.value === "paid";
    $("paidField").hidden = !paid;
    f.value.closest(".field").classList.toggle("wide", !paid);
    if (paid && !f.paid_at.value && !(state.lead && !state.isNew && state.lead.status === "paid")) f.paid_at.value = state.data.today;
    $("paidHint").hidden = !(state.lead && !state.isNew && receivedFrom(state.lead).some((e) => !e.derived));
  }
  /** What to say after a save. The lead itself saved; a Leads table with no paid_at column can't keep its paid date. */
  function savedNote(r, text) {
    const undated = Boolean(r && r.paid_at_saved === false), unpaid = Boolean(r && r.payment_saved === false);
    const notes = [undated && "The paid date wasn't saved: the Leads table may still need its paid_at column.",
      unpaid && "The payment wasn't recorded on Money: the Transactions table may need its lead_id column.",
      r && r.payment_saved === true && "Its payment is recorded on Money."].filter(Boolean);
    toast([text.replace(/\.?$/, notes.length ? "." : ""), ...notes].join(" "), undated || unpaid);
  }
  let savedTimer = 0;
  function paintFormState(error) {
    $("delBtn").hidden = state.isNew || !state.lead;
    // Right after a save the button turns green and says Saved, so there is no doubt it went through.
    const saved = !state.isNew && !state.dirty && Date.now() - (state.savedAt || 0) < 1800;
    $("saveBtn").textContent = state.isNew ? "Add lead" : saved ? "Saved" : "Save changes";
    $("saveBtn").classList.toggle("is-saved", saved);
    clearTimeout(savedTimer);
    if (saved) savedTimer = setTimeout(() => { if (!$("insp").hidden) paintFormState(""); }, 1850);
    $("saveBtn").disabled = !state.isNew && !state.dirty;
    const note = $("leadNote");
    note.textContent = error || (state.dirty && !state.isNew ? "Unsaved changes" : "");
    note.classList.toggle("err", Boolean(error));
  }

  function showTab(tab) {
    if (!state.lead || state.isNew) tab = "details";
    state.tab = tab;
    for (const [key, , panel] of TABS) {
      $("tab-" + key).setAttribute("aria-selected", String(key === tab));
      $(panel).hidden = key !== tab;
    }
    if (tab === "timeline") { paintTimeline(); loadThread(); loadLeadTime(); }
    if (tab === "messages") { paintComposer(); loadThread(); }
    if (tab === "time") { $("leadTimeForm").entry_date.value = $("leadTimeForm").entry_date.value || state.data.today; loadLeadTime(); }
  }

  // Timeline tab: one client's whole story in date order, from records the tracker already has.
  function timelineEvents(lead) {
    const today = state.data.today, ev = [];
    const add = (when, ic, title, text, cls) => ev.push({ when, ic, title, text: text || "", cls: cls || "" });
    if (lead.booked_at) add(lead.booked_at, "leads", "Call booked", `Source: ${lead.source}`);
    if (lead.call_at) add(lead.call_at, "phone", lead.call_at > today ? "Call scheduled" : lead.status === "booked" ? "Call date passed, no outcome recorded" : lead.status === "no_show" ? "Call: no-show" : "Call held", "", lead.call_at > today ? "ahead" : "");
    for (const m of state.thread || []) {
      const [label, ic] = CHANNEL[m.channel] || CHANNEL.note;
      const title = m.status === "draft" ? `${label} draft waiting for your approval` : m.status === "failed" ? `${label} not sent: sending failed`
        : m.channel === "note" ? "Note" : `${label} ${m.direction === "in" ? "from them" : "from me"}${m.status === "sent" ? " · sent" : ""}`;
      add(m.created_at, ic, title, `${m.subject ? `${m.subject}: ` : ""}${m.body}`);
    }
    for (const t of state.leadTime || []) add(t.entry_date, "time", `Logged ${hrs(t.hours)} h`, t.note);
    for (const e of moneyEntries().filter((x) => x.kind === "income" && x.lead_id === lead.id)) {
      add(e.date, "wallet", `${e.date > today ? "Payment scheduled" : "Payment received"} · ${money(e.cents)}`, e.derived ? "Read from the lead: not yet recorded as a payment" : e.label, e.date > today ? "ahead" : "paid");
    }
    if (lead.follow_up_at) add(lead.follow_up_at, "tasks", "Next action", lead.follow_up_note || "Follow up", lead.follow_up_at < today ? "late" : "ahead");
    return ev.sort((a, b) => a.when.localeCompare(b.when));
  }
  function paintTimeline() {
    const lead = state.lead;
    if (!lead || state.isNew) return;
    const got = receivedFrom(lead), sum = got.reduce((s, e) => s + e.cents, 0);
    $("tlFacts").innerHTML = [
      ["Stage", tag(lead.status)],
      ["Proposed", lead.value_cents ? `<b class="num">${money(lead.value_cents)}</b> quoted, not money received` : "No value set"],
      ["Received", sum ? `<b class="num">${money(sum)}</b> ${got.length === 1 ? `on ${niceDate(got[0].date)}` : `in ${got.length} payments`}` : "Nothing yet"],
      ["Next action", lead.follow_up_at ? `${esc(lead.follow_up_note || "Follow up")} ${dueTag(lead.follow_up_at)}` : `None set <button class="more" type="button" data-action="tab" data-tab="details">Set one in Details</button>`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const catchKey = `lead-${lead.id}-catch_up`, taskKey = `lead-${lead.id}-extract_tasks`;
    $("tlAi").innerHTML = has("assist")
      ? `<div class="tl-ai-btns">${aiButton(catchKey, "catch_up", lead.id, "Catch me up")}${aiButton(taskKey, "extract_tasks", lead.id, "Tasks from my notes")}</div>${aiBox(catchKey)}${aiBox(taskKey)}`
      : "";
    const today = state.data.today, ev = timelineEvents(lead);
    let split = false;
    $("tl").innerHTML = ev.map((e) => {
      const ahead = e.when.slice(0, 10) > today, mark = ahead && !split ? `<li class="tl-now">Today, ${niceDate(today)}</li>` : "";
      if (ahead) split = true;
      return `${mark}<li class="tl-i ${e.cls}"><time datetime="${esc(e.when)}">${niceDate(e.when.slice(0, 10))}</time><i>${icon(e.ic)}</i><div><b>${esc(e.title)}</b>${e.text ? `<p>${esc(e.text)}</p>` : ""}</div></li>`;
    }).join("") + (state.thread && state.leadTime ? "" : `<li class="tl-now">Loading messages and time…</li>`);
  }
  /** The context note's own Saving / Saved / Failed line. The text stays in the box whatever happens. */
  function paintCtx(note, isError) {
    $("ctxNote").textContent = note || (state.ctxDirty ? "Unsaved changes" : "");
    $("ctxNote").classList.toggle("err", Boolean(isError));
    $("ctxSave").disabled = !state.ctxDirty;
  }

  // Messages tab
  async function loadThread() {
    const lead = state.lead;
    if (!lead || state.isNew) return;
    if (!state.thread) $("thread").innerHTML = `<li class="thread-empty">Loading…</li>`;
    try {
      const items = await call(`/api/leads/${lead.id}/messages`);
      if (!state.lead || state.lead.id !== lead.id) return;
      state.thread = items;
      paintThread();
      if (state.tab === "timeline") paintTimeline();
    } catch {
      $("thread").innerHTML = `<li class="thread-empty">Couldn't load messages.</li>`;
    }
  }
  function paintThread() {
    const list = $("thread"), items = state.thread || [], lead = state.lead || {}, sv = services() || {}, demo = cfg.mode === "demo";
    // Keep any edits in an open draft when the thread repaints.
    const kept = {};
    for (const li of list.querySelectorAll("li.draft")) {
      const subj = li.querySelector('[name="dsubject"]');
      kept[li.dataset.id] = { subject: subj ? subj.value : null, body: li.querySelector("textarea").value };
    }
    const draft = (m) => {
      const [label] = CHANNEL[m.channel] || CHANNEL.email;
      const k = kept[m.id] || {}, to = m.channel === "email" ? lead.email : lead.phone;
      const canSend = !demo && to && (m.channel === "email" ? sv.email : sv.sms);
      const failed = m.status === "failed";
      const note = demo ? "Sample data: nothing is sent from this page."
        : !to ? `Add ${m.channel === "email" ? "an email address" : "a phone number"} in Details to send it.`
        : canSend ? `Sends to ${to} when you approve it.`
        : `${m.channel === "email" ? "Email" : "Text"} sending isn't connected. Send it yourself, then mark it sent.`;
      return `<li class="msg mine draft" data-id="${m.id}" data-channel="${m.channel}">
        <div class="msg-meta"><b>${icon(failed ? "send" : "spark")}${label}${failed ? "" : " draft"}</b><span>${failed ? "Sending failed · not sent" : "Written by AI · not sent"}</span><time datetime="${esc(m.created_at)}">${stamp(m.created_at)}</time></div>
        ${m.channel === "email" ? `<input class="in" name="dsubject" maxlength="200" aria-label="Draft subject" value="${esc(k.subject ?? m.subject)}">` : ""}
        <textarea class="in" rows="5" maxlength="4000" aria-label="Draft ${label.toLowerCase()}">${esc(k.body ?? m.body)}</textarea>
        <div class="draft-foot"><span class="form-note">${esc(note)}</span>
          <button class="btn ghost sm" type="button" data-action="draft-discard" data-id="${m.id}">Discard</button>
          ${!canSend && to ? `<button class="btn sm" type="button" data-action="draft-open" data-id="${m.id}">Open in ${m.channel === "email" ? "mail" : "text"} app</button>` : ""}
          <button class="btn primary sm" type="button" data-action="draft-approve" data-id="${m.id}" data-send="${canSend ? 1 : 0}">${canSend ? `${icon("send")}${failed ? "Try sending again" : "Approve and send"}` : `${icon("check")}Mark as sent`}</button></div></li>`;
    };
    list.innerHTML = items.length ? items.map((m) => {
      if (m.status === "draft" || m.status === "failed") return draft(m);
      const [label, ic] = CHANNEL[m.channel] || CHANNEL.note;
      const who = m.channel === "note" ? "" : m.direction === "in" ? "From them" : "From me";
      const unsure = m.status === "sending";
      const how = unsure ? "Sent or still sending: the result wasn't recorded" : m.status === "sent" ? "Sent" : m.status === "received" ? (m.sender ? `Received from ${esc(m.sender)}` : "Received") : m.channel === "note" ? "" : "Logged, not sent from here";
      return `<li class="msg ${m.channel === "note" ? "note" : m.direction === "in" ? "theirs" : "mine"}">
        <div class="msg-meta"><b>${icon(ic)}${label}</b><span>${[who, how].filter(Boolean).join(" · ")}</span><time datetime="${esc(m.created_at)}">${stamp(m.created_at)}</time>
          <button class="btn ghost sm icon" type="button" data-action="msg-del" data-id="${m.id}" aria-label="Delete this ${label.toLowerCase()}">${icon("x")}</button></div>
        ${m.subject ? `<p class="msg-subj">${esc(m.subject)}</p>` : ""}<p class="msg-body">${esc(m.body)}</p>
        ${unsure ? `<div class="draft-foot"><span class="form-note">Check with them before sending anything again.</span><button class="btn sm" type="button" data-action="msg-confirm" data-id="${m.id}">${icon("check")}Mark as sent</button></div>` : ""}</li>`;
    }).join("") : `<li class="thread-empty">Nothing logged with this lead yet.<br>Write a note, log a call, or write an email or text below.</li>`;
    list.scrollTop = list.scrollHeight;
    $("msgCount").hidden = !items.length; $("msgCount").textContent = items.length;
  }
  /** Set the composer's labels and buttons for the chosen type, and say plainly whether it will really send. */
  function paintComposer() {
    const f = $("composeForm"), lead = state.lead, sv = services() || {}, demo = cfg.mode === "demo";
    if (!f || !lead) return;
    const ch = f.channel.value || "note", out = ch === "note" || f.direction.value === "out";
    const to = ch === "email" ? lead.email : ch === "sms" ? lead.phone : "";
    const connected = out && !demo && ((ch === "email" && sv.email) || (ch === "sms" && sv.sms));
    const willSend = Boolean(connected && to && !f.logonly.checked);
    $("composeMeta").hidden = ch === "note";
    $("composeMeta").classList.toggle("solo", ch !== "email");
    f.subject.hidden = ch !== "email";
    f.body.placeholder = ch === "note" ? "Write a note about this lead…" : ch === "call" ? "What was said on the call…" : out ? `Write the ${ch === "email" ? "email" : "text"}…` : "Paste what they wrote…";
    $("composeBtn").innerHTML = ch === "note" ? "Save note" : ch === "call" ? "Log call" : willSend ? `${icon("send")}Send ${ch === "email" ? "email" : "text"}` : out ? "Log as sent" : "Log reply";
    $("logOnlyWrap").hidden = !(connected && to);
    $("draftBtn").hidden = !((ch === "email" || ch === "sms") && out && (demo || sv.ai));
    const kind = ch === "email" ? "Email" : "Text";
    let hint = "";
    if ((ch === "email" || ch === "sms") && out) {
      if (demo) hint = "Sample data: this is only added to the log.";
      else if (!to) hint = `Add ${ch === "email" ? "an email address" : "a phone number"} in Details to ${connected ? "send" : "reach them"}.`;
      else if (willSend) hint = `Sends to ${to}.`;
      else if (connected) hint = "Saved to the log only.";
      else hint = `${kind} sending isn't connected, so this is saved to the log. Send it yourself.`;
    }
    $("composeHint").textContent = hint;
    const open = $("composeOpen"), showOpen = (ch === "email" || ch === "sms") && out && to && !willSend;
    open.hidden = !showOpen;
    if (showOpen) {
      open.textContent = ch === "email" ? "Open in mail app" : "Open in text app";
      open.href = ch === "email"
        ? `mailto:${encodeURI(to)}?subject=${encodeURIComponent(f.subject.value)}&body=${encodeURIComponent(f.body.value)}`
        : `sms:${to.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(f.body.value)}`;
    }
    return willSend;
  }

  // Time tab
  async function loadLeadTime() {
    const lead = state.lead;
    if (!lead || state.isNew) return;
    if (!state.leadTime) $("tList").innerHTML = `<li class="none">Loading…</li>`;
    try {
      const list = await call(`/api/leads/${lead.id}/time`);
      if (!state.lead || state.lead.id !== lead.id) return;
      state.leadTime = list;
      if (state.tab === "timeline") paintTimeline();
      $("tList").innerHTML = list.length ? list.map((t) => `
        <li><span class="num">${niceDate(t.entry_date)}</span><b class="num">${hrs(t.hours)} h</b><span class="n" title="${esc(t.note)}">${esc(t.note || "–")}</span>
        <button class="btn ghost sm icon" type="button" data-action="time-del" data-id="${t.id}" aria-label="Delete ${hrs(t.hours)} hours on ${niceDate(t.entry_date)}">${icon("x")}</button></li>`).join("")
        : `<li class="none">No time logged on this lead yet.</li>`;
      const total = list.reduce((s, t) => s + t.hours, 0), cur = state.lead;
      $("tTotal").innerHTML = total ? `Total <b class="num">${hrs(total)} h</b>${cur.value_cents && cur.status === "paid" ? ` · <b class="num">${money(cur.value_cents / total)}</b> per hour on this project` : ""}` : "";
      $("timeCount").hidden = !list.length; $("timeCount").textContent = list.length;
    } catch {
      $("tList").innerHTML = `<li class="none">Couldn't load time entries.</li>`;
    }
  }

  function bindInspector() {
    const f = $("leadForm");
    const touch = () => { if (!state.dirty) { state.dirty = true; paintFormState(""); } };
    f.addEventListener("input", touch);
    f.addEventListener("change", (e) => {
      touch();
      // Suggest a follow-up when the stage changes, but only into empty fields.
      if (e.target.name !== "status") return;
      paintPaidField();
      const plan = FOLLOW_PLAN[e.target.value];
      if (!plan || f.follow_up_at.value) return;
      f.follow_up_at.value = addDays(state.data.today, plan[0]);
      if (!f.follow_up_note.value) f.follow_up_note.value = plan[1];
    });
    f.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fu]");
      if (!b) return;
      if (b.dataset.fu === "clear") { f.follow_up_at.value = ""; f.follow_up_note.value = ""; }
      else { f.follow_up_at.value = addDays(state.data.today, Number(b.dataset.fu)); if (!f.follow_up_note.value) f.follow_up_note.focus(); }
      touch();
    });

    let saving = false;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (saving) return;
      const name = f.name.value.trim(), email = f.email.value.trim(), value = f.value.value === "" ? 0 : Number(f.value.value);
      fieldError("e-name", f.name, name ? "" : "Enter a name.");
      fieldError("e-email", f.email, !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a full email address, like name@example.com.");
      fieldError("e-value", f.value, Number.isFinite(value) && value >= 0 ? "" : "Enter an amount of 0 or more.");
      const bad = f.querySelector('[aria-invalid="true"]');
      if (bad) { bad.focus(); return; }
      const editing = state.isNew ? null : state.lead;
      const body = { name, business: f.business.value, email, phone: f.phone.value, source: f.source.value, status: f.status.value, value,
        booked_at: f.booked_at.value, call_at: f.call_at.value, paid_at: f.paid_at.value, notes: f.notes.value, follow_up_at: f.follow_up_at.value, follow_up_note: f.follow_up_note.value };
      const save = $("saveBtn");
      saving = true; save.disabled = true; save.textContent = "Saving…"; paintFormStateNote("");
      try {
        if (editing) {
          const r = await call("/api/leads/" + editing.id, "PATCH", body);
          state.dirty = false;
          state.savedAt = Date.now();
          savedNote(r, `Saved ${name}`);
          await load();
        } else {
          const r = await call("/api/leads", "POST", body);
          state.dirty = false; state.isNew = false;
          savedNote(r, `Added ${name}`);
          await load();
          if (r && r.id) await openById(r.id); else closeInspector();
        }
      } catch (err) {
        paintFormState(err.message || "Couldn't save. Try again.");
      } finally {
        saving = false;
        if (!$("insp").hidden) paintFormState($("leadNote").classList.contains("err") ? $("leadNote").textContent : "");
      }
    });
    const paintFormStateNote = (text) => { $("leadNote").textContent = text; $("leadNote").classList.remove("err"); };

    $("delBtn").addEventListener("click", async () => {
      const lead = state.lead;
      if (!lead) return;
      const ok = await confirmBox({ title: `Delete ${lead.name}?`, text: "This removes the lead with its messages and logged time. Payments already recorded stay on Money. It can't be undone.", action: "Delete lead", danger: true });
      if (!ok) return;
      act($("delBtn"), async () => {
        await call("/api/leads/" + lead.id, "DELETE");
        state.dirty = false; state.lead = null; state.isNew = false;
        $("insp").hidden = true;
        toast(`Deleted ${lead.name}`);
        await load();
      });
    });

    const ctx = $("ctxForm");
    ctx.addEventListener("input", () => { state.ctxDirty = true; paintCtx(""); });
    ctx.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lead = state.lead, text = ctx.notes.value;
      if (!lead || !state.ctxDirty || $("ctxSave").dataset.busy) return;
      $("ctxSave").dataset.busy = "1"; $("ctxSave").disabled = true;
      paintCtx("Saving…");
      try {
        await call("/api/leads/" + lead.id, "PATCH", { notes: text });
        state.ctxDirty = false;
        if (!state.dirty) f.notes.value = text;
        paintCtx("Saved");
        await load();
        paintCtx("Saved");
      } catch (err) {
        paintCtx(`Not saved: ${err.message || "try again"}. Your text is still here.`, true);
        $("ctxSave").disabled = false;
      } finally { delete $("ctxSave").dataset.busy; }
    });
    $("reviewDlg").addEventListener("close", () => { if (state.review) closeReview(); });

    const c = $("composeForm");
    c.addEventListener("change", paintComposer);
    c.addEventListener("input", paintComposer);
    let sending = false;
    c.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lead = state.lead, text = c.body.value.trim();
      if (sending || !lead) return;
      fieldError("composeErr", c.body, text ? "" : "Write something first.");
      if (!text) { c.body.focus(); return; }
      const ch = c.channel.value, willSend = paintComposer();
      const to = ch === "email" ? lead.email : lead.phone;
      sending = true;
      await act($("composeBtn"), async () => {
        let r;
        // If sending fails, the message is kept in the thread as "not sent", so nothing typed is lost.
        try { r = await call("/api/messages", "POST", { lead_id: lead.id, channel: ch, direction: ch === "note" ? "out" : c.direction.value, subject: c.subject.value, body: text, send: willSend }); }
        catch (err) { if (willSend) { await loadThread(); if ((state.thread || []).some((m) => m.status === "failed" && m.body === text)) { c.body.value = ""; c.subject.value = ""; } } throw err; }
        sentNote(r, r.status === "sent" ? `${ch === "email" ? "Email" : "Text"} sent to ${to}` : "Saved to the log");
        c.body.value = ""; c.subject.value = ""; c.logonly.checked = false;
        await loadThread();
        await load();
      });
      sending = false;
      paintComposer();
    });

    const t = $("leadTimeForm");
    t.addEventListener("submit", (e) => {
      e.preventDefault();
      const hours = Number(t.hours.value), lead = state.lead;
      if (!(hours > 0 && hours <= 24)) { fieldError("e-time", t.hours, "Enter hours between 0.25 and 24."); t.hours.focus(); return; }
      fieldError("e-time", t.hours, "");
      act(t.querySelector('[type="submit"]'), async () => {
        await call("/api/time", "POST", { lead_id: lead.id, entry_date: t.entry_date.value, hours, note: t.note.value });
        t.hours.value = ""; t.note.value = "";
        toast(`Logged ${hrs(hours)} h`);
        await loadLeadTime();
        await load();
      });
    });
  }

  /** The Log time bar on the Time section. */
  function onTimeAdd(form) {
    const err = $("timeAddErr"), hours = Number(form.hours.value);
    const fail = (message, field) => { err.textContent = message; err.hidden = false; field.focus(); };
    if (!form.lead_id.value) return fail("Choose the lead this time was for.", form.lead_id);
    if (!(hours > 0 && hours <= 24)) return fail("Enter hours between 0.25 and 24.", form.hours);
    err.hidden = true;
    act(form.querySelector('[type="submit"]'), async () => {
      await call("/api/time", "POST", { lead_id: form.lead_id.value, entry_date: form.entry_date.value, hours, note: form.note.value });
      form.hours.value = ""; form.note.value = "";
      toast(`Logged ${hrs(hours)} h`);
      if (state.lead && state.lead.id === form.lead_id.value && state.tab === "time") loadLeadTime();
      await load();
    });
  }

  /** The Add transaction bar on the Money screen. */
  function onTxAdd(form) {
    const err = $("txAddErr"), amount = Number(form.amount.value);
    const fail = (message, field) => { err.textContent = message; err.hidden = false; field.focus(); };
    if (!(amount > 0)) return fail("Enter an amount above 0.", form.amount);
    const client = form.kind.value === "income" ? form.lead_id.value : "";
    if (form.lead_id.value && !client) return fail("Only income can be linked to a client. Choose No client, or change the type.", form.lead_id);
    // A client's payment can go without a description: it is named after them.
    const label = form.label.value.trim() || (client ? `Payment from ${form.lead_id.selectedOptions[0].textContent.split(" · ")[0]}` : "");
    if (!label) return fail("Add a short description.", form.label);
    err.hidden = true;
    act(form.querySelector('[type="submit"]'), async () => {
      await call("/api/transactions", "POST", { kind: form.kind.value, date: form.date.value, amount, label, ...(client ? { lead_id: client } : {}) });
      form.amount.value = ""; form.label.value = ""; form.lead_id.value = "";
      form.date.value = state.data.today; // back to today, so the next entry isn't dated ahead by accident
      toast("Transaction added");
      await load();
    });
  }
  /** The Add task bar on the Tasks screen. */
  function onTaskAdd(form) {
    const err = $("taskAddErr");
    if (!form.title.value.trim()) { err.textContent = "Say what the task is."; err.hidden = false; return form.title.focus(); }
    err.hidden = true;
    act(form.querySelector('[type="submit"]'), async () => {
      await call("/api/tasks", "POST", { title: form.title.value, due_at: form.due_at.value });
      form.title.value = ""; form.due_at.value = "";
      state.taskTab = "open";
      toast("Task added");
      await load();
    });
  }

  // ---------- Command bar ----------
  let palItems = [], palAt = 0;
  function openPalette() {
    const dlg = $("palette");
    if (dlg.open) return;
    $("palInput").value = "";
    paintPalette();
    dlg.showModal();
    $("palInput").focus();
  }
  function paintPalette() {
    const q = $("palInput").value.trim().toLowerCase(), d = state.data;
    const dark = (document.documentElement.dataset.theme || "light") === "dark";
    const items = [];
    if (d && q) for (const l of d.leads.filter((x) => matches(x, q)).slice(0, 7)) items.push({ group: "Leads", ic: "leads", label: l.name, hint: [l.business, STATUS[l.status].label].filter(Boolean).join(" · "), run: () => openById(l.id) });
    const commands = [
      ["Actions", "plus", "New lead", "N", () => { if (state.data) openLead(null); }],
      ["Actions", "tasks", "Start daily review", "", () => { setView("tasks"); startReview(); }],
      ["Actions", "time", "Log time", "", () => { setView("time"); const el = $("view").querySelector('[data-fk="t-lead"]'); if (el) el.focus(); }],
      ...Object.keys(VIEWS).map((key, i) => ["Go to", VIEWS[key][1], VIEWS[key][0], String(i + 1), () => setView(key)]),
      ["Actions", "refresh", "Refresh data", "", () => load()],
      ["Actions", "down", "Export leads as CSV", "", exportCsv],
      ["Actions", "mail", "Preview the daily email", "", () => openDigest(null)],
      ["Actions", dark ? "sun" : "moon", dark ? "Switch to light mode" : "Switch to dark mode", "", toggleTheme],
      ...(cfg.auth ? [["Actions", "out", "Sign out", "", () => signOut(null)]] : []),
    ];
    for (const [group, ic, label, hint, run] of commands) if (!q || label.toLowerCase().includes(q)) items.push({ group, ic, label, hint, run });
    palItems = items;
    palAt = 0;
    let last = "";
    $("palList").innerHTML = items.length ? items.map((it, i) => {
      const head = it.group !== last ? `<div class="pal-group" role="presentation">${it.group}</div>` : "";
      last = it.group;
      return `${head}<div class="pal-item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === 0}">${icon(it.ic)}<span>${esc(it.label)}</span>${it.hint ? `<small>${it.group === "Leads" ? esc(it.hint) : `<kbd>${esc(it.hint)}</kbd>`}</small>` : ""}</div>`;
    }).join("") : `<p class="pal-empty">Nothing matches${d ? ` among leads booked ${inPeriod()}` : ""}.</p>`;
    $("palInput").setAttribute("aria-activedescendant", items.length ? "pal-0" : "");
  }
  function runPalette(i) {
    const item = palItems[i];
    if (!item) return;
    $("palette").close();
    item.run();
  }
  function bindPalette() {
    const input = $("palInput"), list = $("palList"), dlg = $("palette");
    input.addEventListener("input", paintPalette);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!palItems.length) return;
        palAt = (palAt + (e.key === "ArrowDown" ? 1 : -1) + palItems.length) % palItems.length;
        list.querySelectorAll(".pal-item").forEach((el, i) => el.setAttribute("aria-selected", String(i === palAt)));
        input.setAttribute("aria-activedescendant", "pal-" + palAt);
        $("pal-" + palAt).scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { e.preventDefault(); runPalette(palAt); }
    });
    list.addEventListener("click", (e) => { const it = e.target.closest(".pal-item"); if (it) runPalette(Number(it.dataset.i)); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }

  // ---------- Sign-in and wiring ----------
  function showSignIn(message) {
    if (!cfg.auth) return;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    $("signin").hidden = false;
    if (message !== undefined) $("signinErr").textContent = message;
    $("pw").focus();
  }

  function bind() {
    const view = $("view");
    document.addEventListener("click", onAction);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", (e) => {
      const form = e.target.closest("form[data-submit]");
      const run = form && { "time-add": onTimeAdd, "tx-add": onTxAdd, "task-add": onTaskAdd }[form.dataset.submit];
      if (run) { e.preventDefault(); run(form); }
    });
    bindDrag(view);
    bindInspector();
    bindPalette();
    paintTheme();
    document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    $("digestSend").addEventListener("click", () => act($("digestSend"), async () => {
      const r = await call("/api/digest", "POST");
      toast(r.sent ? `Sent: ${r.subject}` : "Sample data: no email was sent.");
      $("digestDlg").close();
    }));

    // Leads table: up and down move between rows; with the panel open, the panel follows.
    view.addEventListener("keydown", (e) => {
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !e.target.dataset || !String(e.target.dataset.fk || "").startsWith("row-")) return;
      const rows = [...view.querySelectorAll('#leadTable .who[data-fk^="row-"]')], next = rows[rows.indexOf(e.target) + (e.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      e.preventDefault();
      next.focus();
      if (!$("insp").hidden && !state.dirty && !state.isNew) openById(next.dataset.id);
    });

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (state.data) openPalette(); return; }
      if (document.querySelector("dialog[open]") || (cfg.auth && !$("signin").hidden)) return;
      const el = document.activeElement, typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (e.key === "Escape") { if (drag && drag.active) cancelDrag(); else if (!typing) closeInspector(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || !state.data) return;
      if (e.key === "/") { e.preventDefault(); openPalette(); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); openLead(null); }
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= Object.keys(VIEWS).length) setView(Object.keys(VIEWS)[Number(e.key) - 1]);
    });

    // Redraw the chart when the work area changes size (window resize, or the lead panel docking).
    let frame = 0;
    new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if ($("chart")) drawChart(); }); }).observe(view);
    // Coming back to the tab after a while: quietly bring the figures up to date.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !state.data || state.dirty || document.querySelector("dialog[open]")) return;
      if (Date.now() - state.lastSync > 60000) load();
    });

    if (cfg.auth) {
      $("signinForm").addEventListener("submit", (e) => {
        e.preventDefault();
        act($("signinBtn"), async () => {
          $("signinErr").textContent = "";
          try { await cfg.auth.signIn($("pw").value); }
          catch (err) { $("signinErr").textContent = err.message || "Couldn't sign in."; $("pw").select(); return; }
          $("pw").value = ""; $("signin").hidden = true;
          state.loading = true; render();
          await load();
        });
      });
    }
  }

  async function start(config) {
    cfg = config;
    // The sample-data page always opens on Overview and 30 days, and never shares saved preferences with the real tracker.
    const live = cfg.mode !== "demo";
    const view = live ? stored("hp-view", "overview") : "overview", range = live ? stored("hp-range", "30") : "30";
    state.view = VIEWS[view] ? view : "overview";
    state.range = RANGES.some((r) => r[0] === range) ? range : "30";
    mount();
    bind();
    render();
    if (cfg.auth) {
      try {
        const s = await cfg.auth.check();
        if (!s.configured) { state.loading = false; render(); showSignIn("Sign-in isn't set up yet. Add ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET to the site's settings."); return; }
        if (!s.signedIn) { state.loading = false; render(); showSignIn(""); return; }
      } catch {
        state.loading = false; state.error = "Couldn't reach the tracker. Check your connection and try again."; render(); return;
      }
    }
    if (location.hash) pendingLink = location.href;
    await load();
  }

  window.HeurialTracker = { start, open: follow };
})();
