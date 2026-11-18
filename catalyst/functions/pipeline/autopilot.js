// Autopilot routes: the engine (engine.js) joined to accounts (accounts.js) and the senders.
//   app/autopilot/*     a signed-in customer: what's waiting for approval, what happened, which automations are on
//   autopilot/events    site key only: something happened for one business (webhooks will call this in the next step)
//   autopilot/tick      site key only: the cron job, every 5 minutes; sends what's due for every paid-up business
// Every read and write for a business goes through accounts.scoped(), so one business can't reach another's rows.

const core = require("./core");
const rules = require("./autopilot-core"); // a copy of public/autopilot/core.js; engine.test.js checks they match
const accounts = require("./accounts");
const { createEngine, TABLES } = require("./engine");

const T = { ...TABLES, settings: "AutomationSettings", users: "Users", tenants: accounts.TABLES.tenants };
const ID = /^\d{1,20}$/;
const TRIGGERS = new Set(rules.CATALOG.map((a) => a.trigger));
const AI = new Set(rules.CATALOG.filter((a) => a.ai).map((a) => a.id));
const USES_CREDIT = ["approval", "queued", "sending", "sent", "failed"];
const TEXTS_PER_HOUR = 60; // per business, so one runaway automation can't burn a bill
const yes = (v) => v === true || v === "true";

/** Unpaid or no plan: automations pause. Nothing is deleted. */
const active = (tenant) => accounts.PLANS.includes(tenant.plan) && tenant.billing_status === "active";

/** What the rules need to know about one business. `store` is already scoped to it. */
async function contextFor(store, tenant, now) {
  const [settingRows, outbox] = await Promise.all([store.list(T.settings), store.list(T.outbox)]);
  const enabled = {}, settings = {};
  for (const r of settingRows) {
    enabled[r.automation] = yes(r.enabled);
    settings[r.automation] = { message: r.message || "", ...(r.approve === "" || r.approve == null ? {} : { approve: yes(r.approve) }) };
  }
  const month = now.toISOString().slice(0, 7);
  return {
    tenant: String(tenant.ROWID), plan: tenant.plan, enabled, settings, textsPerHour: TEXTS_PER_HOUR,
    // Written messages used this month, counted from the Outbox itself.
    used: outbox.filter((r) => AI.has(r.automation) && USES_CREDIT.includes(r.status) && String(r.created_at).startsWith(month)).length,
    hours: { open: tenant.hours_open || "08:00", close: tenant.hours_close || "20:00", timeZone: tenant.time_zone || undefined },
    vars: { business: tenant.name, booking_link: tenant.booking_link, review_link: tenant.review_link },
  };
}

/** Delivers one Outbox row.
    shortcut: every business sends from the one shared number and mail sender. The Connections step gives each
    business its own; don't put a second real business on this before then. */
function sender(deps, store, tenant) {
  const out = deps.sendMessage || {};
  return async (row) => {
    const contact = row.contact_id ? await store.get(T.contacts, row.contact_id) : null;
    if (row.channel === "text" && out.sms && contact && contact.phone) return out.sms({ to: contact.phone, body: row.body });
    if (row.channel === "email" && out.email && contact && contact.email) return out.email({ to: contact.email, subject: tenant.name, body: row.body });
    if (row.channel === "owner" && out.email) {
      const owner = (await store.list(T.users)).find((u) => u.role === "owner");
      const automation = rules.CATALOG.find((a) => a.id === row.automation);
      if (owner) return out.email({ to: owner.email, subject: automation ? automation.name : "Autopilot", body: row.body });
    }
    throw new Error(`Can't send by ${row.channel} yet: it isn't connected, or the contact has no address.`);
  };
}

const publicRow = (r) => ({
  id: String(r.ROWID), automation: r.automation, contact_id: r.contact_id || "", channel: r.channel, body: r.body || "",
  status: r.status, reason: r.reason || "", error: r.error || "", created_at: r.created_at, send_at: r.send_at || "", sent_at: r.sent_at || "",
});

/** Handle autopilot/* and app/autopilot/*. Returns { status, body }, or null when the path isn't one of these. */
async function route(path, method, io, deps, now) {
  const engineFor = (store, tenant) => createEngine({ core: rules, send: sender(deps, store, tenant), now: () => now });

  if (path === "autopilot/tick" && method === "POST") {
    const totals = { businesses: 0, errors: 0 };
    for (const tenant of await deps.store.list(T.tenants)) {
      if (!active(tenant)) continue;
      totals.businesses++;
      try {
        const store = accounts.scoped(deps.store, tenant.ROWID);
        const done = await engineFor(store, tenant).tick(store, await contextFor(store, tenant, now));
        for (const [k, n] of Object.entries(done)) totals[k] = (totals[k] || 0) + n;
      } catch (err) {
        // One business's trouble doesn't stop the others.
        console.error("autopilot: tick failed for", String(tenant.ROWID), err && err.message);
        totals.errors++;
      }
    }
    return { status: 200, body: totals };
  }

  if (path === "autopilot/events" && method === "POST") {
    const b = await io.readJson();
    const tenant = ID.test(String(b.tenant_id || "")) ? await deps.store.get(T.tenants, String(b.tenant_id)) : null;
    if (!tenant) throw new core.Bad("Unknown business.", 404);
    if (!TRIGGERS.has(b.trigger)) throw new core.Bad("Unknown trigger.");
    if (typeof b.dedupe_key !== "string" || !b.dedupe_key || b.dedupe_key.length > 200) throw new core.Bad("An event needs a dedupe key.");
    if (b.payload != null && (typeof b.payload !== "object" || Array.isArray(b.payload))) throw new core.Bad("Payload must be an object.");
    if (!active(tenant)) return { status: 200, body: { paused: true, outbox: [] } };
    const store = accounts.scoped(deps.store, tenant.ROWID);
    const contact = b.contact_id ? await store.get(T.contacts, String(b.contact_id)) : {};
    if (!contact) throw new core.Bad("Unknown contact.", 404);
    const out = await engineFor(store, tenant).ingest(store, await contextFor(store, tenant, now), {
      trigger: b.trigger, contact, payload: b.payload || {}, dedupeKey: b.dedupe_key,
    });
    return { status: out.duplicate ? 200 : 201, body: { duplicate: out.duplicate, outbox: out.rows.map(publicRow) } };
  }

  if (!path.startsWith("app/autopilot/")) return null;
  const who = await accounts.signedIn(io, deps.store);
  if (!who) return { status: 401, body: { error: "Please sign in." } };
  const { tenant } = who;
  const store = accounts.scoped(deps.store, tenant.ROWID);
  const sub = path.slice("app/autopilot/".length);
  let m;

  // Approvals and Activity both read this: newest first.
  if (sub === "outbox" && method === "GET") {
    const rows = (await store.list(T.outbox)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200);
    return { status: 200, body: { outbox: rows.map(publicRow) } };
  }

  if ((m = sub.match(/^outbox\/(\d{1,20})\/decide$/)) && method === "POST") {
    const b = await io.readJson();
    if (b.body != null && (typeof b.body !== "string" || b.body.length > 1600)) throw new core.Bad("That message is too long.");
    const row = await engineFor(store, tenant).decide(store, await contextFor(store, tenant, now), m[1], { approve: b.approve === true, body: b.body });
    return { status: 200, body: publicRow(row) };
  }

  if (sub === "settings" && method === "GET") {
    const ctx = await contextFor(store, tenant, now);
    const plan = rules.PLANS.find((p) => p.id === tenant.plan);
    return {
      status: 200,
      body: {
        plan: plan ? plan.id : "none", paused: !active(tenant), used: ctx.used, credits: plan ? plan.credits : 0,
        automations: rules.CATALOG.map((a) => ({
          id: a.id, on: Boolean(ctx.enabled[a.id]), unlocked: Boolean(plan) && rules.unlocked(a, plan.id),
          approve: (ctx.settings[a.id] || {}).approve ?? a.ai, message: (ctx.settings[a.id] || {}).message || "",
        })),
      },
    };
  }

  // Turn one automation on or off, choose approve-first, or write its message.
  if ((m = sub.match(/^settings\/([a-z-]{1,40})$/)) && method === "POST") {
    const automation = rules.CATALOG.find((a) => a.id === m[1]);
    if (!automation) throw new core.Bad("Not found.", 404);
    const b = await io.readJson();
    const plan = rules.PLANS.find((p) => p.id === tenant.plan);
    if (b.on === true && !(plan && rules.unlocked(automation, plan.id))) {
      throw new core.Bad(`${automation.name} comes with the ${rules.unlockedBy(automation).name} plan.`, 403);
    }
    if (b.message != null && (typeof b.message !== "string" || b.message.length > 600)) throw new core.Bad("That message is too long.");
    const existing = (await store.list(T.settings)).find((r) => r.automation === automation.id);
    const row = {
      automation: automation.id,
      enabled: String(typeof b.on === "boolean" ? b.on : yes(existing && existing.enabled)),
      approve: typeof b.approve === "boolean" ? String(b.approve) : (existing && existing.approve) || "",
      message: typeof b.message === "string" ? b.message.trim() : (existing && existing.message) || "",
    };
    if (existing) await store.update(T.settings, { ROWID: String(existing.ROWID), ...row });
    else await store.insert(T.settings, row);
    return { status: 200, body: { id: automation.id, on: yes(row.enabled), approve: row.approve === "" ? automation.ai : yes(row.approve), message: row.message } };
  }

  return { status: 404, body: { error: "Not found." } };
}

module.exports = { route, contextFor, active };
