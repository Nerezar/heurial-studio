// Autopilot routes: the engine behind accounts, through the real request handler. Run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { handle } = require("./handler");
const { memoryStore } = require("./store");

const KEY = "test-pipeline-key-0123456789";

function setup({ at = "2026-11-18T15:00:00Z" } = {}) { // 9am in Chicago
  const clock = { now: new Date(at) };
  const texts = [], emails = [];
  const tenant = (ROWID, name, extra = {}) => ({ ROWID, name, plan: "starter", billing_status: "active", time_zone: "America/Chicago", ...extra });
  const store = memoryStore({
    Tenants: [tenant("1", "Ace Plumbing"), tenant("2", "Bolt Electric"), tenant("3", "Unpaid Co", { plan: "none", billing_status: "" })],
    Users: [{ ROWID: "11", tenant_id: "1", email: "ann@ace.test", role: "owner" }, { ROWID: "12", tenant_id: "2", email: "bo@bolt.test", role: "owner" }, { ROWID: "13", tenant_id: "3", email: "cy@unpaid.test", role: "owner" }],
    Contacts: [{ ROWID: "21", tenant_id: "1", first_name: "Ben", phone: "+15550101" }, { ROWID: "22", tenant_id: "2", first_name: "Dee", phone: "+15550102" }],
    AutomationSettings: [], Events: [], Outbox: [],
  });
  const deps = {
    expectedKey: KEY, store, now: () => clock.now,
    sendMessage: { sms: async (m) => { texts.push(m); }, email: async (m) => { emails.push(m); } },
  };
  const call = (method, url, body, headers = {}) => {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const req = Readable.from(raw ? [Buffer.from(raw)] : []);
    Object.assign(req, { method, url, headers: { "x-heurial-key": KEY, "content-type": "application/json", ...headers } });
    return new Promise((resolve) => {
      handle(req, { writeHead(status) { this.status = status; }, end(payload) { resolve({ status: this.status, body: payload ? JSON.parse(payload) : null }); } }, deps);
    });
  };
  const as = (n) => ({ "x-heurial-user": `1${n}`, "x-heurial-tenant": String(n) }); // the owner of business n
  const missedCall = (tenant_id, contact_id, dedupe_key = "call-1") => call("POST", "/autopilot/events", { tenant_id, trigger: "missed_call", contact_id, dedupe_key });
  return { store, texts, emails, call, as, missedCall, clock };
}

test("the function's copy of the rules matches the browser's", () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, p), "utf8");
  assert.equal(read("autopilot-core.js"), read("../../../public/autopilot/core.js"));
});

test("a missed call for one business texts its caller, and only that business sees it", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/app/autopilot/settings/missed-call", { on: true }, t.as(1))).status, 200);
  assert.equal((await t.call("POST", "/app/autopilot/settings/missed-call", { on: true }, t.as(2))).status, 200);
  assert.equal((await t.missedCall("1", "21")).status, 201);
  assert.equal((await t.missedCall("1", "21")).body.duplicate, true); // the webhook retried
  const tick = await t.call("POST", "/autopilot/tick");
  assert.equal(tick.body.sent, 1);
  assert.equal(tick.body.businesses, 2); // the unpaid one is skipped
  assert.deepEqual(t.texts, [{ to: "+15550101", body: "Hi Ben, sorry I missed your call. This is Ace Plumbing. What can I help with?" }]);
  const mine = await t.call("GET", "/app/autopilot/outbox", undefined, t.as(1));
  assert.deepEqual(mine.body.outbox.map((r) => [r.automation, r.status]), [["missed-call", "sent"]]);
  assert.deepEqual((await t.call("GET", "/app/autopilot/outbox", undefined, t.as(2))).body.outbox, []);
});

test("one business can't use, approve or change another's", async () => {
  const t = setup();
  await t.call("POST", "/app/autopilot/settings/missed-call", { on: true }, t.as(1));
  assert.equal((await t.missedCall("2", "21")).status, 404); // business 2 with business 1's contact
  // A caller with no name leaves a blank, so the text waits for business 1's approval.
  await t.store.insert("Contacts", { tenant_id: "1", phone: "+15550109" });
  const nameless = (await t.store.list("Contacts")).find((c) => c.phone === "+15550109");
  const { body } = await t.missedCall("1", nameless.ROWID, "call-2");
  assert.equal(body.outbox[0].status, "approval");
  const decide = (who) => t.call("POST", `/app/autopilot/outbox/${body.outbox[0].id}/decide`, { approve: true, body: "Hi, sorry I missed you." }, t.as(who));
  assert.equal((await decide(2)).status, 404);
  assert.equal((await decide(1)).status, 200);
  assert.equal((await decide(1)).status, 409);
  const theirs = await t.call("GET", "/app/autopilot/settings", undefined, t.as(2));
  assert.equal(theirs.body.automations.find((a) => a.id === "missed-call").on, false);
  await t.call("POST", "/autopilot/tick");
  assert.deepEqual(t.texts.map((m) => m.to), ["+15550109"]);
});

test("these routes need the site key, and the customer ones a signed-in owner", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/autopilot/tick", undefined, { "x-heurial-key": "wrong" })).status, 401);
  assert.equal((await t.call("POST", "/autopilot/events", {}, { "x-heurial-key": "wrong" })).status, 401);
  assert.equal((await t.call("GET", "/app/autopilot/outbox")).status, 401);
  assert.equal((await t.call("GET", "/app/autopilot/outbox", undefined, { "x-heurial-user": "11", "x-heurial-tenant": "2" })).status, 401);
});

test("a plan only turns on what it includes, and an unpaid business is paused", async () => {
  const t = setup();
  const locked = await t.call("POST", "/app/autopilot/settings/quote-followup", { on: true }, t.as(1));
  assert.equal(locked.status, 403);
  assert.match(locked.body.error, /Pro plan/);
  assert.equal((await t.call("POST", "/app/autopilot/settings/missed-call", { on: true }, t.as(3))).status, 403);
  assert.deepEqual((await t.missedCall("3")).body, { paused: true, outbox: [] });
  assert.equal((await t.call("GET", "/app/autopilot/settings", undefined, t.as(3))).body.paused, true);
});

test("the owner's own wording is used, and approve-first holds a message back", async () => {
  const t = setup();
  await t.call("POST", "/app/autopilot/settings/missed-call", { on: true, approve: true, message: "Hey {first_name}, {business} here. Call you back shortly." }, t.as(1));
  const { body } = await t.missedCall("1", "21");
  assert.equal(body.outbox[0].status, "approval");
  assert.equal(body.outbox[0].body, "Hey Ben, Ace Plumbing here. Call you back shortly.");
  await t.call("POST", "/autopilot/tick");
  assert.equal(t.texts.length, 0);
});

test("business hours follow the business's time zone, not the server's", async () => {
  const t = setup({ at: "2026-11-19T03:00:00Z" }); // 9pm in Chicago, after closing
  await t.call("POST", "/app/autopilot/settings/missed-call", { on: true }, t.as(1));
  const { body } = await t.missedCall("1", "21");
  assert.equal(body.outbox[0].send_at, "2026-11-19T14:00:00.000Z"); // 8am in Chicago
  await t.call("POST", "/autopilot/tick");
  assert.equal(t.texts.length, 0);
  t.clock.now = new Date("2026-11-19T14:05:00Z");
  await t.call("POST", "/autopilot/tick");
  assert.equal(t.texts.length, 1);
});
