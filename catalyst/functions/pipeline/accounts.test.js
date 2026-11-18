// Autopilot accounts: tenant isolation, sign-in links and Stripe plans. Run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { handle } = require("./handler");
const { memoryStore } = require("./store");
const { scoped } = require("./accounts");

const KEY = "test-pipeline-key-0123456789";
const WHSEC = "whsec_test_secret";
let clock = new Date("2026-11-18T15:00:00Z");

function call(deps, method, url, body, headers = {}) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  Object.assign(req, { method, url, headers: { "x-heurial-key": KEY, "content-type": "application/json", ...headers } });
  return new Promise((resolve) => {
    handle(req, {
      writeHead(status) { this.status = status; },
      end(payload) { resolve({ status: this.status, body: payload ? JSON.parse(payload) : null }); },
    }, deps);
  });
}

function setup() {
  const store = memoryStore({ Tenants: [], Users: [], LoginTokens: [] });
  const mail = [];
  const stripeCalls = [];
  const deps = {
    expectedKey: KEY, store, now: () => clock, timeZone: "America/Chicago",
    appUrl: "https://example.com/app",
    sendMail: async (m) => { mail.push(m); },
    stripe: {
      testMode: true, webhookSecret: WHSEC, prices: { starter: "price_s", pro: "price_p", business: "price_b" },
      api: async (path, params) => { stripeCalls.push({ path, params }); return { url: `https://stripe.test/${path}` }; },
    },
  };
  const tokenFrom = (m) => m.text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  return { store, mail, stripeCalls, deps, tokenFrom };
}

async function signedIn(s, business, email) {
  assert.equal((await call(s.deps, "POST", "/app/signup", { business, email })).status, 201);
  const v = await call(s.deps, "POST", "/app/verify", { token: s.tokenFrom(s.mail.at(-1)) });
  assert.equal(v.status, 200);
  return { "x-heurial-user": v.body.user.id, "x-heurial-tenant": v.body.tenant.id, tenant: v.body.tenant };
}

function stripeEvent(type, object, created) {
  const raw = JSON.stringify({ id: `evt_${created}`, type, created, data: { object } });
  const t = Math.floor(clock.getTime() / 1000);
  const sig = crypto.createHmac("sha256", WHSEC).update(`${t}.${raw}`).digest("hex");
  return { raw, headers: { "stripe-signature": `t=${t},v1=${sig}`, "x-heurial-key": "" } };
}

test("a scoped store never shows, changes or removes another business's rows", async () => {
  const store = memoryStore();
  const a = scoped(store, "1"), b = scoped(store, "2");
  const mine = await a.insert("Leads", { name: "A's lead", tenant_id: "2" }); // a forged tenant_id is overwritten
  assert.equal(mine.tenant_id, "1");
  await b.insert("Leads", { name: "B's lead" });
  assert.deepEqual((await a.list("Leads")).map((r) => r.name), ["A's lead"]);
  assert.equal(await b.get("Leads", mine.ROWID), null);
  await assert.rejects(b.update("Leads", { ROWID: mine.ROWID, name: "taken" }), /Not found/);
  await assert.rejects(b.remove("Leads", mine.ROWID), /Not found/);
  assert.equal((await store.get("Leads", mine.ROWID)).name, "A's lead");
  assert.throws(() => scoped(store, ""), /tenant id/);
});

test("sign-up emails a one-time link that expires", async () => {
  const s = setup();
  const res = await call(s.deps, "POST", "/app/signup", { business: "Whitfield Plumbing", email: " Dana@Example.com " });
  assert.equal(res.status, 201);
  assert.equal(s.mail.length, 1);
  assert.equal(s.mail[0].to, "dana@example.com");
  const token = s.tokenFrom(s.mail[0]);
  assert.ok(!JSON.stringify(s.store._tables.LoginTokens ? [...s.store._tables.LoginTokens.values()] : []).includes(token), "only a hash is stored");

  const ok = await call(s.deps, "POST", "/app/verify", { token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.tenant.name, "Whitfield Plumbing");
  assert.equal(ok.body.tenant.plan, "none");
  assert.equal(ok.body.user.role, "owner");
  assert.equal((await call(s.deps, "POST", "/app/verify", { token })).status, 401, "a link works once");

  await call(s.deps, "POST", "/app/login", { email: "dana@example.com" });
  const late = s.tokenFrom(s.mail.at(-1));
  clock = new Date(clock.getTime() + 16 * 60_000);
  assert.equal((await call(s.deps, "POST", "/app/verify", { token: late })).status, 401, "a link expires after 15 minutes");
  clock = new Date("2026-11-18T15:00:00Z");
});

test("sign-in doesn't reveal who has an account, and links are limited per address", async () => {
  const s = setup();
  assert.equal((await call(s.deps, "POST", "/app/login", { email: "nobody@example.com" })).status, 200);
  assert.equal(s.mail.length, 0);
  await call(s.deps, "POST", "/app/signup", { business: "Bell Fitness", email: "marcus@example.com" });
  const again = await call(s.deps, "POST", "/app/signup", { business: "Bell Fitness", email: "marcus@example.com" });
  assert.equal(again.status, 200, "signing up twice sends a link, not a second business");
  assert.equal(s.store._tables.Tenants.size, 1);
  for (let i = 0; i < 3; i++) await call(s.deps, "POST", "/app/login", { email: "marcus@example.com" });
  assert.equal((await call(s.deps, "POST", "/app/login", { email: "marcus@example.com" })).status, 429);
  assert.equal((await call(s.deps, "POST", "/app/login", { email: "bad" })).status, 400);
});

test("app routes need the site key and a user who belongs to the business", async () => {
  const s = setup();
  const a = await signedIn(s, "Business A", "a@example.com");
  const b = await signedIn(s, "Business B", "b@example.com");
  const who = (h) => ({ "x-heurial-user": h["x-heurial-user"], "x-heurial-tenant": h["x-heurial-tenant"] });
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, who(a))).body.tenant.name, "Business A");
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, { ...who(a), "x-heurial-tenant": b["x-heurial-tenant"] })).status, 401);
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, { ...who(a), "x-heurial-key": "wrong" })).status, 401);
  assert.equal((await call(s.deps, "GET", "/app/me")).status, 401);
});

test("Stripe sets the plan; the browser can't, and old or forged events are ignored", async () => {
  const s = setup();
  const a = await signedIn(s, "Haldane Roofing", "greg@example.com");
  const who = { "x-heurial-user": a["x-heurial-user"], "x-heurial-tenant": a["x-heurial-tenant"] };
  const tid = a["x-heurial-tenant"];

  const checkout = await call(s.deps, "POST", "/app/billing/checkout", { plan: "pro" }, who);
  assert.equal(checkout.status, 200);
  assert.equal(s.stripeCalls[0].params["line_items[0][price]"], "price_p");
  assert.equal(s.stripeCalls[0].params["subscription_data[metadata][tenant_id]"], tid);
  assert.equal((await call(s.deps, "POST", "/app/billing/checkout", { plan: "gold" }, who)).status, 400);
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant.plan, "none", "asking for a plan doesn't grant it");

  const sub = (status, price, created, extra = {}) => stripeEvent("customer.subscription.updated",
    { id: "sub_1", customer: "cus_1", status, metadata: { tenant_id: tid }, items: { data: [{ price: { id: price } }] }, ...extra }, created);

  const forged = sub("active", "price_b", 100);
  assert.equal((await call(s.deps, "POST", "/stripe/webhook", forged.raw, { ...forged.headers, "stripe-signature": "t=1,v1=00" })).status, 401);

  let e = sub("active", "price_p", 200);
  assert.equal((await call(s.deps, "POST", "/stripe/webhook", e.raw, e.headers)).status, 200);
  let me = (await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant;
  assert.equal(me.plan, "pro");
  assert.equal(me.subscribed, true);
  assert.equal((await call(s.deps, "POST", "/app/billing/checkout", { plan: "business" }, who)).status, 409);

  e = sub("active", "price_s", 150); // older than the last applied event
  await call(s.deps, "POST", "/stripe/webhook", e.raw, e.headers);
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant.plan, "pro");

  e = sub("past_due", "price_p", 300);
  await call(s.deps, "POST", "/stripe/webhook", e.raw, e.headers);
  me = (await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant;
  assert.deepEqual([me.plan, me.billing_status], ["pro", "paused"]);

  e = stripeEvent("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled", metadata: { tenant_id: tid }, items: { data: [] } }, 400);
  await call(s.deps, "POST", "/stripe/webhook", e.raw, e.headers);
  me = (await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant;
  assert.deepEqual([me.plan, me.subscribed], ["none", false]);

  e = sub("active", "price_b", 500, { customer: "cus_someone_else" });
  await call(s.deps, "POST", "/stripe/webhook", e.raw, e.headers);
  assert.equal((await call(s.deps, "GET", "/app/me", undefined, who)).body.tenant.plan, "none", "another customer's subscription can't change this business");

  const portal = await call(s.deps, "POST", "/app/billing/portal", undefined, who);
  assert.equal(portal.status, 200);
  assert.equal(s.stripeCalls.at(-1).params.customer, "cus_1");
});
