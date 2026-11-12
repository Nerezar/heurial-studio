/* HEURIAL follow-up tracker: the shared app behind both the real tracker (/admin) and the public demo.
 *
 * Each page supplies its own data source and then calls:
 *   HeurialTracker.start({ mode, api, auth })
 *     mode  "live" or "demo"
 *     api   async (path, method, body) => JSON. Paths look like "/api/data?range=30". Throws Error with .status.
 *     auth  optional { check(), signIn(password), signOut() } for the real tracker's sign-in
 *
 * Everything on screen is drawn from the API's data; nothing here invents numbers or history.
 */
(function () {
  "use strict";

  const ORDER = ["booked", "held", "proposal", "paid", "lost", "no_show"];
  const OPEN = ["booked", "held", "proposal"];
  const STATUS = {
    booked: { label: "Call booked", tone: "t-open" },
    held: { label: "Call held", tone: "t-open" },
    proposal: { label: "Proposal sent", tone: "t-warn" },
    paid: { label: "Paid", tone: "t-ok" },
    lost: { label: "Lost", tone: "t-mute" },
    no_show: { label: "No-show", tone: "t-bad" },
  };
  // When a lead moves to one of these stages and has no follow-up, suggest one.
  const FOLLOW_PLAN = { held: [3, "Send a follow-up after the call"], proposal: [3, "Check in on the proposal"], paid: [14, "Ask for a testimonial"] };
  const RANGES = { 7: "last 7 days", 30: "last 30 days", 90: "last 90 days", 365: "last 12 months", all: "all time" };
  const VIEWS = {
    overview: { label: "Overview", icon: "overview" },
    pipeline: { label: "Pipeline", icon: "pipeline" },
    leads: { label: "Leads", icon: "leads" },
    time: { label: "Time", icon: "time" },
  };
  const ICONS = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    pipeline: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
    leads: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.9 3 2.8 3 5.7"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    down: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
  };
  const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- Formatting ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (cents) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
  const hrs = (h) => (Math.round(h * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const at = (s) => new Date(s + "T12:00:00");
  const addDays = (s, n) => {
    const d = at(s); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const dayDiff = (a, b) => Math.round((at(a) - at(b)) / 864e5);
  /** "Nov 12", with the year added when it isn't this year. */
  function niceDate(s) {
    if (!s) return "–";
    const sameYear = !state.data || s.slice(0, 4) === state.data.today.slice(0, 4);
    return at(s).toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }
  const badge = (status) => `<span class="badge ${STATUS[status].tone}">${STATUS[status].label}</span>`;
  /** Follow-up date as words plus a class: overdue and today stand out, later dates don't. */
  function due(date) {
    if (!date) return { text: "–", cls: "" };
    const d = dayDiff(date, state.data.today);
    if (d < 0) return { text: `Overdue ${-d}d`, cls: "late", long: `${plural(-d, "day")} overdue` };
    if (d === 0) return { text: "Today", cls: "today", long: "Due today" };
    if (d === 1) return { text: "Tomorrow", cls: "", long: "Tomorrow" };
    return { text: niceDate(date), cls: "", long: niceDate(date) };
  }
  const dueTag = (date) => { const x = due(date); return `<span class="due ${x.cls}">${x.text}</span>`; };

  // ---------- State ----------
  let cfg = null;
  const state = {
    data: null, loading: true, error: "", view: "overview", range: "30", query: "",
    stage: "all", source: "all", sort: { key: "booked_at", dir: "desc" },
    time: null, timeLoading: false, editing: null, selected: "", loadedRange: "",
  };
  const stored = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const store = (key, value) => {
    if (cfg.mode === "demo" && key !== "hp-theme") return;
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  };

  /** All API calls go through here so an expired session always leads back to sign-in. */
  async function call(path, method, body) {
    try {
      return await cfg.api(path, method || "GET", body);
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

  /** Run an action from a button: disables it while it runs (no double submits) and reports failures. */
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

  async function load() {
    try {
      state.data = await call("/api/data?range=" + state.range);
      state.loadedRange = state.range;
      state.error = "";
      state.time = Array.isArray(state.data.time) ? state.data.time : null;
    } catch (err) {
      state.error = err.message || "Couldn't load the tracker.";
      // Keep the date range control honest: it should name the period the figures on screen cover.
      if (state.data && state.loadedRange) { state.range = state.loadedRange; $("range").value = state.range; }
    }
    state.loading = false;
    render();
    if (state.view === "time") ensureTime();
  }

  // ---------- Shell ----------
  function mount() {
    const demo = cfg.mode === "demo";
    document.body.insertAdjacentHTML("afterbegin", `
${demo ? `<div class="demo-bar" role="note">Demo with made-up data. Nothing is saved or sent, and a refresh starts over.</div>` : ""}
<div class="app">
  <aside class="side">
    <div class="side-brand"><span class="wordmark">HEURIAL</span><small>Follow-up tracker</small></div>
    <p class="side-label">Workspace</p>
    <nav class="side-nav" aria-label="Sections">
      ${Object.entries(VIEWS).map(([key, v]) => `<button class="nav-item" type="button" data-view="${key}">${icon(v.icon)}<span>${v.label}</span>${key === "overview" ? `<b class="nav-count" id="navCount" hidden></b>` : ""}</button>`).join("")}
    </nav>
    <div class="side-foot">
      <p class="side-id"><b>HEURIAL Studio${demo ? `<span class="tag-demo">Demo</span>` : ""}</b>${demo ? "Sample data only" : "Private workspace"}</p>
      <button class="nav-item" type="button" id="themeBtn" aria-label="Switch between light and dark">${icon("sun")}<span>Appearance</span></button>
      ${cfg.auth ? `<button class="nav-item" type="button" id="signOutBtn">${icon("out")}<span>Sign out</span></button>` : ""}
    </div>
  </aside>
  <div class="main">
    <header class="topbar">
      <span class="topbar-brand">HEURIAL${demo ? " · DEMO" : ""}</span>
      <div class="topbar-title"><h1 id="pageTitle">Overview</h1><p id="pageSub"></p></div>
      <div class="search" role="search">
        ${icon("search")}
        <input id="q" type="search" placeholder="Search leads" aria-label="Search leads" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="results" aria-autocomplete="list">
        <kbd aria-hidden="true">/</kbd>
        <div class="results" id="results" role="listbox" aria-label="Matching leads" hidden></div>
      </div>
      <select class="input sm range" id="range" aria-label="Date range">
        ${Object.entries(RANGES).map(([value, label]) => `<option value="${value}">${label[0].toUpperCase() + label.slice(1)}</option>`).join("")}
      </select>
      <button class="btn" type="button" id="digestBtn">${icon("mail")}<span class="hide-sm">Daily email</span></button>
      <button class="btn primary" type="button" id="primaryBtn">${icon("plus")}<span id="primaryLabel">New lead</span></button>
    </header>
    <main class="content" id="view" tabindex="-1"></main>
  </div>
</div>

<dialog class="drawer" id="leadDlg" aria-labelledby="leadTitle">
  <form id="leadForm" novalidate>
    <div class="dlg-head">
      <div><h2 id="leadTitle">New lead</h2><p id="leadSub"></p></div>
      <button class="btn quiet icon" type="button" data-close aria-label="Close">${icon("x")}</button>
    </div>
    <div class="dlg-body">
      <fieldset class="fs">
        <legend>Stage</legend>
        <div class="seg" role="radiogroup" aria-label="Stage">
          ${ORDER.map((s) => `<label class="${STATUS[s].tone}"><input type="radio" name="status" value="${s}"><span>${STATUS[s].label}</span></label>`).join("")}
        </div>
      </fieldset>
      <fieldset class="fs">
        <legend>Contact and business</legend>
        <div class="fields">
          <label class="field"><span>Name (required)</span><input name="name" maxlength="120" autocomplete="off" aria-describedby="e-name"><small class="field-err" id="e-name" hidden></small></label>
          <label class="field"><span>Business</span><input name="business" maxlength="120" autocomplete="off"></label>
          <label class="field"><span>Email</span><input name="email" type="email" maxlength="254" autocomplete="off" aria-describedby="e-email"><small class="field-err" id="e-email" hidden></small></label>
          <label class="field"><span>Source</span><input name="source" list="sourceList" maxlength="60" placeholder="Referral, Website…" autocomplete="off"><datalist id="sourceList"></datalist></label>
        </div>
      </fieldset>
      <fieldset class="fs">
        <legend>Dates and value</legend>
        <div class="fields">
          <label class="field"><span>Date booked</span><input name="booked_at" type="date"></label>
          <label class="field"><span>Call date</span><input name="call_at" type="date"></label>
          <label class="field wide"><span>Value paid or quoted (USD)</span><input name="value" type="number" min="0" step="1" inputmode="decimal" aria-describedby="e-value"><small class="field-err" id="e-value" hidden></small></label>
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
          <button class="btn sm quiet" type="button" data-fu="clear">Clear follow-up</button>
        </div>
      </fieldset>
      <fieldset class="fs">
        <legend>Notes</legend>
        <label class="field"><span class="sr">Notes</span><textarea name="notes" rows="4" maxlength="4000" placeholder="What they need, what you discussed…"></textarea></label>
      </fieldset>
      <section class="fs" id="timeBox" hidden aria-labelledby="timeBoxTitle">
        <h3 id="timeBoxTitle">Time on this lead</h3>
        <div class="time-add">
          <label class="field"><span>Date</span><input type="date" id="tDate"></label>
          <label class="field"><span>Hours</span><input type="number" id="tHours" min="0.25" max="24" step="0.25" inputmode="decimal"></label>
          <label class="field"><span>What you did</span><input type="text" id="tNote" maxlength="300"></label>
          <button class="btn" type="button" id="tAdd">Log time</button>
        </div>
        <small class="field-err" id="e-time" hidden></small>
        <ul class="time-list" id="tList"></ul>
        <p class="time-total" id="tTotal"></p>
      </section>
    </div>
    <div class="dlg-foot">
      <button class="btn danger" type="button" id="delBtn" hidden>Delete lead</button>
      <span class="form-err" id="leadErr" role="alert"></span>
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn primary" type="submit" id="saveBtn">Save</button>
    </div>
  </form>
</dialog>

<dialog class="modal" id="timeDlg" aria-labelledby="timeDlgTitle">
  <form id="timeForm" novalidate>
    <div class="dlg-head"><div><h2 id="timeDlgTitle">Log time</h2><p>Hours you spent on a lead.</p></div><button class="btn quiet icon" type="button" data-close aria-label="Close">${icon("x")}</button></div>
    <div class="dlg-body">
      <label class="field"><span>Lead</span><select name="lead_id" aria-describedby="e-tlead"></select><small class="field-err" id="e-tlead" hidden></small></label>
      <div class="fields" style="margin-top:12px">
        <label class="field"><span>Date</span><input name="entry_date" type="date"></label>
        <label class="field"><span>Hours</span><input name="hours" type="number" min="0.25" max="24" step="0.25" inputmode="decimal" aria-describedby="e-thours"><small class="field-err" id="e-thours" hidden></small></label>
      </div>
      <label class="field"><span>What you did</span><input name="note" maxlength="300"></label>
    </div>
    <div class="dlg-foot"><span class="form-err" id="timeErr" role="alert"></span><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Log time</button></div>
  </form>
</dialog>

<dialog class="modal lg" id="digestDlg" aria-labelledby="digestSubject">
  <div class="dlg-head"><div><h2 id="digestSubject">Daily email</h2><p>${demo ? "This is the summary email the tracker sends each morning. In this demo, nothing is ever sent." : "Preview of the daily summary. Nothing is sent until you choose Send now."}</p></div><button class="btn quiet icon" type="button" data-close aria-label="Close">${icon("x")}</button></div>
  <iframe id="digestFrame" title="Email preview" sandbox=""></iframe>
  <div class="dlg-foot"><span class="spacer"></span><button class="btn" type="button" data-close>Close</button><button class="btn primary" type="button" id="digestSend">${demo ? "Send (demo)" : "Send now"}</button></div>
</dialog>

<dialog class="modal" id="confirmDlg" aria-labelledby="confirmTitle" aria-describedby="confirmText">
  <div class="dlg-head"><div><h2 id="confirmTitle"></h2></div></div>
  <div class="dlg-body"><p id="confirmText" class="muted"></p></div>
  <div class="dlg-foot"><span class="spacer"></span><button class="btn" type="button" id="confirmNo">Cancel</button><button class="btn primary" type="button" id="confirmYes">Confirm</button></div>
</dialog>

${cfg.auth ? `<div class="signin" id="signin" hidden>
  <form class="signin-card" id="signinForm">
    <div><span class="wordmark">HEURIAL</span><small class="faint">Follow-up tracker</small></div>
    <h1>Sign in</h1>
    <label class="field"><span>Password</span><input id="pw" type="password" autocomplete="current-password" required maxlength="200" aria-describedby="signinErr"></label>
    <p class="field-err" id="signinErr" role="alert"></p>
    <button class="btn primary" type="submit" id="signinBtn">Sign in</button>
  </form>
</div>` : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  }

  // ---------- Rendering ----------
  function rangeText() { return RANGES[state.range]; }
  /** "in the last 30 days", or "across all time". */
  function inPeriod() { return state.range === "all" ? "across all time" : `in the ${rangeText()}`; }
  function urgentCount(d) { return d.inbox.length + d.stale.length + d.followups.filter((f) => f.follow_up_at <= d.today).length; }
  function matches(lead, q) {
    return !q || [lead.name, lead.business, lead.email, lead.source].some((v) => String(v || "").toLowerCase().includes(q));
  }

  function render() {
    const d = state.data;
    document.querySelectorAll(".nav-item[data-view]").forEach((b) => {
      if (b.dataset.view === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    const urgent = d ? urgentCount(d) : 0;
    $("navCount").hidden = !urgent;
    $("navCount").textContent = urgent;
    $("navCount").setAttribute("aria-label", `${urgent} need attention`);
    document.title = `${urgent ? `(${urgent}) ` : ""}${VIEWS[state.view].label} · HEURIAL tracker${cfg.mode === "demo" ? " (demo)" : ""}`;

    $("pageTitle").textContent = VIEWS[state.view].label;
    $("pageSub").textContent = subtitle();
    $("primaryLabel").textContent = state.view === "time" ? "Log time" : "New lead";
    $("digestBtn").hidden = state.view !== "overview";
    $("q").placeholder = state.view === "time" ? "Filter time entries" : state.view === "overview" ? "Search leads" : "Filter leads";

    const view = $("view");
    const focusKey = document.activeElement && view.contains(document.activeElement) ? document.activeElement.dataset.fk : "";
    const boardScroll = view.querySelector(".board")?.scrollLeft || 0;

    let html = state.error ? `<div class="banner" role="alert"><span>${esc(state.error)}</span><button class="btn sm" type="button" data-action="retry">Try again</button></div>` : "";
    if (!d) html += state.loading ? skeleton() : "";
    else html += { overview: viewOverview, pipeline: viewPipeline, leads: viewLeads, time: viewTime }[state.view]();
    view.innerHTML = html;

    const board = view.querySelector(".board");
    if (board) board.scrollLeft = boardScroll;
    if (focusKey) view.querySelector(`[data-fk="${focusKey}"]`)?.focus();
  }

  function subtitle() {
    const d = state.data;
    if (!d) return "";
    const today = at(d.today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (state.view === "overview") return `${today} · figures cover calls booked ${inPeriod()}`;
    if (state.view === "pipeline") return `${plural(d.leads.filter((l) => OPEN.includes(l.status)).length, "open lead")} · booked ${inPeriod()}`;
    if (state.view === "leads") return `${plural(d.leads.length, "lead")} booked ${inPeriod()}`;
    return `Hours logged ${inPeriod()}`;
  }

  const skeleton = () => `<div class="panel" aria-busy="true" aria-label="Loading"><div class="panel-body">${'<div class="skeleton"></div>'.repeat(6)}</div></div>`;

  // ----- Overview -----
  function viewOverview() {
    const d = state.data, t = d.today;
    const overdue = d.followups.filter((f) => f.follow_up_at < t);
    const upcoming = d.followups.filter((f) => f.follow_up_at <= addDays(t, 7));
    const later = d.followups.length - upcoming.length;
    const urgent = urgentCount(d);
    const who = (id, name, biz) => `<button class="who" type="button" data-action="open" data-id="${id}" data-fk="who-${id}">${esc(name)}${biz ? `<span> · ${esc(biz)}</span>` : ""}</button>`;
    const ago = (iso) => {
      const h = Math.round((Date.now() - Date.parse(iso)) / 36e5);
      return h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
    };

    let queue = "";
    if (d.inbox.length) {
      queue += `<section class="queue-group" aria-label="New inquiries"><h3 class="queue-title">New inquiries from the website <span class="count">${d.inbox.length}</span></h3>` + d.inbox.map((i) => `
        <div class="queue-row">
          <span class="queue-when">${ago(i.created_at)}</span>
          <div class="queue-main"><span class="who">${esc(i.name)}${i.company ? `<span> · ${esc(i.company)}</span>` : ""}</span>
            <p>${esc(i.source)} · ${esc(i.email)}</p><p class="msg">${esc(i.message)}</p></div>
          <div class="queue-acts"><button class="btn sm primary" type="button" data-action="inbox-convert" data-id="${i.id}" data-fk="conv-${i.id}">Add to pipeline</button>
            <button class="btn sm" type="button" data-action="inbox-dismiss" data-id="${i.id}" data-fk="dis-${i.id}">Dismiss</button></div>
        </div>`).join("") + `</section>`;
    }
    if (d.stale.length) {
      queue += `<section class="queue-group" aria-label="Calls to update"><h3 class="queue-title">Calls to update <span class="count">${d.stale.length}</span></h3>` + d.stale.map((s) => `
        <div class="queue-row">
          <span class="queue-when">Call ${niceDate(s.call_at)}</span>
          <div class="queue-main">${who(s.id, s.name, s.business)}<p>Still marked as booked. Did this call happen?</p></div>
          <div class="queue-acts"><button class="btn sm" type="button" data-action="stale" data-status="held" data-id="${s.id}" data-fk="held-${s.id}">Call held</button>
            <button class="btn sm" type="button" data-action="stale" data-status="no_show" data-id="${s.id}" data-fk="ns-${s.id}">No-show</button></div>
        </div>`).join("") + `</section>`;
    }
    if (upcoming.length) {
      queue += `<section class="queue-group" aria-label="Follow-ups"><h3 class="queue-title">Follow-ups, due within 7 days <span class="count ${overdue.length ? "hot" : ""}">${upcoming.length}</span></h3>` + upcoming.map((f) => {
        const x = due(f.follow_up_at);
        return `<div class="queue-row">
          <span class="queue-when due ${x.cls}">${x.long}</span>
          <div class="queue-main">${who(f.id, f.name, f.business)}<p>${esc(f.follow_up_note || "Follow up")}</p></div>
          <div class="queue-acts"><button class="btn sm" type="button" data-action="fu" data-days="done" data-id="${f.id}" data-fk="fd-${f.id}">${icon("check")}Done</button>
            <button class="btn sm" type="button" data-action="fu" data-days="1" data-id="${f.id}" data-fk="f1-${f.id}" aria-label="Move to tomorrow">+1 day</button>
            <button class="btn sm" type="button" data-action="fu" data-days="7" data-id="${f.id}" data-fk="f7-${f.id}" aria-label="Move one week out">+1 week</button></div>
        </div>`;
      }).join("") + `</section>`;
    }
    if (!queue) queue = `<div class="empty"><b>Nothing needs you right now.</b>No new inquiries, no calls to update, and no follow-ups due in the next 7 days.</div>`;
    if (later) queue += `<p class="note">${plural(later, "more follow-up")} scheduled after ${niceDate(addDays(t, 7))}.</p>`;

    // Summary: a short list of defined numbers. Changes compare with the period just before, from the same data.
    const s = d.summary, p = d.previous;
    const n = state.range === "all" ? 0 : Number(state.range);
    const change = (cur, prev, fmt) => {
      if (!p || !n) return "";
      const diff = cur - prev;
      if (!diff) return `No change vs previous ${n} days`;
      return `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} vs previous ${n} days`;
    };
    const metrics = [
      ["Open leads", "Booked, held or proposal sent", d.leads.filter((l) => OPEN.includes(l.status)).length, "", ""],
      ["Overdue follow-ups", "Across all leads, as of today", overdue.length, "", overdue.length ? "alert" : ""],
      ["Calls booked", `Booked ${inPeriod()}`, s.booked, change(s.booked, p?.booked, String), ""],
      ["Paid projects", `${pct(s.paid, s.booked)} of calls booked`, s.paid, change(s.paid, p?.paid, String), ""],
      ["Revenue", "From paid projects in the period", money(s.revenue_cents), change(s.revenue_cents, p?.revenue_cents, money), ""],
      ["Hours logged", "On leads booked in the period", hrs(s.hours), change(s.hours, p?.hours, hrs), ""],
    ];

    return `
<div class="overview-top">
  <section class="panel" aria-labelledby="queueTitle">
    <div class="panel-head"><h2 id="queueTitle">Needs attention</h2><span class="count ${urgent ? "hot" : ""}" aria-label="${urgent} due today or earlier">${urgent}</span>
      <span class="meta">As of ${niceDate(t)}</span></div>
    ${queue}
  </section>
  <section class="panel" aria-labelledby="sumTitle">
    <div class="panel-head"><h2 id="sumTitle">Summary</h2><span class="meta">${rangeText()[0].toUpperCase() + rangeText().slice(1)}</span></div>
    <dl class="metrics">${metrics.map(([label, hint, value, delta, cls]) => `
      <div class="metric ${cls}"><dt>${label}<small>${hint}</small></dt><dd><b>${esc(value)}</b>${delta ? `<small>${delta}</small>` : ""}</dd></div>`).join("")}
    </dl>
  </section>
</div>
<h2 class="section-label">Reporting</h2>
<div class="report-grid">${reportFunnel()}${reportWeekly()}${reportRevenue()}${reportSources()}${reportRates()}</div>`;
  }

  function reportFunnel() {
    const L = state.data.leads;
    const reached = [
      ["Booked", L.length],
      ["Showed up", L.filter((l) => ["held", "proposal", "paid", "lost"].includes(l.status)).length],
      ["Proposal sent", L.filter((l) => ["proposal", "paid"].includes(l.status)).length],
      ["Paid", L.filter((l) => l.status === "paid").length],
    ];
    const total = reached[0][1];
    const count = (st) => L.filter((l) => l.status === st).length;
    const body = total ? `<table class="data"><thead><tr><th>Stage</th><th class="r">Leads</th><th class="bar-cell"><span class="sr">Share of booked</span></th><th class="r">From previous</th></tr></thead><tbody>
      ${reached.map(([name, value], i) => `<tr><td>${name}</td><td class="r">${value}</td>
        <td class="bar-cell"><div class="meter"><i class="${i === 3 ? "ok" : ""}" style="width:${(value / total) * 100}%"></i></div></td>
        <td class="r">${i ? pct(value, reached[i - 1][1]) : "–"}</td></tr>`).join("")}
      </tbody></table>
      <p class="note">${count("booked") + count("held") + count("proposal")} still open · ${count("lost")} lost · ${count("no_show")} no-show. A lead counts toward every stage it has passed.</p>`
      : `<div class="empty">No calls booked in this period.</div>`;
    return `<section class="panel c4" aria-labelledby="funTitle"><div class="panel-head"><h2 id="funTitle">Conversion</h2><span class="meta">${rangeText()}</span></div>${body}</section>`;
  }

  function reportWeekly() {
    const w = state.data.weekly, peak = Math.max(1, ...w.map((x) => x.booked));
    const top = Math.max(2, Math.ceil(peak / 2) * 2);
    return `<section class="panel c4" aria-labelledby="weekTitle"><div class="panel-head"><h2 id="weekTitle">Calls per week</h2><span class="meta">Last 12 weeks</span></div>
      <div class="panel-body">
        <div class="legend"><span><i></i>Booked</span><span><i class="ok"></i>Paid</span></div>
        <div class="chart" role="img" aria-label="Calls booked and paid per week over the last 12 weeks. ${w.reduce((a, x) => a + x.booked, 0)} booked, ${w.reduce((a, x) => a + x.paid, 0)} paid.">
          ${[top, top / 2].map((v) => `<div class="grid-line" style="bottom:${(v / top) * 100}%"><span>${v}</span></div>`).join("")}
          ${w.map((x) => `<div class="col" title="Week of ${niceDate(x.week)}: ${x.booked} booked, ${x.paid} paid">
            <div class="bar ${x.booked ? "" : "zero"}" style="height:${(x.booked / top) * 100}%"></div><div class="bar ok ${x.paid ? "" : "zero"}" style="height:${(x.paid / top) * 100}%"></div></div>`).join("")}
        </div>
        <div class="x-labels" aria-hidden="true">${w.map((x, i) => `<span>${i % 3 ? "" : niceDate(x.week)}</span>`).join("")}</div>
      </div></section>`;
  }

  function reportRevenue() {
    const w = state.data.weekly, total = w.reduce((a, x) => a + x.revenue_cents, 0);
    const max = Math.max(1, ...w.map((x) => x.revenue_cents));
    const best = w.reduce((a, b) => (b.revenue_cents > a.revenue_cents ? b : a), w[0]);
    return `<section class="panel c4" aria-labelledby="revTitle"><div class="panel-head"><h2 id="revTitle">Revenue by week booked</h2><span class="meta">Last 12 weeks</span></div>
      <div class="panel-body">
        <p class="figure">${money(total)}</p>
        <p class="faint" style="font-size:12px">${total ? `Best week: ${niceDate(best.week)} (${money(best.revenue_cents)})` : "No paid projects in the last 12 weeks."}</p>
        <div class="chart" style="height:96px" role="img" aria-label="Revenue from paid projects by the week the call was booked. Total ${money(total)}.">
          ${w.map((x) => `<div class="col" title="Week of ${niceDate(x.week)}: ${money(x.revenue_cents)}"><div class="bar wide ${x.revenue_cents ? "" : "zero"}" style="height:${(x.revenue_cents / max) * 100}%"></div></div>`).join("")}
        </div>
        <div class="x-labels" aria-hidden="true">${w.map((x, i) => `<span>${i % 3 ? "" : niceDate(x.week)}</span>`).join("")}</div>
      </div></section>`;
  }

  function reportSources() {
    const rows = state.data.sources;
    const body = rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Source</th><th class="r">Booked</th><th class="r">Paid</th><th class="r">Close rate</th><th class="r">Revenue</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${esc(x.source)}</td><td class="r">${x.booked}</td><td class="r">${x.paid}</td><td class="r">${pct(x.paid, x.booked)}</td><td class="r">${money(x.revenue_cents)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">No calls booked in this period.</div>`;
    return `<section class="panel c6" aria-labelledby="srcTitle"><div class="panel-head"><h2 id="srcTitle">Where leads come from</h2><span class="meta">${rangeText()}</span></div>${body}</section>`;
  }

  function reportRates() {
    const d = state.data;
    const rows = d.leads.filter((l) => l.status === "paid" && l.hours > 0)
      .map((l) => ({ id: l.id, name: l.business || l.name, value: l.value_cents, hours: l.hours, rate: l.value_cents / l.hours }))
      .sort((a, b) => b.rate - a.rate).slice(0, 6);
    const overall = d.summary.hours ? d.summary.revenue_cents / d.summary.hours : 0;
    const body = rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Paid project</th><th class="r">Value</th><th class="r">Hours</th><th class="r">Per hour</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="r">${money(r.value)}</td><td class="r">${hrs(r.hours)}</td><td class="r">${money(r.rate)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="3">All logged hours, including unpaid calls</td><td class="r">${money(overall)}</td></tr></tfoot></table></div>`
      : `<div class="empty">Log hours on paid projects to see what each one earned per hour.</div>`;
    return `<section class="panel c6" aria-labelledby="rateTitle"><div class="panel-head"><h2 id="rateTitle">Earned per hour</h2><span class="meta">${rangeText()}</span></div>${body}</section>`;
  }

  // ----- Pipeline -----
  function viewPipeline() {
    const d = state.data, q = state.query.trim().toLowerCase();
    const shown = d.leads.filter((l) => matches(l, q));
    const lanes = ORDER.map((st) => {
      const leads = shown.filter((l) => l.status === st);
      const total = leads.reduce((a, l) => a + l.value_cents, 0);
      return `<section class="lane" data-status="${st}" aria-label="${STATUS[st].label}, ${plural(leads.length, "lead")}">
        <div class="lane-head"><h2><span class="badge ${STATUS[st].tone}">${STATUS[st].label}</span></h2><span class="count">${leads.length}</span>${total ? `<span class="sum">${money(total)}</span>` : ""}</div>
        <div class="lane-list">${leads.length ? leads.map(cardHtml).join("") : `<div class="lane-empty">${q ? "No matches" : "No leads at this stage"}</div>`}</div>
      </section>`;
    }).join("");
    return `${q ? `<div class="toolbar"><span class="result-count">${plural(shown.length, "lead")} matching “${esc(state.query.trim())}”</span><button class="btn sm quiet" type="button" data-action="clear-filters">Clear</button></div>` : ""}
      <div class="board">${lanes}</div>
      <p class="note" style="border:0;padding-inline:0">Drag a card to another column, or use its Move menu. On a phone, press and hold a card before dragging.</p>`;
  }
  function cardHtml(l) {
    const next = l.follow_up_at
      ? `<span>${esc(l.follow_up_note || "Follow up")}</span>${dueTag(l.follow_up_at)}`
      : `<span>No follow-up set</span><span></span>`;
    return `<article class="card" data-id="${l.id}">
      <div class="card-top"><button class="card-name" type="button" data-action="open" data-id="${l.id}" data-fk="card-${l.id}">${esc(l.name)}</button>${l.value_cents ? `<span class="val">${money(l.value_cents)}</span>` : ""}</div>
      <div class="card-biz">${esc(l.business || "No business name")}</div>
      <div class="card-next">${next}</div>
      <div class="card-foot"><span title="Source: ${esc(l.source)}">${esc(l.source)}</span>
        <select class="input" data-change="move" data-id="${l.id}" data-fk="move-${l.id}" aria-label="Move ${esc(l.name)} to another stage">
          ${ORDER.map((st) => `<option value="${st}" ${st === l.status ? "selected" : ""}>${st === l.status ? "Move…" : STATUS[st].label}</option>`).join("")}
        </select></div>
    </article>`;
  }

  // ----- Leads -----
  const COLUMNS = [
    ["name", "Lead", ""], ["status", "Stage", ""], ["source", "Source", ""], ["booked_at", "Booked", ""], ["call_at", "Call", ""],
    ["follow_up_at", "Follow-up", ""], ["value_cents", "Value", "r"], ["hours", "Hours", "r"],
  ];
  function filteredLeads() {
    const d = state.data, q = state.query.trim().toLowerCase();
    const rows = d.leads.filter((l) => matches(l, q)
      && (state.stage === "all" || (state.stage === "open" ? OPEN.includes(l.status) : l.status === state.stage))
      && (state.source === "all" || l.source === state.source));
    const { key, dir } = state.sort, sign = dir === "asc" ? 1 : -1;
    const value = (l) => (key === "status" ? ORDER.indexOf(l.status) : l[key]);
    return rows.sort((a, b) => {
      const x = value(a), y = value(b);
      // Empty dates and text always sort last.
      if ((x === "" || x == null) !== (y === "" || y == null)) return x === "" || x == null ? 1 : -1;
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "en", { sensitivity: "base" });
      return cmp * sign || a.name.localeCompare(b.name);
    });
  }
  function viewLeads() {
    const d = state.data, rows = filteredLeads();
    const sources = [...new Set(d.leads.map((l) => l.source))].sort((a, b) => a.localeCompare(b));
    if (state.source !== "all" && !sources.includes(state.source)) state.source = "all";
    const filtered = state.query.trim() || state.stage !== "all" || state.source !== "all";
    const toolbar = `<div class="toolbar">
      <label>Stage <select class="input sm" data-change="stage" data-fk="f-stage">
        <option value="all">All stages</option><option value="open" ${state.stage === "open" ? "selected" : ""}>Open (not paid or closed)</option>
        ${ORDER.map((s) => `<option value="${s}" ${state.stage === s ? "selected" : ""}>${STATUS[s].label}</option>`).join("")}</select></label>
      <label>Source <select class="input sm" data-change="source" data-fk="f-source">
        <option value="all">All sources</option>${sources.map((s) => `<option ${state.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      ${filtered ? `<button class="btn sm quiet" type="button" data-action="clear-filters" data-fk="f-clear">Clear filters</button>` : ""}
      <span class="result-count" role="status">${filtered ? `${rows.length} of ${d.leads.length} leads` : plural(d.leads.length, "lead")}</span>
      <span class="spacer"></span>
      <button class="btn sm" type="button" data-action="export" data-fk="f-export">${icon("down")}Export CSV</button>
    </div>`;
    if (!d.leads.length) return toolbar + `<div class="panel"><div class="empty"><b>No leads booked ${inPeriod()}.</b>Choose a longer date range, or add the first one.<br><button class="btn primary" type="button" data-action="new-lead">${icon("plus")}New lead</button></div></div>`;
    if (!rows.length) return toolbar + `<div class="panel"><div class="empty"><b>No leads match these filters.</b><button class="btn" type="button" data-action="clear-filters">Clear filters</button></div></div>`;
    return toolbar + `<div class="panel"><div class="table-wrap"><table class="grid-table">
      <thead><tr>${COLUMNS.map(([key, label, cls]) => `<th class="${cls}" scope="col" ${state.sort.key === key ? `aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : ""}>
        <button class="sort" type="button" data-action="sort" data-key="${key}" data-fk="sort-${key}">${label}</button></th>`).join("")}<th><span class="sr">Open</span></th></tr></thead>
      <tbody>${rows.map((l) => `<tr data-action="open" data-id="${l.id}" class="${state.selected === l.id ? "is-selected" : ""}">
        <td class="lead-cell"><button class="who" type="button" data-action="open" data-id="${l.id}" data-fk="row-${l.id}">${esc(l.name)}</button><small>${esc(l.business || "–")}</small></td>
        <td>${badge(l.status)}</td><td>${esc(l.source)}</td><td class="num">${niceDate(l.booked_at)}</td><td class="num">${niceDate(l.call_at)}</td>
        <td>${l.follow_up_at ? dueTag(l.follow_up_at) : `<span class="faint">–</span>`}</td>
        <td class="r">${l.value_cents ? money(l.value_cents) : "–"}</td><td class="r">${l.hours ? hrs(l.hours) : "–"}</td>
        <td class="r row-open" aria-hidden="true">${icon("chev")}</td></tr>`).join("")}</tbody>
    </table></div></div>`;
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
    if (state.view === "time") render();
  }
  function viewTime() {
    const d = state.data;
    if (!state.time) return skeleton();
    const cutoff = state.range === "all" ? "" : addDays(d.today, -Number(state.range));
    const q = state.query.trim().toLowerCase();
    const inRange = state.time.filter((e) => e.entry_date >= cutoff);
    const entries = inRange.filter((e) => !q || [e.lead_name, e.lead_business, e.note].some((v) => String(v || "").toLowerCase().includes(q)));
    const total = inRange.reduce((a, e) => a + e.hours, 0);
    const paid = d.leads.filter((l) => l.status === "paid" && l.hours > 0);
    const paidHours = paid.reduce((a, l) => a + l.hours, 0), paidValue = paid.reduce((a, l) => a + l.value_cents, 0);
    const byLead = d.leads.filter((l) => l.hours > 0).sort((a, b) => b.hours - a.hours);

    const list = entries.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Lead</th><th>What you did</th><th class="r">Hours</th><th><span class="sr">Delete</span></th></tr></thead><tbody>
      ${entries.map((e) => `<tr><td class="num" style="white-space:nowrap">${niceDate(e.entry_date)}</td>
        <td><button class="who" type="button" data-action="open" data-id="${e.lead_id}" data-fk="te-${e.id}">${esc(e.lead_name || "Lead")}</button></td>
        <td><div class="cell-note" title="${esc(e.note)}">${esc(e.note || "–")}</div></td><td class="r">${hrs(e.hours)}</td>
        <td class="r"><button class="btn sm quiet icon" type="button" data-action="time-del" data-id="${e.id}" data-fk="td-${e.id}" aria-label="Delete ${hrs(e.hours)} hours on ${niceDate(e.entry_date)} for ${esc(e.lead_name || "lead")}">${icon("x")}</button></td></tr>`).join("")}
      </tbody></table></div>`
      : `<div class="empty"><b>${q ? "No time entries match." : `No time logged ${inPeriod()}.`}</b>${q ? "" : "Log the hours you spend on a lead to see what each project earns per hour."}<br><button class="btn" type="button" data-action="log-time">${icon("plus")}Log time</button></div>`;

    const totals = byLead.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Lead</th><th>Stage</th><th class="r">Hours</th><th class="r">Per hour</th></tr></thead><tbody>
      ${byLead.map((l) => `<tr><td><button class="who" type="button" data-action="open" data-id="${l.id}" data-fk="tl-${l.id}">${esc(l.name)}</button></td><td>${badge(l.status)}</td><td class="r">${hrs(l.hours)}</td>
        <td class="r">${l.status === "paid" && l.value_cents ? money(l.value_cents / l.hours) : "–"}</td></tr>`).join("")}
      </tbody></table></div><p class="note">All hours ever logged on leads booked ${inPeriod()}. Per hour is shown for paid projects only.</p>`
      : `<div class="empty">No hours logged on these leads yet.</div>`;

    return `<div class="stats" role="group" aria-label="Time summary">
      <div class="stat"><span>Hours logged</span><b>${hrs(total)}</b><small>${rangeText()}</small></div>
      <div class="stat"><span>Entries</span><b>${inRange.length}</b><small>${rangeText()}</small></div>
      <div class="stat"><span>Leads with time</span><b>${new Set(inRange.map((e) => e.lead_id)).size}</b><small>${rangeText()}</small></div>
      <div class="stat"><span>Paid projects, per hour</span><b>${paidHours ? money(paidValue / paidHours) : "–"}</b><small>value ÷ all hours on them</small></div>
    </div>
    <div class="time-grid">
      <section class="panel" aria-labelledby="teTitle"><div class="panel-head"><h2 id="teTitle">Time entries</h2><span class="meta">${q ? `${entries.length} of ${inRange.length}` : plural(inRange.length, "entry", "entries")}</span></div>${list}</section>
      <section class="panel" aria-labelledby="tlTitle"><div class="panel-head"><h2 id="tlTitle">Hours by lead</h2></div>${totals}</section>
    </div>`;
  }

  // ---------- Actions ----------
  function setView(next) {
    if (!VIEWS[next]) return;
    state.view = next;
    store("hp-view", next);
    closeResults();
    render();
    window.scrollTo(0, 0);
    if (next === "time") ensureTime();
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

  async function onViewClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el || suppressClick) return;
    // Clicking a control inside a table row shouldn't also trigger the row.
    if (el.tagName === "TR" && e.target.closest("button, select, a")) return;
    const d = state.data, id = el.dataset.id;
    const button = el.tagName === "BUTTON" ? el : null;
    switch (el.dataset.action) {
      case "retry": return act(button, load);
      case "open": return openById(id);
      case "new-lead": return openLead(null);
      case "log-time": return openTimeDialog();
      case "export": return exportCsv();
      case "sort": {
        state.sort = state.sort.key === el.dataset.key ? { key: el.dataset.key, dir: state.sort.dir === "asc" ? "desc" : "asc" } : { key: el.dataset.key, dir: ["value_cents", "hours", "booked_at"].includes(el.dataset.key) ? "desc" : "asc" };
        return render();
      }
      case "clear-filters": state.query = ""; $("q").value = ""; state.stage = "all"; state.source = "all"; return render();
      case "inbox-convert": return act(button, async () => {
        const item = d.inbox.find((i) => i.id === id);
        const r = await call(`/api/inbox/${id}/convert`, "POST");
        toast(`Added ${item?.name || "lead"} to the pipeline. Next: reply to schedule the call.`);
        await load();
        if (r.leadId) openById(r.leadId);
      });
      case "inbox-dismiss": {
        const item = d.inbox.find((i) => i.id === id);
        const ok = await confirmBox({ title: "Dismiss this inquiry?", text: `The inquiry from ${item?.name || "this person"} leaves your list. ${cfg.mode === "demo" ? "This is a demo, so nothing real is changed." : "It stays stored in Catalyst."}`, action: "Dismiss" });
        if (!ok) return;
        return act(button, async () => { await call(`/api/inbox/${id}/dismiss`, "POST"); toast("Inquiry dismissed"); await load(); });
      }
      case "stale": return act(button, async () => {
        const body = { status: el.dataset.status };
        const row = d.stale.find((s) => s.id === id);
        if (body.status === "held" && !row?.follow_up_at) { body.follow_up_at = addDays(d.today, FOLLOW_PLAN.held[0]); body.follow_up_note = FOLLOW_PLAN.held[1]; }
        await call("/api/leads/" + id, "PATCH", body);
        toast(body.follow_up_at ? `Marked as held. Follow-up set for ${niceDate(body.follow_up_at)}.` : `Marked as ${STATUS[body.status].label.toLowerCase()}`);
        await load();
      });
      case "fu": return act(button, async () => {
        const next = el.dataset.days === "done" ? "" : addDays(d.today, Number(el.dataset.days));
        await call("/api/leads/" + id, "PATCH", { follow_up_at: next, ...(next ? {} : { follow_up_note: "" }) });
        toast(next ? `Follow-up moved to ${niceDate(next)}` : "Follow-up done");
        await load();
      });
      case "time-del": {
        const ok = await confirmBox({ title: "Delete this time entry?", text: "The hours are removed from the lead's total. This can't be undone.", action: "Delete entry", danger: true });
        if (!ok) return;
        return act(button, async () => { await call("/api/time/" + id, "DELETE"); toast("Time entry deleted"); await load(); });
      }
    }
  }

  function onViewChange(e) {
    const el = e.target.closest("[data-change]");
    if (!el) return;
    if (el.dataset.change === "stage") { state.stage = el.value; render(); }
    if (el.dataset.change === "source") { state.source = el.value; render(); }
    if (el.dataset.change === "move") moveLead(el.dataset.id, el.value);
  }

  async function moveLead(id, status) {
    const lead = state.data.leads.find((l) => l.id === id);
    if (!lead || lead.status === status || !STATUS[status]) return;
    const body = { status };
    const plan = FOLLOW_PLAN[status];
    if (plan && !lead.follow_up_at) { body.follow_up_at = addDays(state.data.today, plan[0]); body.follow_up_note = plan[1]; }
    const before = lead.status;
    lead.status = status;
    render();
    try {
      await call("/api/leads/" + id, "PATCH", body);
      toast(`${lead.name} moved to ${STATUS[status].label}${body.follow_up_at ? `. Follow-up set for ${niceDate(body.follow_up_at)}.` : ""}`);
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
    const head = ["name", "business", "email", "source", "status", "booked_at", "call_at", "follow_up_at", "follow_up_note", "value_usd", "hours", "notes"];
    const rows = d.leads.map((l) => [l.name, l.business, l.email, l.source, l.status, l.booked_at, l.call_at, l.follow_up_at, l.follow_up_note, (l.value_cents / 100).toFixed(2), l.hours, l.notes].map(cell).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `heurial-leads-${d.today}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${plural(d.leads.length, "lead")}`);
  }

  // ---------- Pipeline drag and drop (mouse, trackpad and touch; press and hold on phones) ----------
  let drag = null, suppressClick = false;
  function bindDrag(view) {
    view.addEventListener("pointerdown", (e) => {
      const card = e.target.closest(".board .card");
      if (!card || e.button !== 0 || e.target.closest("select")) return;
      const touch = e.pointerType === "touch";
      drag = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, active: false, ready: !touch };
      if (touch) drag.timer = setTimeout(() => { if (drag && !drag.active) { drag.ready = true; card.classList.add("lifted"); navigator.vibrate?.(10); } }, 280);
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
      const lane = document.elementFromPoint(e.clientX, e.clientY)?.closest(".lane") || null;
      view.querySelectorAll(".lane.over").forEach((l) => l !== lane && l.classList.remove("over"));
      lane?.classList.add("over");
      drag.lane = lane;
      const board = view.querySelector(".board"), b = board.getBoundingClientRect();
      if (e.clientX > b.right - 48) board.scrollLeft += 14; else if (e.clientX < b.left + 48) board.scrollLeft -= 14;
    });
    window.addEventListener("pointerup", (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const { active, lane, id } = drag;
      cancelDrag();
      if (!active) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      if (lane) moveLead(id, lane.dataset.status);
    });
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && drag?.active) cancelDrag(); });
    view.addEventListener("touchmove", (e) => { if (drag?.ready) e.preventDefault(); }, { passive: false });
    view.addEventListener("dragstart", (e) => { if (e.target.closest?.(".board")) e.preventDefault(); });
  }
  function cancelDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    drag.ghost?.remove();
    drag.card.classList.remove("dragging", "lifted");
    document.querySelectorAll(".lane.over").forEach((l) => l.classList.remove("over"));
    document.body.classList.remove("is-dragging");
    drag = null;
  }

  // ---------- Lead details ----------
  const fieldError = (id, input, message) => {
    const el = $(id);
    el.textContent = message || ""; el.hidden = !message;
    if (input) { if (message) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
  };

  async function openById(id) {
    try {
      openLead(state.data.leads.find((l) => l.id === String(id)) || await call("/api/leads/" + id));
    } catch (err) { toast(err.message || "Couldn't open that lead.", true); }
  }

  function openLead(lead) {
    state.editing = lead;
    state.selected = lead ? lead.id : "";
    const f = $("leadForm"), d = state.data;
    for (const [id, name] of [["e-name", "name"], ["e-email", "email"], ["e-value", "value"]]) fieldError(id, f[name], "");
    fieldError("e-time", null, "");
    $("leadErr").textContent = "";
    $("leadTitle").textContent = lead ? lead.name : "New lead";
    $("leadSub").textContent = lead ? [lead.business, lead.source, STATUS[lead.status].label].filter(Boolean).join(" · ") : "A newly booked call. You can change the stage later.";
    f.name.value = lead?.name ?? ""; f.business.value = lead?.business ?? ""; f.email.value = lead?.email ?? "";
    f.source.value = lead?.source ?? ""; f.status.value = lead?.status ?? "booked";
    f.value.value = lead ? lead.value_cents / 100 || "" : "";
    f.booked_at.value = lead?.booked_at ?? d.today; f.call_at.value = lead?.call_at ?? ""; f.notes.value = lead?.notes ?? "";
    f.follow_up_at.value = lead?.follow_up_at ?? ""; f.follow_up_note.value = lead?.follow_up_note ?? "";
    const known = ["Referral", "Personal network", "Cold outreach", "Website", "Social media", "Partner", "Other", ...d.leads.map((l) => l.source)];
    $("sourceList").innerHTML = [...new Set(known)].map((s) => `<option>${esc(s)}</option>`).join("");
    $("delBtn").hidden = !lead;
    $("timeBox").hidden = !lead;
    $("saveBtn").textContent = lead ? "Save changes" : "Add lead";
    if (lead) { $("tDate").value = d.today; $("tHours").value = ""; $("tNote").value = ""; $("tList").innerHTML = `<li class="none">Loading…</li>`; $("tTotal").textContent = ""; loadLeadTime(); }
    if (!$("leadDlg").open) $("leadDlg").showModal();
    if (!lead) f.name.focus();
    if (state.view === "leads") render();
  }

  async function loadLeadTime() {
    const lead = state.editing;
    if (!lead) return;
    try {
      const list = await call(`/api/leads/${lead.id}/time`);
      if (state.editing !== lead) return;
      $("tList").innerHTML = list.length ? list.map((t) => `
        <li><span class="num">${niceDate(t.entry_date)}</span><b class="num">${hrs(t.hours)} h</b><span class="n" title="${esc(t.note)}">${esc(t.note || "–")}</span>
        <button class="btn sm quiet icon" type="button" data-del="${t.id}" aria-label="Delete ${hrs(t.hours)} hours on ${niceDate(t.entry_date)}">${icon("x")}</button></li>`).join("")
        : `<li class="none">No time logged yet.</li>`;
      const total = list.reduce((s, t) => s + t.hours, 0);
      $("tTotal").innerHTML = total ? `Total <b class="num">${hrs(total)} h</b>${lead.value_cents && lead.status === "paid" ? ` · <b class="num">${money(lead.value_cents / total)}</b> per hour on this project` : ""}` : "";
    } catch {
      $("tList").innerHTML = `<li class="none">Couldn't load time entries.</li>`;
    }
  }

  function bindLeadForm() {
    const dlg = $("leadDlg"), f = $("leadForm");
    dlg.addEventListener("close", () => { state.selected = ""; if (state.view === "leads") render(); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

    // Suggest a follow-up when the stage changes, but only into empty fields.
    f.addEventListener("change", (e) => {
      if (e.target.name !== "status") return;
      const plan = FOLLOW_PLAN[e.target.value];
      if (!plan || f.follow_up_at.value) return;
      f.follow_up_at.value = addDays(state.data.today, plan[0]);
      if (!f.follow_up_note.value) f.follow_up_note.value = plan[1];
    });
    f.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fu]");
      if (!b) return;
      if (b.dataset.fu === "clear") { f.follow_up_at.value = ""; f.follow_up_note.value = ""; return; }
      f.follow_up_at.value = addDays(state.data.today, Number(b.dataset.fu));
      if (!f.follow_up_note.value) f.follow_up_note.focus();
    });

    let saving = false;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (saving) return;
      const name = f.name.value.trim(), email = f.email.value.trim(), value = f.value.value === "" ? 0 : Number(f.value.value);
      fieldError("e-name", f.name, name ? "" : "Enter a name.");
      fieldError("e-email", f.email, !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a full email address, like name@example.com.");
      fieldError("e-value", f.value, Number.isFinite(value) && value >= 0 ? "" : "Enter an amount of 0 or more.");
      const firstBad = f.querySelector('[aria-invalid="true"]');
      if (firstBad) { firstBad.focus(); return; }

      const editing = state.editing;
      const body = { name, business: f.business.value, email, source: f.source.value, status: f.status.value, value,
        booked_at: f.booked_at.value, call_at: f.call_at.value, notes: f.notes.value,
        follow_up_at: f.follow_up_at.value, follow_up_note: f.follow_up_note.value };
      const save = $("saveBtn"), label = save.textContent;
      saving = true; save.disabled = true; save.textContent = "Saving…"; $("leadErr").textContent = "";
      try {
        if (editing) await call("/api/leads/" + editing.id, "PATCH", body); else await call("/api/leads", "POST", body);
        dlg.close();
        toast(editing ? `Saved ${name}` : `Added ${name}`);
        await load();
      } catch (err) {
        $("leadErr").textContent = err.message || "Couldn't save. Try again.";
      } finally {
        saving = false; save.disabled = false; save.textContent = label;
      }
    });

    $("delBtn").addEventListener("click", async () => {
      const lead = state.editing;
      if (!lead) return;
      const ok = await confirmBox({ title: `Delete ${lead.name}?`, text: "This removes the lead and all time logged on it. It can't be undone.", action: "Delete lead", danger: true });
      if (!ok) return;
      act($("delBtn"), async () => { await call("/api/leads/" + lead.id, "DELETE"); dlg.close(); toast(`Deleted ${lead.name}`); await load(); });
    });

    $("tAdd").addEventListener("click", () => {
      const hours = Number($("tHours").value);
      if (!(hours > 0 && hours <= 24)) { fieldError("e-time", $("tHours"), "Enter hours between 0.25 and 24."); $("tHours").focus(); return; }
      fieldError("e-time", $("tHours"), "");
      act($("tAdd"), async () => {
        await call("/api/time", "POST", { lead_id: state.editing.id, entry_date: $("tDate").value, hours, note: $("tNote").value });
        $("tHours").value = ""; $("tNote").value = "";
        toast(`Logged ${hrs(hours)} h`);
        await loadLeadTime(); await load();
      });
    });
    $("tList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]");
      if (b) act(b, async () => { await call("/api/time/" + b.dataset.del, "DELETE"); toast("Time entry deleted"); await loadLeadTime(); await load(); });
    });
  }

  // ---------- Log time (from the Time section) ----------
  function openTimeDialog() {
    const d = state.data, f = $("timeForm");
    if (!d) return;
    const leads = [...d.leads].sort((a, b) => a.name.localeCompare(b.name));
    f.lead_id.innerHTML = `<option value="">Choose a lead…</option>` + leads.map((l) => `<option value="${l.id}">${esc(l.name)}${l.business ? ` · ${esc(l.business)}` : ""}</option>`).join("");
    f.entry_date.value = d.today; f.hours.value = ""; f.note.value = "";
    fieldError("e-tlead", f.lead_id, leads.length ? "" : `No leads were booked ${inPeriod()}. Choose a longer date range first.`);
    fieldError("e-thours", f.hours, "");
    $("timeErr").textContent = "";
    $("timeDlg").showModal();
    f.lead_id.focus();
  }
  function bindTimeForm() {
    const f = $("timeForm");
    let saving = false;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (saving) return;
      const hours = Number(f.hours.value);
      fieldError("e-tlead", f.lead_id, f.lead_id.value ? "" : "Choose the lead this time was for.");
      fieldError("e-thours", f.hours, hours > 0 && hours <= 24 ? "" : "Enter hours between 0.25 and 24.");
      const firstBad = f.querySelector('[aria-invalid="true"]');
      if (firstBad) { firstBad.focus(); return; }
      const button = f.querySelector('[type="submit"]');
      saving = true; button.disabled = true; $("timeErr").textContent = "";
      try {
        await call("/api/time", "POST", { lead_id: f.lead_id.value, entry_date: f.entry_date.value, hours, note: f.note.value });
        $("timeDlg").close();
        toast(`Logged ${hrs(hours)} h`);
        await load();
      } catch (err) {
        $("timeErr").textContent = err.message || "Couldn't save. Try again.";
      } finally { saving = false; button.disabled = false; }
    });
  }

  // ---------- Search ----------
  let activeResult = -1;
  function closeResults() {
    const box = $("results");
    box.hidden = true; box.innerHTML = ""; activeResult = -1;
    $("q").setAttribute("aria-expanded", "false");
    $("q").removeAttribute("aria-activedescendant");
  }
  function showResults() {
    const q = state.query.trim().toLowerCase(), box = $("results");
    if (state.view !== "overview" || !q || !state.data) return closeResults();
    const found = state.data.leads.filter((l) => matches(l, q)).slice(0, 8);
    box.innerHTML = found.length ? found.map((l, i) => `<div class="result" role="option" id="res-${i}" data-id="${l.id}" aria-selected="false"><b>${esc(l.name)}</b>${badge(l.status)}<small>${esc([l.business, l.source].filter(Boolean).join(" · "))}</small></div>`).join("")
      : `<p class="results-empty">No leads match ${inPeriod()}.</p>`;
    box.hidden = false; activeResult = -1;
    $("q").setAttribute("aria-expanded", "true");
  }
  /** Open a lead from the quick results and clear the search, so it doesn't linger as a filter elsewhere. */
  function pickResult(id) {
    $("q").value = ""; state.query = "";
    closeResults();
    openById(id);
  }
  function bindSearch() {
    const q = $("q"), box = $("results");
    q.addEventListener("input", () => {
      state.query = q.value;
      if (state.view === "overview") showResults(); else render();
    });
    q.addEventListener("keydown", (e) => {
      const items = [...box.querySelectorAll(".result")];
      if (e.key === "Escape") { if (!box.hidden) { e.preventDefault(); closeResults(); } return; }
      if (box.hidden || !items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        activeResult = (activeResult + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((el, i) => el.setAttribute("aria-selected", String(i === activeResult)));
        q.setAttribute("aria-activedescendant", items[activeResult].id);
        items[activeResult].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        pickResult(items[Math.max(0, activeResult)].dataset.id);
      }
    });
    q.addEventListener("focus", showResults);
    box.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".result");
      if (item) { e.preventDefault(); pickResult(item.dataset.id); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) closeResults(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || document.querySelector("dialog[open]")) return;
      e.preventDefault(); q.focus();
    });
  }

  // ---------- Sign-in, theme, wiring ----------
  function showSignIn(message) {
    if (!cfg.auth) return;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    $("signin").hidden = false;
    if (message !== undefined) $("signinErr").textContent = message;
    $("pw").focus();
  }
  function paintTheme() {
    const dark = (document.documentElement.dataset.theme || "dark") === "dark";
    $("themeBtn").innerHTML = `${icon(dark ? "sun" : "moon")}<span>${dark ? "Light mode" : "Dark mode"}</span>`;
    $("themeBtn").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function bind() {
    const view = $("view");
    view.addEventListener("click", onViewClick);
    view.addEventListener("change", onViewChange);
    bindDrag(view);
    bindLeadForm(); bindTimeForm(); bindSearch();

    document.querySelectorAll(".nav-item[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    $("range").value = state.range;
    $("range").addEventListener("change", (e) => { state.range = e.target.value; store("hp-range", state.range); state.time = null; load(); });
    $("primaryBtn").addEventListener("click", () => {
      if (!state.data) return;
      if (state.view === "time") openTimeDialog(); else openLead(null);
    });
    $("themeBtn").addEventListener("click", () => {
      const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store("hp-theme", next);
      paintTheme();
    });
    paintTheme();

    $("digestBtn").addEventListener("click", () => act($("digestBtn"), async () => {
      const d = await call("/api/digest?preview=1", "POST");
      $("digestSubject").textContent = d.subject;
      $("digestFrame").srcdoc = d.html;
      $("digestDlg").showModal();
    }));
    $("digestSend").addEventListener("click", () => act($("digestSend"), async () => {
      const r = await call("/api/digest", "POST");
      toast(r.sent ? `Sent: ${r.subject}` : "Demo: no email was sent.");
      $("digestDlg").close();
    }));

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
      $("signOutBtn").addEventListener("click", () => act($("signOutBtn"), async () => {
        await cfg.auth.signOut();
        state.data = null; state.time = null; state.error = "";
        render();
        showSignIn("");
      }));
    }
  }

  async function start(config) {
    cfg = config;
    // The demo always opens on Overview and 30 days, and never shares saved preferences with the real tracker.
    const live = cfg.mode !== "demo";
    const view = live ? stored("hp-view", "overview") : "overview", range = live ? stored("hp-range", "30") : "30";
    state.view = VIEWS[view] ? view : "overview";
    state.range = RANGES[range] ? range : "30";
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
    await load();
  }

  window.HeurialTracker = { start };
})();
