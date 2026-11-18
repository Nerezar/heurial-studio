/* HEURIAL Clip Desk: the page. Logic lives in core.js; this file draws it and keeps the data.
   Your own data: localStorage in this browser, with a backup file and a scoreboard.csv export.
   Sample data (?sample=1, or window.__SAMPLE from the Tools page): made up, in memory, never saved. */
(function () {
  const core = window.ClipDeskCore;
  const KEY = "heurial-clipdesk-v1";
  const SAMPLE = window.__SAMPLE === true || new URLSearchParams(location.search).has("sample");
  const PLATFORMS = ["X", "Instagram", "TikTok", "YouTube Shorts", "Threads"];
  const PILLARS = ["News", "Tips", "Clip", "Nostalgia", "Spotlight", "Recap", "Question"];
  const FORMATS = ["Vertical video", "Landscape video", "Image", "Text", "Carousel"];
  const PERMISSIONS = ["Not asked", "Asked", "Allowed", "Declined", "Took down"];
  const KINDS = ["Rule", "Win", "Loss"];
  const VIEWS = [["today", "Today"], ["posts", "Posts"], ["review", "Review"], ["sources", "Sources"]];
  const METRICS = [["views_12h", "Views at 12h"], ["views_24h", "Views at 24h"], ["views_72h", "Views at 72h"],
    ["likes", "Likes"], ["reposts_or_shares", "Reposts or shares"], ["replies_or_comments", "Replies or comments"],
    ["saves_or_bookmarks", "Saves or bookmarks"], ["followers_at_read", "Followers at read"]];
  const HOUR = 3600e3;
  // Links back into Clip Desk carry the release fingerprint, so the host's long cache never serves an old page.
  const HOME = `/clipdesk/index.html?v=${encodeURIComponent(window.__TV || "")}`;

  const app = document.getElementById("app");
  const blank = () => ({ posts: [], facts: [], credits: [], rules: [], tests: {} });
  let state; // set at the bottom, once the helpers it needs exist
  let view = "today";
  let range = 7;
  let platform = "All";
  let editing = null; // a post id, "new", or null

  /* ---------- small helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmt = (n) => n == null ? "–" : n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : Math.round(n).toLocaleString("en-US");
  const pct = (x) => x == null || !Number.isFinite(x) ? "" : `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;
  const tone = (x) => x == null ? "" : x >= 0 ? "up" : "down";
  const safeUrl = (u) => /^https?:\/\//i.test(u || "") ? u : "";
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const opts = (list, value) => list.map((o) => `<option${o === value ? " selected" : ""}>${esc(o)}</option>`).join("");
  function ago(ms) {
    const h = Math.floor(ms / HOUR);
    return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.floor(h / 24)} days ago`;
  }
  function late(h) { return h <= 0 ? "due now" : h < 48 ? `${h}h late` : `${Math.floor(h / 24)} days late`; }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (core.validBackup(data)) return { tests: {}, ...data };
    } catch { /* no saved data, or storage is blocked: start empty */ }
    return blank();
  }
  function save() {
    if (SAMPLE) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { toast("This browser wouldn't save. Download a backup so nothing is lost."); }
  }
  function toast(msg) {
    const el = app.querySelector(".toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- drawing ---------- */
  function render() {
    const now = Date.now();
    const due = core.dueChecks(state.posts, now);
    const titles = { today: "Today", posts: "Posts", review: "Weekly review", sources: "Facts and credits" };
    const body = { today, posts, review, sources }[view](now, due);
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <div class="brand"><strong>Clip Desk</strong><span>by HEURIAL</span></div>
        <nav aria-label="Sections">${VIEWS.map(([k, label]) => `<button class="nav${view === k ? " on" : ""}" data-view="${k}"${view === k ? ' aria-current="page"' : ""}>${label}${k === "today" && due.length ? `<b aria-label="${due.length} reads due">${due.length}</b>` : ""}</button>`).join("")}</nav>
        <div class="side-foot">
          ${SAMPLE ? `<p><strong>Sample data.</strong> Made-up posts. Nothing you change is saved.</p><a class="side-link" href="${HOME}" target="_blank" rel="noopener">Use it for your own page</a>`
            : `<p>Saved in this browser only. Download a backup now and then.</p>`}
          <button class="side-btn" data-act="csv">Export scoreboard.csv</button>
          <button class="side-btn" data-act="backup">Download backup</button>
          ${SAMPLE ? "" : `<label class="side-btn file">Restore backup<input type="file" accept="application/json,.json" data-act="restore"></label>`}
        </div>
      </aside>
      <main class="main" tabindex="-1">
        <header class="top"><h1>${titles[view]}</h1><button class="btn primary" data-act="new">Log a post</button></header>
        ${body}
      </main>
    </div>
    ${editing ? dialog(now) : ""}
    <div class="toast" role="status" aria-live="polite"></div>`;
    const dlg = app.querySelector("dialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  function tile(label, value, note = "", cls = "") {
    return `<div class="tile"><p class="tile-label">${label}</p><p class="tile-value n">${value}</p>${note ? `<p class="tile-note ${cls}">${note}</p>` : ""}</div>`;
  }

  function welcome() {
    return `<section class="card welcome">
      <h2>Log your first post</h2>
      <p>Every time something goes out, log it here. Clip Desk tells you when its 12, 24 and 72-hour numbers are due, and the weekly review shows which pillars, times, platforms and tests beat your median.</p>
      <p class="hint">Your data stays in this browser. Nothing is sent anywhere.</p>
      <div class="row"><button class="btn primary" data-act="new">Log a post</button><a class="btn" href="${HOME}&sample=1">See it with sample data</a></div>
    </section>`;
  }

  function today(now, due) {
    if (!state.posts.length) return welcome();
    const w = core.week(state.posts, now);
    const change = w.median != null && w.lastMedian ? (w.median - w.lastMedian) / w.lastMedian : null;
    const stale = core.staleFacts(state.facts, now);
    const d = dayOf(new Date(now));
    const recent = Object.entries(state.tests).filter(([k, v]) => v && k !== d).sort().reverse().slice(0, 5);
    return `<section class="tiles">
        ${tile("Posts, last 7 days", w.posts)}
        ${tile("Median views at 24h", fmt(w.median), change == null ? "No week before to compare" : `${pct(change)} on the week before`, tone(change))}
        ${tile("Best post this week", w.best ? fmt(w.best.views_24h) : "–", w.best ? esc(w.best.hook) : "Needs a 24h read")}
        ${tile("Reads due", due.length, due.length ? "Fill them in below" : "All caught up", due.length ? "warn" : "up")}
      </section>
      <div class="grid">
        <section class="card span2" aria-labelledby="h-due">
          <h2 id="h-due">Reads due</h2>
          <p class="hint">Copy the view count from the platform. If it isn't available, skip it. Never guess a number.</p>
          ${due.length ? `<ul class="due-list">${due.map(({ post, hours, lateBy }) => `<li>
            <form class="due" data-form="read" data-id="${post.id}" data-h="${hours}">
              <span class="chip">${esc(post.platform)}</span>
              <span class="due-hook">${esc(post.hook) || "Untitled post"}</span>
              <span class="due-when ${lateBy > 12 ? "down" : "warn"}">${hours}h read · ${late(lateBy)}</span>
              <input name="views" inputmode="numeric" autocomplete="off" placeholder="Views" aria-label="Views at ${hours} hours for ${esc(post.hook)}">
              <button class="btn small primary">Save</button>
              <button class="btn small ghost" type="button" data-act="skip" data-id="${post.id}" data-h="${hours}">Skip</button>
            </form></li>`).join("")}</ul>` : `<p class="empty">Nothing due. The next read shows up here when a post reaches 12, 24 or 72 hours.</p>`}
        </section>
        <section class="card" aria-labelledby="h-test">
          <h2 id="h-test">Today's test</h2>
          <p class="hint">Change one thing today and name it, like “hook: question”. New posts today get this name, so the review can compare it.</p>
          <form class="row" data-form="test"><input name="test" value="${esc(state.tests[d] || "")}" placeholder="hook: question" aria-label="Today's test"><button class="btn small primary">Save</button></form>
          ${recent.length ? `<ul class="mini">${recent.map(([k, v]) => `<li><span>${esc(v)}</span><span class="n">${k.slice(5)}</span></li>`).join("")}</ul>` : ""}
        </section>
        <section class="card" aria-labelledby="h-stale">
          <h2 id="h-stale">Facts to recheck</h2>
          ${stale.length ? `<ul class="mini">${stale.map((f) => `<li><span>${esc(f.text)}</span><button class="btn small" data-act="checked" data-id="${f.id}">Checked</button></li>`).join("")}</ul>`
            : `<p class="empty">${state.facts.length ? "Every fact was checked in the last 48 hours." : "No facts yet. Add each fact you post, with its source."}</p>`}
          <button class="link" data-view="sources">All facts and credits</button>
        </section>
      </div>`;
  }

  function posts() {
    if (!state.posts.length) return welcome();
    const list = state.posts.filter((p) => platform === "All" || p.platform === platform)
      .sort((a, b) => core.postedAt(b) - core.postedAt(a));
    const cell = (v) => `<td class="n">${fmt(v)}</td>`;
    return `<div class="filters" role="group" aria-label="Platform">${["All", ...PLATFORMS].map((p) => `<button class="pill${platform === p ? " on" : ""}" data-platform="${esc(p)}" aria-pressed="${platform === p}">${esc(p)}</button>`).join("")}</div>
      <section class="card flush"><div class="table-wrap"><table class="table">
        <thead><tr><th>Posted</th><th>Platform</th><th>Pillar</th><th>Hook</th><th class="n">Sec</th><th class="n">12h</th><th class="n">24h</th><th class="n">72h</th><th class="n">Likes</th><th class="n">Shares</th><th class="n">Saves</th><th>Test</th></tr></thead>
        <tbody>${list.map((p) => `<tr>
          <td class="n nowrap">${p.date.slice(5)} ${esc(p.time)}</td>
          <td><span class="chip">${esc(p.platform)}</span></td>
          <td>${esc(p.pillar)}</td>
          <td class="hook"><button class="link" data-edit="${p.id}">${esc(p.hook) || "Untitled post"}</button>${p.credit ? `<small>${esc(p.credit)}</small>` : ""}</td>
          ${cell(p.length_sec)}${cell(p.views_12h)}${cell(p.views_24h)}${cell(p.views_72h)}${cell(p.likes)}${cell(p.reposts_or_shares)}${cell(p.saves_or_bookmarks)}
          <td class="muted nowrap">${esc(p.test_name)}</td></tr>`).join("") || `<tr><td colspan="12" class="empty">No posts on ${esc(platform)} yet.</td></tr>`}</tbody>
      </table></div></section>
      <p class="hint">${list.length} posts. Select a hook to fill in numbers or edit it. “–” means not read yet.</p>`;
  }

  function groupTable(title, groups) {
    if (!groups.length) return "";
    const max = Math.max(...groups.map((g) => g.median || 0)) || 1;
    return `<section class="card"><h2>${title}</h2><div class="table-wrap"><table class="table compact">
      <thead><tr><th>${title.replace("By ", "")}</th><th class="n">Posts</th><th class="n">Median</th><th class="n">vs page</th></tr></thead>
      <tbody>${groups.map((g) => `<tr><td><span class="bar" style="--w:${Math.round((g.median / max) * 100)}%"></span>${esc(g.key)}</td><td class="n">${g.posts}</td><td class="n">${fmt(g.median)}</td><td class="n ${tone(g.vsPage)}">${pct(g.vsPage)}</td></tr>`).join("")}</tbody>
    </table></div></section>`;
  }

  function review(now) {
    const r = core.review(state.posts, now, range);
    const rank = (list) => list.length ? `<ol class="rank">${list.map((p) => `<li><button class="link" data-edit="${p.id}">${esc(p.hook) || "Untitled post"}</button><span class="muted">${esc(p.platform)} · ${esc(p.pillar)}</span><b class="n">${fmt(p.views_24h)}</b></li>`).join("")}</ol>` : `<p class="empty">Not enough posts yet.</p>`;
    const rules = KINDS.map((k) => [k, state.rules.filter((x) => x.kind === k)]);
    return `<div class="filters" role="group" aria-label="Period">${[7, 30].map((n) => `<button class="pill${range === n ? " on" : ""}" data-range="${n}" aria-pressed="${range === n}">Last ${n} days</button>`).join("")}</div>
      <p class="hint lead">Every post is compared on its views at 24 hours, so posts are measured the same way. ${r.count} posts counted, median <b class="n">${fmt(r.median)}</b>. Posts younger than 24 hours aren't judged yet.</p>
      ${r.count < 3 ? `<section class="card"><p class="empty">The review needs at least 3 posts with a 24-hour read in this period.</p></section>` : `<div class="grid">
        <section class="card"><h2>Top 3</h2>${rank(r.top)}</section>
        <section class="card"><h2>Bottom 3</h2>${rank(r.bottom)}</section>
        ${groupTable("By pillar", r.byPillar)}${groupTable("By time slot", r.bySlot)}${groupTable("By platform", r.byPlatform)}${groupTable("By test", r.byTest)}
      </div>`}
      <section class="card" aria-labelledby="h-rules">
        <h2 id="h-rules">Wins, losses and rules</h2>
        <p class="hint">Write one lesson after each review. Rules are what you'll keep doing.</p>
        <form class="row" data-form="rule"><select name="kind" aria-label="Kind">${opts(KINDS, "Rule")}</select><input name="text" placeholder="Question hooks beat statements on X" aria-label="Lesson" required><button class="btn small primary">Add</button></form>
        <div class="rules">${rules.map(([k, list]) => `<div><h3>${k}s</h3>${list.length ? `<ul class="mini">${list.map((x) => `<li><span>${esc(x.text)}</span><button class="x" data-act="del-rule" data-id="${x.id}" aria-label="Delete ${esc(x.text)}">×</button></li>`).join("")}</ul>` : `<p class="empty">None yet.</p>`}</div>`).join("")}</div>
      </section>`;
  }

  function sources(now) {
    const stale = new Set(core.staleFacts(state.facts, now).map((f) => f.id));
    return `<div class="grid">
      <section class="card span2" aria-labelledby="h-facts">
        <h2 id="h-facts">Facts</h2>
        <p class="hint">Every fact you post, with the official page it came from. Anything older than 48 hours gets checked again before it's used.</p>
        <form class="row" data-form="fact"><input name="text" placeholder="The fact, in one line" aria-label="Fact" required><input name="source" type="url" placeholder="https://official source" aria-label="Source link" required><button class="btn small primary">Add</button></form>
        ${state.facts.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Fact</th><th>Source</th><th>Checked</th><th></th></tr></thead><tbody>${state.facts.map((f) => `<tr>
          <td>${esc(f.text)}</td>
          <td>${safeUrl(f.source) ? `<a href="${esc(f.source)}" target="_blank" rel="noopener noreferrer">${esc(host(f.source))}</a>` : `<span class="muted">${esc(f.source)}</span>`}</td>
          <td class="nowrap ${stale.has(f.id) ? "warn" : "muted"}">${f.checked ? ago(now - new Date(f.checked).getTime()) : "Never"}${stale.has(f.id) ? " · recheck" : ""}</td>
          <td class="actions"><button class="btn small" data-act="checked" data-id="${f.id}">Checked</button><button class="x" data-act="del-fact" data-id="${f.id}" aria-label="Delete fact">×</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No facts yet.</p>`}
      </section>
      <section class="card span2" aria-labelledby="h-credits">
        <h2 id="h-credits">Credits and takedowns</h2>
        <p class="hint">Who you clipped, and whether they're OK with it. If someone asks you to take a clip down, do it the same day and mark it here.</p>
        <form class="row" data-form="credit"><input name="creator" placeholder="@creator" aria-label="Creator" required><input name="link" type="url" placeholder="https://their channel" aria-label="Their link"><select name="permission" aria-label="Permission">${opts(PERMISSIONS, "Not asked")}</select><input name="notes" placeholder="Notes" aria-label="Notes"><button class="btn small primary">Add</button></form>
        ${state.credits.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Creator</th><th>Permission</th><th>Clips used</th><th>Notes</th><th></th></tr></thead><tbody>${state.credits.map((c) => {
          const used = state.posts.filter((p) => (p.credit || "").toLowerCase().includes(c.creator.toLowerCase())).length;
          return `<tr><td>${safeUrl(c.link) ? `<a href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">${esc(c.creator)}</a>` : esc(c.creator)}</td>
          <td><select data-act="permission" data-id="${c.id}" aria-label="Permission for ${esc(c.creator)}" class="${c.permission === "Took down" || c.permission === "Declined" ? "down" : c.permission === "Allowed" ? "up" : ""}">${opts(PERMISSIONS, c.permission)}</select></td>
          <td class="n">${used}</td><td class="muted">${esc(c.notes)}</td>
          <td class="actions"><button class="x" data-act="del-credit" data-id="${c.id}" aria-label="Delete ${esc(c.creator)}">×</button></td></tr>`;
        }).join("")}</tbody></table></div>` : `<p class="empty">No creators yet.</p>`}
      </section>
    </div>`;
  }

  function dialog(now) {
    const p = editing === "new"
      ? { id: "", date: dayOf(new Date(now)), time: timeOf(new Date(now)), platform: "X", pillar: "Tips", format: "Vertical video", hook: "", credit: "", test_name: state.tests[dayOf(new Date(now))] || "", notes: "" }
      : state.posts.find((x) => x.id === editing);
    if (!p) return "";
    const field = (name, label, value, attrs = "") => `<label><span>${label}</span><input name="${name}" value="${esc(value ?? "")}" ${attrs}></label>`;
    return `<dialog aria-labelledby="dlg-title">
      <form data-form="post" method="dialog">
        <header><h2 id="dlg-title">${p.id ? "Edit post" : "Log a post"}</h2><button class="x" type="button" data-act="close" aria-label="Close">×</button></header>
        <div class="fields">
          ${field("date", "Date", p.date, 'type="date" required')}
          ${field("time", "Time", p.time, 'type="time" required')}
          <label><span>Platform</span><select name="platform">${opts(PLATFORMS, p.platform)}</select></label>
          <label><span>Pillar</span><select name="pillar">${opts(PILLARS, p.pillar)}</select></label>
          <label><span>Format</span><select name="format">${opts(FORMATS, p.format)}</select></label>
          ${field("length_sec", "Length (seconds)", p.length_sec, 'inputmode="numeric"')}
          <label class="wide"><span>Hook</span><input name="hook" value="${esc(p.hook)}" placeholder="HIDDEN SPOT MOST PLAYERS MISS" required></label>
          ${field("credit", "Credit", p.credit, 'placeholder="@creator"')}
          ${field("test_name", "Test", p.test_name, 'placeholder="hook: question"')}
        </div>
        <h3>Numbers <small>Leave blank until you've read them</small></h3>
        <div class="fields four">${METRICS.map(([k, label]) => field(k, label, p[k], 'inputmode="numeric" autocomplete="off"')).join("")}</div>
        <label class="wide"><span>Notes</span><textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>
        <footer>${p.id ? `<button class="btn ghost danger" type="button" data-act="del-post" data-id="${p.id}">Delete post</button>` : ""}<span></span><button class="btn" type="button" data-act="close">Cancel</button><button class="btn primary">${p.id ? "Save" : "Log post"}</button></footer>
      </form>
    </dialog>`;
  }

  /* ---------- changes ---------- */
  function savePost(form) {
    const f = new FormData(form);
    const post = editing === "new" ? { id: uid() } : { ...state.posts.find((x) => x.id === editing) };
    for (const k of ["date", "time", "platform", "pillar", "format", "hook", "credit", "test_name", "notes"]) post[k] = String(f.get(k) ?? "").trim();
    for (const [k, label] of [["length_sec", "Length"], ...METRICS]) {
      const n = core.readCount(f.get(k));
      if (n === undefined) { toast(`${label}: whole numbers only.`); return false; }
      post[k] = n;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) { toast("Pick a date."); return false; }
    state.posts = editing === "new" ? [...state.posts, post] : state.posts.map((x) => x.id === post.id ? post : x);
    return true;
  }

  function commit(msg) { save(); render(); if (msg) toast(msg); }

  app.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const f = new FormData(form);
    const kind = form.dataset.form;
    if (kind === "post") {
      const isNew = editing === "new";
      if (!savePost(form)) return;
      editing = null;
      commit(isNew ? "Post logged. Today asks for its numbers when they're due." : "Saved.");
    } else if (kind === "read") {
      const n = core.readCount(f.get("views"));
      if (n == null) { toast(n === null ? "Type the view count, or skip it." : "Whole numbers only."); return; }
      state.posts = state.posts.map((p) => p.id === form.dataset.id ? { ...p, [`views_${form.dataset.h}h`]: n } : p);
      commit("Read saved.");
    } else if (kind === "test") {
      state.tests = { ...state.tests, [dayOf(new Date())]: String(f.get("test")).trim() };
      commit("Today's test saved.");
    } else if (kind === "rule") {
      state.rules = [...state.rules, { id: uid(), kind: String(f.get("kind")), text: String(f.get("text")).trim(), date: dayOf(new Date()) }];
      commit();
    } else if (kind === "fact") {
      // Adding a fact means you've just checked it.
      state.facts = [...state.facts, { id: uid(), text: String(f.get("text")).trim(), source: String(f.get("source")).trim(), checked: new Date().toISOString() }];
      commit("Fact added.");
    } else if (kind === "credit") {
      state.credits = [...state.credits, { id: uid(), creator: String(f.get("creator")).trim(), link: String(f.get("link")).trim(), permission: String(f.get("permission")), notes: String(f.get("notes")).trim() }];
      commit("Creator added.");
    }
  });

  app.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-view]");
    if (!t) return;
    const { act, id } = t.dataset;
    if (t.dataset.view) { view = t.dataset.view; render(); app.querySelector(".main")?.focus(); return; }
    if (t.dataset.platform) { platform = t.dataset.platform; render(); return; }
    if (t.dataset.range) { range = Number(t.dataset.range); render(); return; }
    if (t.dataset.edit) { editing = t.dataset.edit; render(); return; }
    if (act === "new") { editing = "new"; render(); }
    else if (act === "close") { app.querySelector("dialog")?.close(); }
    else if (act === "skip") {
      const h = Number(t.dataset.h);
      state.posts = state.posts.map((p) => p.id === id ? { ...p, skipped: [...new Set([...(p.skipped || []), h])] } : p);
      commit(`Skipped the ${h}h read. It stays blank.`);
    } else if (act === "checked") {
      state.facts = state.facts.map((f) => f.id === id ? { ...f, checked: new Date().toISOString() } : f);
      commit("Marked as checked now.");
    } else if (act === "del-post" && confirm("Delete this post and its numbers?")) {
      state.posts = state.posts.filter((p) => p.id !== id); editing = null; commit("Post deleted.");
    } else if (act === "del-fact") { state.facts = state.facts.filter((f) => f.id !== id); commit(); }
    else if (act === "del-credit") { state.credits = state.credits.filter((c) => c.id !== id); commit(); }
    else if (act === "del-rule") { state.rules = state.rules.filter((r) => r.id !== id); commit(); }
    else if (act === "csv") download("scoreboard.csv", core.toCSV(state.posts), "text/csv");
    else if (act === "backup") download(`clip-desk-backup-${dayOf(new Date())}.json`, JSON.stringify(state, null, 2), "application/json");
  });

  app.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.act === "permission") {
      state.credits = state.credits.map((c) => c.id === t.dataset.id ? { ...c, permission: t.value } : c);
      commit();
    } else if (t.dataset.act === "restore" && t.files?.[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        if (!core.validBackup(data)) throw new Error("shape");
        if (!confirm(`Replace what's here with this backup (${data.posts.length} posts)?`)) return;
        state = { tests: {}, ...data };
        commit("Backup restored.");
      } catch { toast("That file isn't a Clip Desk backup."); }
    }
  });

  // Closing the dialog any way (Esc, Cancel, ×) drops the edit and redraws without it.
  app.addEventListener("close", (e) => { if (e.target.tagName === "DIALOG") { editing = null; render(); } }, true);

  /* ---------- sample data: a made-up gaming clip page, built around the current time ---------- */
  function sample() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const now = Date.now();
    const hooks = [
      ["Tips", "3 MONEY TIPS FOR DAY ONE"], ["Clip", "HIDDEN BEACH MOST PLAYERS DRIVE PAST"], ["Question", "What's the first thing you did?"],
      ["Tips", "HOW TO GET A FREE CAR IN 30 SECONDS"], ["Clip", "THE ROOFTOP VIEW NOBODY TALKS ABOUT"], ["News", "Patch notes in 20 seconds"],
      ["Clip", "NPC REACTION 💀"], ["Tips", "DON'T SKIP THIS MISSION REWARD"], ["Recap", "Day 3 recap: 5 things I learned"],
      ["Nostalgia", "Same street, 12 years apart"], ["Clip", "THE FASTEST CAR I'VE FOUND SO FAR"], ["Spotlight", "The radio host everyone quotes"],
      ["Tips", "WHERE TO SELL CARS FOR THE MOST CASH"], ["Question", "Best car so far? Wrong answers only"], ["Clip", "SECRET ROOM UNDER THE PIER"],
    ];
    const pillarLift = { Tips: 1.6, Clip: 1.3, News: 1, Question: .5, Recap: .8, Nostalgia: 1.1, Spotlight: .7 };
    const platformBase = { X: 2400, Instagram: 5200, TikTok: 9000, "YouTube Shorts": 6100, Threads: 900 };
    const slots = ["07:30", "12:15", "18:30"];
    const credits = ["🎥 @sample_ren", "🎥 @sample_maptourist", "", "🎥 @sample_nightdrive", ""];
    const out = [];
    let i = 0;
    for (let back = 9; back >= 0; back--) {
      for (const time of slots) {
        const d = new Date(now - back * 24 * HOUR);
        const date = dayOf(d);
        const at = new Date(`${date}T${time}`).getTime();
        if (at > now) continue;
        const [pillar, hook] = hooks[i % hooks.length];
        const plat = ["X", "TikTok", "Instagram", "YouTube Shorts", "X", "Threads"][i % 6];
        const test = back <= 5 ? (i % 2 ? "hook: question" : "hook: statement") : "";
        const v24 = Math.round(platformBase[plat] * pillarLift[pillar] * (0.55 + rnd() * 0.9) * (test === "hook: question" ? 1.25 : 1));
        const age = now - at;
        // A read is in once it was due and some hours have passed; the freshest ones are left due on purpose.
        const read = (h, v) => age >= (h + 6) * HOUR ? v : null;
        const v72 = Math.round(v24 * (1.35 + rnd() * .4));
        const best = age >= 78 * HOUR ? v72 : v24;
        out.push({ id: `s${i}`, date, time, platform: plat, pillar, format: plat === "X" && pillar === "Question" ? "Text" : "Vertical video", hook,
          length_sec: pillar === "Question" ? null : 9 + Math.round(rnd() * 21), credit: pillar === "Clip" ? credits[i % credits.length] : "",
          views_12h: read(12, Math.round(v24 * .62)), views_24h: read(24, v24), views_72h: read(72, v72),
          likes: read(24, Math.round(best * (.04 + rnd() * .03))), reposts_or_shares: read(24, Math.round(best * .009)), replies_or_comments: read(24, Math.round(best * .007)),
          saves_or_bookmarks: read(24, Math.round(best * (pillar === "Tips" ? .03 : .008))), followers_at_read: read(24, 1200 + i * 41), test_name: test, notes: "" });
        i++;
      }
    }
    const iso = (hoursAgo) => new Date(now - hoursAgo * HOUR).toISOString();
    const tests = {};
    for (let back = 5; back >= 1; back--) tests[dayOf(new Date(now - back * 24 * HOUR))] = "hook: question vs statement";
    return {
      posts: out,
      facts: [
        { id: "f1", text: "Patch 1.02 is out on both consoles", source: "https://example.com/official/patch-notes", checked: iso(20) },
        { id: "f2", text: "Servers are down for maintenance Thursday, 9 AM CT", source: "https://example.com/official/status", checked: iso(61) },
        { id: "f3", text: "Photo mode arrives in the next update", source: "https://example.com/official/news", checked: iso(70) },
      ],
      credits: [
        { id: "c1", creator: "@sample_ren", link: "https://example.com/ren", permission: "Allowed", notes: "Said yes by DM, wants a tag" },
        { id: "c2", creator: "@sample_maptourist", link: "https://example.com/maptourist", permission: "Asked", notes: "" },
        { id: "c3", creator: "@sample_nightdrive", link: "", permission: "Took down", notes: "Asked me to remove the pier clip. Removed same day." },
      ],
      rules: [
        { id: "r1", kind: "Rule", text: "Post the tip version first and the clip second", date: dayOf(new Date(now - 3 * 24 * HOUR)) },
        { id: "r2", kind: "Win", text: "Question hooks beat statements on X", date: dayOf(new Date(now - 2 * 24 * HOUR)) },
        { id: "r3", kind: "Loss", text: "Threads posts at night barely move", date: dayOf(new Date(now - 2 * 24 * HOUR)) },
      ],
      tests,
    };
  }

  state = SAMPLE ? sample() : load();
  render();
})();
