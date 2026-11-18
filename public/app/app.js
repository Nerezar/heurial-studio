// Autopilot account page: sign up, sign in with an emailed link, and choose a plan through Stripe.
// Everything goes through /api/app/*; the plan shown always comes from the server, which only Stripe can change.
(() => {
  const app = document.getElementById("app");
  const PLANS = [
    { id: "starter", name: "Starter", note: "8 automations that stop leads slipping away. 100 AI drafts a month." },
    { id: "pro", name: "Pro", note: "19 automations: follow-ups, reviews and money. 500 AI drafts a month." },
    { id: "business", name: "Business", note: "All 30 automations, including AI content and reports. 2,000 AI drafts a month." },
  ];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const header = (right = "") => `<header><img src="/brand/wordmark-ink.svg" alt="HEURIAL" onerror="this.replaceWith(document.createTextNode('HEURIAL'))">${right}</header>`;

  async function api(method, path, body) {
    const res = await fetch(`/api/app/${path}`, {
      method, credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
    return data;
  }

  function signedOut(note = "", isError = false) {
    app.innerHTML = `${header()}
      <section class="card welcome"><h2>Autopilot</h2><p>Sign in with your email. I send you a link that works once, for 15 minutes. There's no password to remember.</p></section>
      <div class="grid two" style="margin-top:12px">
        <section class="card"><h2>New here</h2>
          <form data-form="signup"><label>Business name<input name="business" required minlength="2" maxlength="120" autocomplete="organization"></label>
          <label>Your email<input name="email" type="email" required autocomplete="email"></label>
          <button class="btn primary">Create my account</button></form></section>
        <section class="card"><h2>Already have an account</h2>
          <form data-form="login"><label>Your email<input name="email" type="email" required autocomplete="email"></label>
          <button class="btn">Email me a sign-in link</button></form></section>
      </div>
      ${note ? `<p class="msg ${isError ? "err" : ""}" role="status">${esc(note)}</p>` : ""}`;
  }

  function signedIn({ user, tenant }, note = "") {
    const owner = user.role === "owner";
    const plans = PLANS.map((p) => {
      const current = tenant.plan === p.id;
      const action = !owner || tenant.billing === "off" ? ""
        : current ? `<button class="btn small" data-act="portal">Manage billing</button>`
        : tenant.subscribed ? `<button class="btn small" data-act="portal">Switch in billing</button>`
        : `<button class="btn primary small" data-plan="${p.id}">Choose ${p.name}</button>`;
      return `<section class="card ${current ? "current" : ""}"><h2>${p.name} ${current ? `<span class="chip">Your plan</span>` : ""}</h2><p class="hint">${p.note}</p>${action}</section>`;
    }).join("");
    const status = tenant.billing_status === "paused"
      ? `<p class="msg err">Your last payment didn't go through, so automations are paused. Your data is kept. Update your card in billing to start them again.</p>` : "";
    app.innerHTML = `${header(`<button class="btn ghost small" data-act="logout">Sign out</button>`)}
      <section class="card welcome"><h2>${esc(tenant.name)}</h2>
        <p>Signed in as ${esc(user.email)}. Plan: <strong>${tenant.plan === "none" ? "none yet" : esc(PLANS.find((p) => p.id === tenant.plan)?.name || tenant.plan)}</strong>.</p>
        ${tenant.billing === "test" ? `<p class="hint">Billing is in Stripe test mode. No real card is charged.</p>` : ""}
        ${tenant.billing === "off" ? `<p class="hint">Billing isn't switched on yet.</p>` : ""}
        ${status}
        <div class="row"><a class="btn primary" href="/app/autopilot">Open Autopilot</a><a class="btn" href="/autopilot">See the sample business</a></div>
      </section>
      <div class="grid plans">${plans}</div>
      ${note ? `<p class="msg" role="status">${esc(note)}</p>` : ""}`;
  }

  async function load(note) {
    try { signedIn(await api("GET", "me"), note); }
    catch (err) { signedOut(err.status === 401 ? "" : err.message, err.status !== 401); }
  }

  app.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector("button");
    button.disabled = true;
    const fields = Object.fromEntries(new FormData(form));
    try {
      await api("POST", form.dataset.form, fields);
      signedOut(`If ${fields.email} can sign in, a link is on its way. Check your inbox (and spam).`);
    } catch (err) { signedOut(err.message, true); }
  });

  app.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act],[data-plan]");
    if (!el) return;
    el.disabled = true;
    try {
      if (el.dataset.act === "logout") { await api("POST", "logout"); return signedOut("You're signed out."); }
      const { url } = el.dataset.plan ? await api("POST", "billing/checkout", { plan: el.dataset.plan }) : await api("POST", "billing/portal");
      location.assign(url);
    } catch (err) {
      el.disabled = false;
      const msg = app.querySelector(".msg.err.click") || app.appendChild(Object.assign(document.createElement("p"), { className: "msg err click", role: "alert" }));
      msg.textContent = err.message;
    }
  });

  // A sign-in link carries its token after #, so it never reaches a server log. Use it once, then drop it.
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  const done = new URLSearchParams(location.search).get("billing") === "done";
  history.replaceState(null, "", location.pathname + (location.search.includes("v=") ? `?v=${encodeURIComponent(window.__TV)}` : ""));
  if (token) {
    app.innerHTML = `${header()}<p class="msg">Signing you in…</p>`;
    api("POST", "verify", { token }).then((me) => signedIn(me)).catch((err) => signedOut(err.message, true));
  } else {
    load(done ? "Thanks. Your plan shows here as soon as Stripe confirms the payment, usually within a minute. Refresh to check." : "");
  }
})();
