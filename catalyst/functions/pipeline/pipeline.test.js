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

function inbound(deps, body, key) {
  const raw = JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]);
  Object.assign(req, { method: "POST", url: "/inbound", headers: key ? { "x-heurial-inbound-key": key } : {} });
  return new Promise((resolve) => {
    const res = {
      writeHead(status) { this.status = status; },
      end(payload) { resolve({ status: this.status, body: payload ? JSON.parse(payload) : null }); },
    };
    handle(req, res, deps);
  });
}

test("messages: log, send through a connected service, and delete with the lead", async () => {
  const { deps, store } = setup();
  const delivered = [];
  deps.sendMessage = { email: async (m) => { delivered.push(m); } };
  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Thread Co", email: "owner@thread.example", phone: "(555) 010-2030" });
  assert.equal((await call(deps, "GET", `/leads/${id}`)).body.phone, "(555) 010-2030");

  assert.equal((await call(deps, "POST", "/messages", { lead_id: id, body: "  " })).status, 400);
  assert.equal((await call(deps, "POST", "/messages", { lead_id: "999", body: "Hi" })).status, 404);
  const note = await call(deps, "POST", "/messages", { lead_id: id, channel: "note", direction: "in", body: "Prefers mornings" });
  assert.equal(note.status, 201);
  assert.equal(note.body.status, "logged"); // a note is always your own
  assert.equal((await call(deps, "POST", "/messages", { lead_id: id, channel: "call", direction: "in", body: "They called back" })).body.status, "received");

  const sent = await call(deps, "POST", "/messages", { lead_id: id, channel: "email", subject: "Next step", body: "Here is the plan.", send: true });
  assert.equal(sent.body.status, "sent");
  assert.deepEqual(delivered.map((m) => [m.to, m.subject]), [["owner@thread.example", "Next step"]]);

  // Texts aren't connected here: sending is refused, logging still works.
  assert.equal((await call(deps, "POST", "/messages", { lead_id: id, channel: "sms", body: "On my way", send: true })).status, 503);
  assert.equal((await call(deps, "POST", "/messages", { lead_id: id, channel: "sms", body: "On my way" })).body.status, "logged");
  // A failed delivery saves nothing.
  deps.sendMessage.email = async () => { throw new Error("mail down"); };
  assert.equal((await call(deps, "POST", "/messages", { lead_id: id, channel: "email", body: "Lost", send: true })).status, 502);

  const thread = await call(deps, "GET", `/leads/${id}/messages`);
  assert.deepEqual(thread.body.map((x) => x.channel), ["note", "call", "email", "sms"]);
  const data = await call(deps, "GET", "/data?range=30");
  assert.equal(data.body.messages.length, 4);
  assert.equal(data.body.messages[0].lead_name, "Thread Co");
  assert.deepEqual(data.body.services, { messages: true, digest: true, email: true, sms: false, inbound: false, twilio: false, ai: false, push: false });

  await call(deps, "DELETE", `/messages/${thread.body[0].id}`);
  assert.equal((await call(deps, "GET", `/leads/${id}/messages`)).body.length, 3);
  await call(deps, "DELETE", `/leads/${id}`);
  assert.equal((await store.list("Messages")).length, 0);
});

test("inbound: needs its own key, and matches a lead by email or phone", async () => {
  const { deps } = setup();
  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Reply Co", email: "Pat@Reply.example", phone: "+1 (555) 010-7788" });
  assert.equal((await inbound(deps, { from: "pat@reply.example", body: "Yes" }, "anything")).status, 401); // not set up
  deps.inboundKey = "inbound-key-0123456789";
  assert.equal((await inbound(deps, { from: "pat@reply.example", body: "Yes" }, KEY)).status, 401); // the site's key is not accepted here
  assert.equal((await inbound(deps, { from: "", body: "Yes" }, deps.inboundKey)).status, 400);

  const email = await inbound(deps, { channel: "email", from: "Pat <pat@reply.example>", subject: "Re: plan", body: "Sounds good." }, deps.inboundKey);
  assert.deepEqual(email.body, { ok: true, matched: true });
  const text = await inbound(deps, { channel: "sms", from: "5550107788", body: "Running late" }, deps.inboundKey);
  assert.equal(text.body.matched, true);
  const stranger = await inbound(deps, { from: "nobody@else.example", body: "Hello?" }, deps.inboundKey);
  assert.equal(stranger.body.matched, false);

  const thread = (await call(deps, "GET", `/leads/${id}/messages`)).body;
  assert.deepEqual(thread.map((x) => [x.channel, x.direction, x.status]), [["email", "in", "received"], ["sms", "in", "received"]]);
  const data = (await call(deps, "GET", "/data?range=30")).body;
  assert.equal(data.messages.filter((x) => !x.lead_id).length, 1); // the stranger's message is kept, unmatched
  assert.equal(data.services.inbound, true);
});

test("works before the Messages table exists, and with a Leads table that has no phone column", async () => {
  const { deps, store } = setup();
  const list = store.list.bind(store);
  store.list = async (table) => { if (table === "Messages") throw new Error("table not found"); return list(table); };
  const insert = store.insert.bind(store);
  store.insert = async (table, row) => { if (table === "Leads" && "phone" in row) throw new Error("no such column: phone"); return insert(table, row); };

  const made = await call(deps, "POST", "/leads", { name: "Early Co" });
  assert.equal(made.status, 201);
  assert.equal((await call(deps, "PATCH", `/leads/${made.body.id}`, { name: "Early Co", phone: "" })).status, 200);
  const data = await call(deps, "GET", "/data?range=30");
  assert.equal(data.status, 200);
  assert.deepEqual(data.body.messages, []);
  assert.equal(data.body.services.messages, false);
  assert.equal((await call(deps, "POST", "/messages", { lead_id: made.body.id, body: "Note" })).status, 503);
  assert.equal((await call(deps, "DELETE", `/leads/${made.body.id}`)).status, 200);
});

test("paid date: stamped when a lead becomes paid, editable, and cleared when it leaves paid", async () => {
  const { deps } = setup({ Leads: [{ ROWID: "7", name: "Older Co", status: "paid", booked_at: "2026-10-01", value_cents: 49500 }] });
  const paidAt = async (id) => (await call(deps, "GET", `/leads/${id}`)).body.paid_at;
  const patch = (id, body) => call(deps, "PATCH", `/leads/${id}`, body);

  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Pay Co", booked_at: "2026-10-20", value: 495 });
  assert.equal(await paidAt(id), "");
  assert.deepEqual((await patch(id, { status: "paid" })).body, { ok: true });
  assert.equal(await paidAt(id), "2026-11-11"); // today in Chicago, not the booked date

  assert.equal((await patch(id, { paid_at: "2026-11-03" })).status, 200);
  assert.equal(await paidAt(id), "2026-11-03");
  await patch(id, { notes: "Paid by card" }); // other edits leave it alone
  assert.equal(await paidAt(id), "2026-11-03");
  assert.equal((await patch(id, { paid_at: "11/03/2026" })).body.error, "Paid date must be YYYY-MM-DD.");

  await patch(id, { status: "proposal" }); // no longer paid: no paid date
  assert.equal(await paidAt(id), "");
  await patch(id, { status: "paid", paid_at: "2026-11-05" }); // paid again, with the day given
  assert.equal(await paidAt(id), "2026-11-05");
  await patch(id, { status: "paid", paid_at: "" }); // emptied on purpose
  assert.equal(await paidAt(id), "");

  // A lead that was paid before paid dates existed isn't stamped by an unrelated save.
  await patch("7", { status: "paid", paid_at: "", notes: "Sent the guide" });
  assert.equal(await paidAt("7"), "");

  // New leads: paid ones get today or the day given; a paid date on an unpaid lead is dropped.
  const made = async (body) => paidAt((await call(deps, "POST", "/leads", { name: "New Co", ...body })).body.id);
  assert.equal(await made({ status: "paid" }), "2026-11-11");
  assert.equal(await made({ status: "paid", paid_at: "2026-10-30" }), "2026-10-30");
  assert.equal(await made({ status: "booked", paid_at: "2026-10-30" }), "");
});

test("a Leads table with no paid_at column still saves the lead, and the reply says the date was left out", async () => {
  const { deps, store } = setup();
  for (const op of ["insert", "update"]) {
    const real = store[op].bind(store);
    store[op] = async (table, row) => { if (table === "Leads" && "paid_at" in row) throw new Error("Invalid input value for column name"); return real(table, row); };
  }
  const made = await call(deps, "POST", "/leads", { name: "Early Co", status: "paid", value: 295 });
  assert.equal(made.status, 201);
  assert.equal(made.body.paid_at_saved, false);
  const { id } = (await call(deps, "POST", "/leads", { name: "Later Co" })).body;
  assert.deepEqual((await call(deps, "PATCH", `/leads/${id}`, { status: "paid", value: 495 })).body, { ok: true, paid_at_saved: false });
  const lead = (await call(deps, "GET", `/leads/${id}`)).body;
  assert.deepEqual([lead.status, lead.value_cents, lead.paid_at], ["paid", 49500, ""]);
  // Nothing about the paid date is written when it doesn't change, so every other save is untouched.
  assert.deepEqual((await call(deps, "PATCH", `/leads/${id}`, { status: "paid", paid_at: "", notes: "Thanks sent" })).body, { ok: true });
  assert.deepEqual((await call(deps, "PATCH", `/leads/${id}`, { status: "lost" })).body, { ok: true });
  assert.equal((await call(deps, "GET", "/data?range=30")).body.summary.revenue_cents, 29500);
});
