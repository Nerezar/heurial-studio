// Autopilot customer accounts: businesses (tenants), their people, sign-in links and Stripe plans.
// Routes live under app/* and are reached only through the website (site key). The website passes the signed-in
// user and business in X-Heurial-User and X-Heurial-Tenant; every request checks the user still belongs there.
// The one route without the site key is stripe/webhook, which checks Stripe's signature instead.

const crypto = require("node:crypto");
const core = require("./core");

const T = { tenants: "Tenants", users: "Users", tokens: "LoginTokens" };
const PLANS = ["starter", "pro", "business"];
const ID = /^\d{1,20}$/;
const EMAIL = /^[^\s@]{1,100}@[^\s@]{1,100}\.[a-z]{2,24}$/i;
const LINK_MINUTES = 15;
const HOUR = 3600_000;
// shortcut: limits are counted from table rows, not at the edge; add an edge rate limit before open sign-up.
const LIMITS = { linksPerEmail: 5, linksAll: 200, signupsAll: 20 };

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const cleanEmail = (v) => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!EMAIL.test(e)) throw new core.Bad("Enter a valid email address.");
  return e;
};

/**
 * A store that only sees one business's rows. Reads drop other businesses' rows, writes stamp tenant_id,
 * and updates or removes of another business's row fail as "Not found." Route code for customers uses only this.
 */
function scoped(store, tenantId) {
  const t = String(tenantId);
  if (!ID.test(t)) throw new Error("scoped store needs a tenant id");
  const mine = (row) => (row && String(row.tenant_id) === t ? row : null);
  const owned = async (table, id) => { if (!mine(await store.get(table, id))) throw new core.Bad("Not found.", 404); };
  return {
    // shortcut: reads the whole table and filters here; switch to a ZCQL query on tenant_id before there are many businesses.
    async list(table) { return (await store.list(table)).filter(mine); },
    async get(table, id) { return mine(await store.get(table, id)); },
    insert: (table, row) => store.insert(table, { ...row, tenant_id: t }),
    async update(table, row) { await owned(table, row.ROWID); return store.update(table, { ...row, tenant_id: t }); },
    async remove(table, id) { await owned(table, id); return store.remove(table, id); },
  };
}

const publicTenant = (t, stripe) => ({
  id: String(t.ROWID), name: t.name, plan: t.plan || "none", billing_status: t.billing_status || "",
  subscribed: Boolean(t.stripe_subscription_id) && t.plan !== "none",
  billing: !stripe || !stripe.api ? "off" : stripe.testMode ? "test" : "live",
});
const publicUser = (u) => ({ id: String(u.ROWID), email: u.email, role: u.role });

/** Stripe's webhook signature: header "t=…,v1=…", HMAC-SHA256 of "t.body" with the endpoint secret. */
function stripeSignatureValid(raw, header, secret, nowMs, toleranceS = 300) {
  if (!secret || typeof header !== "string") return false;
  let t = "";
  const sigs = [];
  for (const item of header.split(",")) {
    const [k, v] = item.split("=");
    if (k === "t") t = v;
    if (k === "v1" && v) sigs.push(v);
  }
  if (!/^\d{1,12}$/.test(t) || Math.abs(nowMs / 1000 - Number(t)) > toleranceS) return false;
  const good = Buffer.from(crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex"));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === good.length && crypto.timingSafeEqual(b, good); });
}

/** Plan and status from a Stripe subscription. Anything not paid up pauses automations; nothing is deleted. */
function planFromSubscription(sub, prices, deleted) {
  const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
  const plan = PLANS.find((p) => prices[p] && prices[p] === priceId);
  if (deleted || sub.status === "canceled" || sub.status === "incomplete_expired" || !plan) return { plan: "none", billing_status: deleted ? "canceled" : sub.status };
  return { plan, billing_status: ["active", "trialing"].includes(sub.status) ? "active" : "paused" };
}

/**
 * Handle app/* and stripe/webhook. Returns { status, body } or null when the path isn't an accounts route.
 * io: { readJson(), readBody(), headers }
 */
async function route(path, method, io, deps, now) {
  const { store } = deps;
  const stripe = deps.stripe;

  if (path === "stripe/webhook" && method === "POST") {
    const raw = await io.readBody();
    if (!stripe || !stripeSignatureValid(raw, io.headers["stripe-signature"], stripe.webhookSecret, now.getTime())) return { status: 401, body: { error: "Unauthorized" } };
    let event;
    try { event = JSON.parse(raw); } catch { throw new core.Bad("Invalid JSON."); }
    const obj = (event.data && event.data.object) || {};
    const tenantId = String((obj.metadata && obj.metadata.tenant_id) || obj.client_reference_id || "");
    if (!ID.test(tenantId)) return { status: 200, body: { ok: true, ignored: "no tenant" } };
    const tenant = await store.get(T.tenants, tenantId);
    if (!tenant) return { status: 200, body: { ok: true, ignored: "unknown tenant" } };
    if (tenant.stripe_customer_id && obj.customer && obj.customer !== tenant.stripe_customer_id) return { status: 200, body: { ok: true, ignored: "other customer" } };

    if (event.type === "checkout.session.completed") {
      await store.update(T.tenants, { ROWID: tenantId, stripe_customer_id: obj.customer || "", stripe_subscription_id: obj.subscription || "" });
      return { status: 200, body: { ok: true } };
    }
    if (/^customer\.subscription\.(created|updated|deleted)$/.test(event.type)) {
      // Stripe can deliver events out of order: an older event never overwrites a newer one.
      if (Number(event.created) < Number(tenant.stripe_event_at || 0)) return { status: 200, body: { ok: true, ignored: "older event" } };
      const deleted = event.type.endsWith("deleted");
      await store.update(T.tenants, {
        ROWID: tenantId, ...planFromSubscription(obj, stripe.prices || {}, deleted),
        stripe_customer_id: obj.customer || tenant.stripe_customer_id || "",
        stripe_subscription_id: deleted ? "" : obj.id || "",
        stripe_event_at: String(event.created || 0),
      });
      return { status: 200, body: { ok: true } };
    }
    return { status: 200, body: { ok: true, ignored: event.type } };
  }

  if (!path.startsWith("app/")) return null;
  const callStripe = async (p, params) => {
    try { return await stripe.api(p, params); } catch { throw new core.Bad("Stripe didn't answer. Try again in a moment.", 502); }
  };
  const sub = path.slice(4);
  const mailReady = typeof deps.sendMail === "function" && /^https?:\/\//.test(deps.appUrl || "");

  // Every sign-in is a one-time link. Only a hash of it is stored; it works once, for 15 minutes.
  const sendLink = async (user, tenant) => {
    const recent = (await store.list(T.tokens)).filter((r) => now.getTime() - Date.parse(r.created_at) < HOUR);
    if (recent.filter((r) => r.email === user.email).length >= LIMITS.linksPerEmail || recent.length >= LIMITS.linksAll) {
      throw new core.Bad("Too many sign-in links. Try again in an hour.", 429);
    }
    const token = crypto.randomBytes(32).toString("base64url");
    await store.insert(T.tokens, {
      token_hash: sha256(token), user_id: String(user.ROWID), email: user.email,
      created_at: now.toISOString(), expires_at: new Date(now.getTime() + LINK_MINUTES * 60_000).toISOString(), used_at: "",
    });
    const link = `${deps.appUrl.replace(/\/+$/, "")}/#token=${token}`;
    await deps.sendMail({
      to: user.email,
      subject: `Sign in to ${tenant.name} on Autopilot`,
      text: `Open this link to sign in. It works once, within ${LINK_MINUTES} minutes:\n${link}\n\nIf you didn't ask for it, ignore this email.`,
      html: `<p>Open this link to sign in to <b>${escapeHtml(tenant.name)}</b>. It works once, within ${LINK_MINUTES} minutes.</p><p><a href="${link}">Sign in</a></p><p>If you didn't ask for it, ignore this email.</p>`,
    });
  };
  const userByEmail = async (email) => (await store.list(T.users)).find((u) => u.email === email);

  if (sub === "signup" && method === "POST") {
    if (!mailReady) throw new core.Bad("Sign-in email isn't connected yet.", 503);
    const b = await io.readJson();
    const email = cleanEmail(b.email);
    const name = typeof b.business === "string" ? b.business.trim().slice(0, 120) : "";
    if (name.length < 2) throw new core.Bad("Enter your business name.");
    const existing = await userByEmail(email);
    if (existing) {
      // Same answer as a new sign-up, so this can't be used to find out who has an account.
      await sendLink(existing, (await store.get(T.tenants, existing.tenant_id)) || { name: "your business" });
      return { status: 200, body: { ok: true } };
    }
    const tenants = await store.list(T.tenants);
    if (tenants.filter((t) => now.getTime() - Date.parse(t.created_at) < HOUR).length >= LIMITS.signupsAll) {
      throw new core.Bad("Sign-up is busy. Try again in an hour.", 429);
    }
    const tenant = await store.insert(T.tenants, { name, plan: "none", billing_status: "", created_at: now.toISOString(), time_zone: "America/Chicago" });
    const user = await store.insert(T.users, { tenant_id: String(tenant.ROWID), email, role: "owner", created_at: now.toISOString() });
    await sendLink(user, tenant);
    return { status: 201, body: { ok: true } };
  }

  if (sub === "login" && method === "POST") {
    if (!mailReady) throw new core.Bad("Sign-in email isn't connected yet.", 503);
    const email = cleanEmail((await io.readJson()).email);
    const user = await userByEmail(email);
    if (user) await sendLink(user, (await store.get(T.tenants, user.tenant_id)) || { name: "your business" });
    return { status: 200, body: { ok: true } }; // the same whether or not the address has an account
  }

  if (sub === "verify" && method === "POST") {
    const token = (await io.readJson()).token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new core.Bad("That sign-in link isn't valid.", 401);
    const hash = sha256(token);
    const rows = await store.list(T.tokens);
    const row = rows.find((r) => r.token_hash === hash);
    if (!row || row.used_at || Date.parse(row.expires_at) <= now.getTime()) throw new core.Bad("That sign-in link has expired or was already used. Ask for a new one.", 401);
    await store.update(T.tokens, { ROWID: String(row.ROWID), used_at: now.toISOString() });
    // Tidy links older than a day.
    for (const r of rows.filter((r) => now.getTime() - Date.parse(r.created_at) > 24 * HOUR).slice(0, 50)) await store.remove(T.tokens, String(r.ROWID)).catch(() => {});
    const user = await store.get(T.users, row.user_id);
    const tenant = user && await store.get(T.tenants, user.tenant_id);
    if (!user || !tenant) throw new core.Bad("That account no longer exists.", 401);
    return { status: 200, body: { user: publicUser(user), tenant: publicTenant(tenant, stripe) } };
  }

  // Everything below needs a signed-in user, passed by the website.
  const userId = String(io.headers["x-heurial-user"] || "");
  const tenantId = String(io.headers["x-heurial-tenant"] || "");
  const user = ID.test(userId) ? await store.get(T.users, userId) : null;
  if (!user || String(user.tenant_id) !== tenantId) return { status: 401, body: { error: "Please sign in." } };
  const tenant = await store.get(T.tenants, tenantId);
  if (!tenant) return { status: 401, body: { error: "Please sign in." } };

  if (sub === "me" && method === "GET") {
    return { status: 200, body: { user: publicUser(user), tenant: publicTenant(tenant, stripe) } };
  }

  if (sub === "billing/checkout" && method === "POST") {
    if (!stripe || !stripe.api) throw new core.Bad("Billing isn't connected yet.", 503);
    if (user.role !== "owner") throw new core.Bad("Only the owner can change the plan.", 403);
    const plan = (await io.readJson()).plan;
    if (!PLANS.includes(plan) || !stripe.prices[plan]) throw new core.Bad("Unknown plan.");
    if (tenant.stripe_subscription_id && tenant.plan !== "none") throw new core.Bad("You already have a plan. Use Manage billing to change it.", 409);
    const base = deps.appUrl.replace(/\/+$/, "");
    const session = await callStripe("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": stripe.prices[plan],
      "line_items[0][quantity]": "1",
      success_url: `${base}/?billing=done`,
      cancel_url: `${base}/`,
      client_reference_id: tenantId,
      "metadata[tenant_id]": tenantId,
      "subscription_data[metadata][tenant_id]": tenantId,
      ...(tenant.stripe_customer_id ? { customer: tenant.stripe_customer_id } : { customer_email: user.email }),
    });
    return { status: 200, body: { url: session.url } };
  }

  if (sub === "billing/portal" && method === "POST") {
    if (!stripe || !stripe.api) throw new core.Bad("Billing isn't connected yet.", 503);
    if (user.role !== "owner") throw new core.Bad("Only the owner can manage billing.", 403);
    if (!tenant.stripe_customer_id) throw new core.Bad("Choose a plan first.");
    const session = await callStripe("billing_portal/sessions", { customer: tenant.stripe_customer_id, return_url: `${deps.appUrl.replace(/\/+$/, "")}/` });
    return { status: 200, body: { url: session.url } };
  }

  return { status: 404, body: { error: "Not found." } };
}

module.exports = { route, scoped, stripeSignatureValid, planFromSubscription, PLANS, TABLES: T };
