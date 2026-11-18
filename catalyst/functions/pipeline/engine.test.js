// The Autopilot engine: events, the Outbox and the tick. Run with: node --test   (from this folder)
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../../public/autopilot/core.js");
const { memoryStore } = require("./store");
const { createEngine, milestones, MAX_ATTEMPTS } = require("./engine");

const local = (time) => new Date(`2026-11-18T${time}`); // local time, as the business-hours rule reads it
const BEN = { ROWID: "7", first_name: "Ben", phone: "+15550100" };

function setup({ at = "10:00", enabled = ["missed-call"], plan = "starter", send, check, ctx = {} } = {}) {
  const clock = { now: local(at) };
  const sent = [];
  const store = memoryStore({ Events: [], Outbox: [], Contacts: [BEN] });
  const engine = createEngine({
    core, check, now: () => clock.now,
    send: send || (async (row) => { sent.push(row); return { id: `SM${sent.length}` }; }),
  });
  const context = {
    tenant: "t1", plan, used: 0, settings: {}, hours: { open: "08:00", close: "20:00" },
    enabled: Object.fromEntries(enabled.map((id) => [id, true])), vars: { business: "Ace Plumbing" }, ...ctx,
  };
  const missedCall = (key = "call-1", contact = BEN) => engine.ingest(store, context, { trigger: "missed_call", contact, dedupeKey: key });
  const outbox = () => store.list("Outbox");
  const later = (minutes) => { clock.now = new Date(clock.now.getTime() + minutes * 60000); };
  return { engine, store, ctx: context, sent, missedCall, outbox, later };
}

test("a missed call becomes one text, sent once", async () => {
  const t = await setup();
  await t.missedCall();
  assert.equal((await t.outbox())[0].status, "queued");
  assert.equal(t.sent.length, 0); // nothing leaves until the tick
  assert.deepEqual(await t.engine.tick(t.store, t.ctx), { sent: 1, retried: 0, failed: 0, skipped: 0, held: 0 });
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 1);
  assert.equal(t.sent[0].body, "Hi Ben, sorry I missed your call. This is Ace Plumbing. What can I help with?");
  const [row] = await t.outbox();
  assert.equal(row.status, "sent");
  assert.equal(row.provider_id, "SM1");
});

test("a webhook delivered twice, even at the same moment, runs once", async () => {
  const t = await setup();
  const [a, b] = await Promise.all([t.missedCall(), t.missedCall()]);
  assert.deepEqual([a.duplicate, b.duplicate].sort(), [false, true]);
  assert.equal((await t.store.list("Events")).length, 1);
  assert.equal((await t.outbox()).length, 1);
});

test("off and locked automations write nothing", async () => {
  const t = await setup({ enabled: ["quote-followup"] }); // a Pro automation on a Starter plan
  await t.engine.ingest(t.store, t.ctx, { trigger: "proposal_quiet", contact: BEN, dedupeKey: "q1" });
  await t.missedCall();
  assert.equal((await t.outbox()).length, 0);
});

test("a text triggered after hours waits for opening time", async () => {
  const t = await setup({ at: "22:30" });
  await t.missedCall();
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 0);
  t.later(10 * 60); // 08:30 the next morning
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 1);
});

test("an AI message waits for approval, and can only be approved once", async () => {
  const t = await setup({ plan: "pro", enabled: ["quote-followup"] });
  const { rows } = await t.engine.ingest(t.store, t.ctx, { trigger: "proposal_quiet", contact: BEN, dedupeKey: "q1" });
  assert.equal(rows[0].status, "approval");
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 0);
  await assert.rejects(t.engine.decide(t.store, t.ctx, rows[0].ROWID, { approve: true }), /Write the message first/);
  const results = await Promise.allSettled([1, 2].map(() => t.engine.decide(t.store, t.ctx, rows[0].ROWID, { approve: true, body: "Hi Ben, any questions on the quote?" })));
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 1);
  assert.equal(t.sent[0].body, "Hi Ben, any questions on the quote?");
});

test("a rejected message is never sent", async () => {
  const t = await setup({ plan: "pro", enabled: ["quote-followup"] });
  const { rows } = await t.engine.ingest(t.store, t.ctx, { trigger: "proposal_quiet", contact: BEN, dedupeKey: "q1" });
  await t.engine.decide(t.store, t.ctx, rows[0].ROWID, { approve: false });
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 0);
  assert.equal((await t.outbox())[0].reason, "Rejected");
});

test("a message with a blank left in it goes to the owner instead of out", async () => {
  const t = await setup();
  const { rows } = await t.missedCall("call-2", { ROWID: "8", phone: "+15550111" }); // caller with no name
  assert.equal(rows[0].status, "approval");
  assert.equal(rows[0].reason, "Fill in: first_name");
  await assert.rejects(t.engine.decide(t.store, t.ctx, rows[0].ROWID, { approve: true }), /Fill in the blanks/);
  await t.engine.decide(t.store, t.ctx, rows[0].ROWID, { approve: true, body: "Hi, sorry I missed your call." });
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 1);
});

test("someone who opts out is not texted, even if the text was already queued", async () => {
  const t = await setup();
  await t.missedCall();
  await t.store.update("Contacts", { ROWID: "7", opted_out_at: "2026-11-18T10:01:00Z" });
  assert.equal((await t.engine.tick(t.store, t.ctx)).skipped, 1);
  const { rows } = await t.missedCall("call-2", await t.store.get("Contacts", "7"));
  assert.equal(rows[0].status, "skipped");
  assert.equal(t.sent.length, 0);
});

test("a failed send is retried later, then given up on", async () => {
  let calls = 0;
  const t = await setup({ send: async () => { calls++; throw new Error("Twilio is down"); } });
  await t.missedCall();
  assert.equal((await t.engine.tick(t.store, t.ctx)).retried, 1);
  await t.engine.tick(t.store, t.ctx); // too soon: not tried again yet
  assert.equal(calls, 1);
  for (let i = 1; i < MAX_ATTEMPTS; i++) { t.later(121); await t.engine.tick(t.store, t.ctx); }
  t.later(121);
  await t.engine.tick(t.store, t.ctx);
  assert.equal(calls, MAX_ATTEMPTS);
  const [row] = await t.outbox();
  assert.equal(row.status, "failed");
  assert.equal(row.error, "Twilio is down");
});

test("a send with an unknown outcome is never sent again blindly", async () => {
  let calls = 0;
  const timeout = async () => { calls++; throw Object.assign(new Error("timed out"), { uncertain: true }); };
  const lost = await setup({ send: timeout });
  await lost.missedCall();
  await lost.engine.tick(lost.store, lost.ctx);
  lost.later(30);
  await lost.engine.tick(lost.store, lost.ctx);
  assert.equal(calls, 1);
  assert.equal((await lost.outbox())[0].status, "failed");
  assert.match((await lost.outbox())[0].error, /can't tell/);

  calls = 0;
  const found = await setup({ send: timeout, check: async () => "sent" });
  await found.missedCall();
  await found.engine.tick(found.store, found.ctx);
  found.later(30);
  await found.engine.tick(found.store, found.ctx);
  assert.equal(calls, 1);
  assert.equal((await found.outbox())[0].status, "sent");
});

test("the hourly text limit holds the rest for later", async () => {
  const t = await setup({ ctx: { textsPerHour: 2 } });
  for (const n of [1, 2, 3]) await t.missedCall(`call-${n}`);
  assert.equal((await t.engine.tick(t.store, t.ctx)).held, 1);
  assert.equal(t.sent.length, 2);
  t.later(61);
  await t.engine.tick(t.store, t.ctx);
  assert.equal(t.sent.length, 3);
});

test("day marks fire once each, and old records don't all fire on the first run", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const daysAgo = (n) => new Date(now - n * 86400000).toISOString();
  const items = [{ id: "a", since: daysAgo(1) }, { id: "b", since: daysAgo(2.5) }, { id: "c", since: daysAgo(6) }, { id: "d", since: daysAgo(100) }];
  const events = milestones("proposal_quiet", items, [2, 5, 10], now);
  assert.deepEqual(events.map((e) => [e.dedupeKey.split(":")[1], e.payload.day]), [["b", 2], ["c", 5]]);
  assert.equal(milestones("proposal_quiet", items, [2, 5, 10], now + 3600000)[0].dedupeKey, events[0].dedupeKey);
});
