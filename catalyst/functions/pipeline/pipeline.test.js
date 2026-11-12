// Run with: node --test   (from this folder). Uses the in-memory store; no Catalyst access needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { handle } = require("./handler");
const { memoryStore } = require("./store");
const core = require("./core");

const KEY = "test-pipeline-key-0123456789";
const NOW = () => new Date("2026-11-11T15:00:00Z"); // 9am in Chicago

function call(deps, method, url, body, key = KEY) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  Object.assign(req, { method, url, headers: key ? { "x-heurial-key": key } : {} });
  return new Promise((resolve) => {
    const res = {
      writeHead(status) { this.status = status; },
      end(payload) { resolve({ status: this.status, body: payload ? JSON.parse(payload) : null }); },
    };
    handle(req, res, deps);
  });
}

function setup(seed = {}) {
  const store = memoryStore(seed);
  const sent = [];
  const deps = {
    expectedKey: KEY, store, now: NOW, timeZone: "America/Chicago", digestTo: "owner@example.com",
    trackerUrl: "https://example.com/admin",
    sendMail: async (m) => { sent.push(m); },
  };
  return { store, sent, deps };
}

test("rejects missing and wrong keys", async () => {
  const { deps } = setup();
  assert.equal((await call(deps, "GET", "/data", undefined, "")).status, 401);
  assert.equal((await call(deps, "GET", "/data", undefined, "wrong")).status, 401);
  assert.equal((await call({ ...deps, expectedKey: "" }, "GET", "/data")).status, 401);
});

test("creates, reads, updates and deletes a lead with string IDs beyond 2^53", async () => {
  const { deps } = setup();
  const created = await call(deps, "POST", "/leads", { name: "Dana", source: "Referral", status: "paid", value: 495 });
  assert.equal(created.status, 201);
  assert.match(created.body.id, /^\d{18}$/);
  assert.ok(BigInt(created.body.id) > BigInt(Number.MAX_SAFE_INTEGER));

  const got = await call(deps, "GET", `/leads/${created.body.id}`);
  assert.equal(got.body.id, created.body.id);
  assert.equal(got.body.value_cents, 49500);
  assert.equal(got.body.booked_at, "2026-11-11"); // today in Chicago

  assert.equal((await call(deps, "PATCH", `/leads/${created.body.id}`, { follow_up_at: "2026-11-12", follow_up_note: "Ask for testimonial" })).status, 200);
  const data = await call(deps, "GET", "/data?range=30");
  assert.equal(data.body.followups[0].id, created.body.id);
  assert.equal(data.body.summary.revenue_cents, 49500);

  assert.equal((await call(deps, "DELETE", `/leads/${created.body.id}`)).status, 200);
  assert.equal((await call(deps, "GET", `/leads/${created.body.id}`)).status, 404);
});

test("validates input", async () => {
  const { deps } = setup();
  assert.equal((await call(deps, "POST", "/leads", { name: "" })).body.error, "Name is required.");
  assert.equal((await call(deps, "POST", "/leads", { name: "x", status: "hacked" })).status, 400);
  assert.equal((await call(deps, "POST", "/leads", { name: "x", value: -5 })).status, 400);
  assert.equal((await call(deps, "POST", "/leads", { name: "x", booked_at: "11/11/2026" })).status, 400);
  assert.equal((await call(deps, "GET", "/data?range=13")).status, 400);
  assert.equal((await call(deps, "PATCH", "/leads/123", { name: "x" })).status, 404);
  assert.equal((await call(deps, "GET", "/nope")).status, 404);
});

test("logs time, totals it per lead, and deletes time with the lead", async () => {
  const { deps, store } = setup();
  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Hours Co", status: "paid", value: 1200 });
  assert.equal((await call(deps, "POST", "/time", { lead_id: id, hours: 2.5, note: "Build" })).status, 201);
  assert.equal((await call(deps, "POST", "/time", { lead_id: id, hours: 1, note: "Call" })).status, 201);
  assert.equal((await call(deps, "POST", "/time", { lead_id: id, hours: 30 })).status, 400);
  assert.equal((await call(deps, "POST", "/time", { lead_id: "999", hours: 1 })).status, 404);
  const entries = await call(deps, "GET", `/leads/${id}/time`);
  assert.equal(entries.body.length, 2);
  const data = await call(deps, "GET", "/data?range=30");
  assert.equal(data.body.leads[0].hours, 3.5);
  // The dashboard data lists every time entry with its lead's name, for the Time page.
  assert.equal(data.body.time.length, 2);
  assert.deepEqual(data.body.time.map((t) => t.hours).sort(), [1, 2.5]);
  assert.equal(data.body.time[0].lead_name, "Hours Co");
  assert.equal(data.body.time[0].lead_id, id);
  await call(deps, "DELETE", `/time/${entries.body[0].id}`);
  assert.equal((await call(deps, "GET", `/leads/${id}/time`)).body.length, 1);
  await call(deps, "DELETE", `/leads/${id}`);
  assert.equal((await store.list("TimeEntries")).length, 0);
});

test("inbox: converts an inquiry into a lead once, and dismisses another", async () => {
  const { deps, store } = setup({
    Inquiries: [
      { inquiry_id: "11111111-1111-4111-8111-111111111111", created_at: "2026-11-10T20:00:00.000Z", name: "Ivy", email: "ivy@example.com",
        company: "Ivy Salon", message: "DMs pile up.", source: "Instagram", source_detail: "tracking link ?src=instagram", status: "new" },
      { inquiry_id: "22222222-2222-4222-8222-222222222222", created_at: "2026-11-11T01:00:00.000Z", name: "Spam", email: "s@example.com",
        company: "", message: "Buy now buy now", source: "Direct", source_detail: "", status: "new" },
    ],
  });
  let data = (await call(deps, "GET", "/data?range=30")).body;
  assert.equal(data.inbox.length, 2);
  assert.equal(data.inbox[0].name, "Ivy");

  const conv = await call(deps, "POST", `/inbox/${data.inbox[0].id}/convert`);
  assert.equal(conv.status, 200);
  const lead = (await call(deps, "GET", `/leads/${conv.body.leadId}`)).body;
  assert.equal(lead.source, "Instagram");
  assert.equal(lead.business, "Ivy Salon");
  assert.equal(lead.follow_up_at, "2026-11-11");
  assert.match(lead.notes, /DMs pile up/);

  assert.equal((await call(deps, "POST", `/inbox/${data.inbox[0].id}/convert`)).status, 409); // no duplicates
  assert.equal((await call(deps, "POST", `/inbox/${data.inbox[1].id}/dismiss`)).status, 200);
  data = (await call(deps, "GET", "/data?range=30")).body;
  assert.equal(data.inbox.length, 0);
  assert.equal((await store.list("Leads")).length, 1);
});

test("daily email: preview, send, and not-configured", async () => {
  const { deps, sent } = setup({
    Inquiries: [{ inquiry_id: "x", created_at: "2026-11-11T01:00:00.000Z", name: "New Person", company: "", source: "Search", status: "new" }],
    Leads: [
      { name: "Late Lou", status: "proposal", booked_at: "2026-11-01", follow_up_at: "2026-11-08", follow_up_note: "Check proposal", value_cents: 0 },
      { name: "Today Tia", status: "held", booked_at: "2026-11-05", follow_up_at: "2026-11-11", follow_up_note: "Send scope", value_cents: 0 },
      { name: "Stale Sam", status: "booked", booked_at: "2026-11-03", call_at: "2026-11-09", value_cents: 0 },
      { name: "Soon Sue", status: "held", booked_at: "2026-11-06", follow_up_at: "2026-11-14", value_cents: 0 },
      { name: "<script>alert(1)</script>", status: "booked", booked_at: "2026-11-10", follow_up_at: "2026-11-11", value_cents: 0 },
    ],
  });
  const preview = await call(deps, "POST", "/digest?preview=1");
  assert.equal(preview.status, 200);
  assert.equal(preview.body.sent, false);
  assert.equal(preview.body.urgent, 5); // 1 inquiry + 1 stale + 1 overdue + 2 due today
  assert.match(preview.body.subject, /5 things need you today/);
  for (const name of ["New Person", "Stale Sam", "Late Lou", "Today Tia", "Soon Sue"]) assert.match(preview.body.text, new RegExp(name));
  assert.doesNotMatch(preview.body.html, /<script>/); // names are escaped in the HTML email
  assert.equal(sent.length, 0);

  const real = await call(deps, "POST", "/digest");
  assert.equal(real.body.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "owner@example.com");

  assert.equal((await call({ ...deps, sendMail: undefined }, "POST", "/digest")).status, 503);
});

test("summary math matches the local tracker", () => {
  const leadRows = [
    { ROWID: "1", name: "A", status: "paid", booked_at: "2026-11-01", value_cents: "100000", source: "Referral" },
    { ROWID: "2", name: "B", status: "lost", booked_at: "2026-11-02", value_cents: "0", source: "Referral" },
    { ROWID: "3", name: "C", status: "no_show", booked_at: "2026-11-03", value_cents: "0", source: "Instagram" },
    { ROWID: "4", name: "D", status: "booked", booked_at: "2026-09-01", value_cents: "0", source: "Instagram" },
  ];
  const timeRows = [{ ROWID: "9", lead_id: "1", hours: "10" }];
  const d = core.summarize({ leadRows, timeRows, range: "30", today: "2026-11-11" });
  assert.deepEqual(d.summary, { booked: 3, held: 2, paid: 1, revenue_cents: 100000, hours: 10 });
  assert.equal(d.sources[0].source, "Referral");
  assert.equal(d.weekly.length, 12);
  assert.equal(d.previous.booked, 0);
});
