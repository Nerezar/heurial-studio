// Regression tests for the reliability pass: each one reproduces a bug that was found, then holds the fix.
// Run with: node --test   (from this folder)
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { handle } = require("./handler");
const { memoryStore } = require("./store");
const core = require("./core");

const KEY = "test-pipeline-key-0123456789";
const NOW = () => new Date("2026-11-11T15:00:00Z"); // 9am in Chicago: today is 2026-11-11

function call(deps, method, url, body) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  Object.assign(req, { method, url, headers: { "x-heurial-key": KEY } });
  return new Promise((resolve) => {
    const res = { writeHead(status) { this.status = status; }, end(payload) { resolve({ status: this.status, body: payload ? JSON.parse(payload) : null }); } };
    handle(req, res, deps);
  });
}
function setup(seed = {}) {
  const store = memoryStore({ Leads: [], Messages: [], Transactions: [], Tasks: [], Inquiries: [], TimeEntries: [], ...seed });
  return { store, deps: { expectedKey: KEY, store, now: NOW, timeZone: "America/Chicago" } };
}
const slow = (ms) => new Promise((r) => setTimeout(r, ms));

test("two approvals of one draft at the same moment send it once", async () => {
  const { deps, store } = setup({ Leads: [{ ROWID: "1", name: "Ben", email: "ben@example.com" }], Messages: [{ ROWID: "5", lead_id: "1", direction: "out", channel: "email", subject: "Hi", body: "Draft", status: "draft" }] });
  const delivered = [];
  deps.sendMessage = { email: async (m) => { await slow(15); delivered.push(m); } };
  const [a, b] = await Promise.all([call(deps, "POST", "/messages/5/approve", { send: true }), call(deps, "POST", "/messages/5/approve", { send: true })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(delivered.length, 1);
  assert.equal((await store.get("Messages", "5")).status, "sent");
});

test("two conversions of one inquiry at the same moment make one lead", async () => {
  const { deps, store } = setup({ Inquiries: [{ ROWID: "9", inquiry_id: "abc-1", name: "Ivy", status: "new", message: "Help" }] });
  const [a, b] = await Promise.all([call(deps, "POST", "/inbox/9/convert"), call(deps, "POST", "/inbox/9/convert")]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await store.list("Leads")).length, 1);
});

test("a conversion that stopped half way is finished, not repeated", async () => {
  // The lead was added, then the request died before the inquiry was marked.
  const { deps, store } = setup({ Inquiries: [{ ROWID: "9", inquiry_id: "abc-1", name: "Ivy", status: "new" }], Leads: [{ ROWID: "3", name: "Ivy", inquiry_id: "abc-1" }] });
  const r = await call(deps, "POST", "/inbox/9/convert");
  assert.deepEqual([r.status, r.body.leadId], [200, "3"]);
  assert.equal((await store.list("Leads")).length, 1);
  assert.equal((await store.get("Inquiries", "9")).status, "converted");
});

test("a lead added by another copy of the function for the same inquiry is not kept twice", async () => {
  const { deps, store } = setup({ Inquiries: [{ ROWID: "9", inquiry_id: "abc-1", name: "Ivy", status: "new" }] });
  const insert = store.insert.bind(store);
  // Another copy slips its own lead in just before this one's insert lands.
  store.insert = async (table, row) => { if (table === "Leads") await insert("Leads", { name: "Ivy", inquiry_id: "abc-1" }); return insert(table, row); };
  const r = await call(deps, "POST", "/inbox/9/convert");
  const leads = await store.list("Leads");
  assert.equal(leads.length, 1);
  assert.equal(r.body.leadId, String(leads[0].ROWID));
});

test("a payment is its own record: editing the lead or moving it back does not rewrite it", async () => {
  const { deps } = setup();
  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Pay Co", value: 1500 });
  assert.equal((await call(deps, "PATCH", `/leads/${id}`, { status: "paid", paid_at: "2026-11-03" })).body.payment_saved, true);
  const payments = async () => (await call(deps, "GET", "/data?range=all")).body.transactions.filter((t) => t.lead_id === id);
  assert.deepEqual((await payments()).map((t) => [t.kind, t.date, t.amount_cents]), [["income", "2026-11-03", 150000]]);

  await call(deps, "PATCH", `/leads/${id}`, { value: 99 }); // the quote changes
  await call(deps, "PATCH", `/leads/${id}`, { status: "proposal" }); // the lead moves back
  await call(deps, "PATCH", `/leads/${id}`, { status: "paid" }); // and forward again: no second payment
  assert.deepEqual((await payments()).map((t) => [t.date, t.amount_cents]), [["2026-11-03", 150000]]);

  await call(deps, "DELETE", `/leads/${id}`); // the money was still received
  assert.equal((await payments()).length, 1);
});

test("earlier paid leads get payments only where a real paid date exists", async () => {
  const { deps } = setup({ Leads: [
    { ROWID: "1", name: "Dated", status: "paid", value_cents: 49500, booked_at: "2026-09-01", paid_at: "2026-09-09" },
    { ROWID: "2", name: "Undated", status: "paid", value_cents: 29500, booked_at: "2026-09-02" },
    { ROWID: "3", name: "Open", status: "proposal", value_cents: 90000 },
  ] });
  assert.deepEqual((await call(deps, "POST", "/payments/backfill")).body, { created: 1, undated: 1, failed: 0 });
  assert.deepEqual((await call(deps, "POST", "/payments/backfill")).body, { created: 0, undated: 1, failed: 0 }); // running it again adds nothing
  const tx = (await call(deps, "GET", "/data?range=all")).body.transactions;
  assert.deepEqual(tx.map((t) => [t.lead_id, t.date, t.amount_cents]), [["1", "2026-09-09", 49500]]);
});

test("a send is recorded before it goes out: failures can be retried once, unknown outcomes can't be re-sent blindly", async () => {
  const { deps, store } = setup({ Leads: [{ ROWID: "1", name: "Ben", email: "ben@example.com" }] });
  const delivered = [];
  deps.sendMessage = { email: async () => { throw new Error("mail down"); } };
  const failed = await call(deps, "POST", "/messages", { lead_id: "1", channel: "email", body: "Hello", send: true });
  assert.equal(failed.status, 502);
  const [row] = await store.list("Messages");
  assert.equal(row.status, "failed");

  deps.sendMessage.email = async (m) => { delivered.push(m); };
  assert.deepEqual((await call(deps, "POST", `/messages/${row.ROWID}/approve`, { send: true })).body, { ok: true, status: "sent" });
  assert.equal((await call(deps, "POST", `/messages/${row.ROWID}/approve`, { send: true })).status, 409);
  assert.equal(delivered.length, 1);

  // Delivered, but the record couldn't be updated afterwards: the row stays "sending" and a re-send is refused.
  const update = store.update.bind(store);
  store.update = async (table, r) => { if (table === "Messages" && r.status === "sent") throw new Error("store down"); return update(table, r); };
  const odd = await call(deps, "POST", "/messages", { lead_id: "1", channel: "email", body: "Second", send: true });
  assert.deepEqual([odd.status, odd.body.status, odd.body.recorded], [201, "sent", false]);
  assert.equal((await store.get("Messages", odd.body.id)).status, "sending");
  assert.equal((await call(deps, "POST", `/messages/${odd.body.id}/approve`, { send: true })).status, 409);
  assert.equal(delivered.length, 2);
  store.update = update;
  assert.equal((await call(deps, "POST", `/messages/${odd.body.id}/approve`, { send: false })).body.status, "logged"); // a person confirms it
});

test("dates must be real calendar days everywhere", async () => {
  const { deps } = setup({ Leads: [{ ROWID: "1", name: "A" }] });
  assert.equal(core.isDate("2026-02-28"), true);
  for (const bad of ["2026-02-31", "2026-13-01", "2026-00-10", "2026-04-31"]) assert.equal(core.isDate(bad), false, bad);
  assert.equal((await call(deps, "POST", "/transactions", { kind: "expense", amount: 5, label: "x", date: "2026-02-31" })).status, 400);
  assert.equal((await call(deps, "POST", "/tasks", { title: "x", due_at: "2026-02-31" })).status, 400);
  assert.equal((await call(deps, "PATCH", "/leads/1", { follow_up_at: "2026-02-31" })).status, 400);
  assert.equal((await call(deps, "POST", "/time", { lead_id: "1", hours: 1, entry_date: "2026-02-31" })).status, 400);
});

test("a range of N days is today and the N-1 days before it", async () => {
  const lead = (ROWID, booked_at) => ({ ROWID, name: `L${ROWID}`, status: "booked", booked_at });
  const { deps } = setup({ Leads: [lead("1", "2026-11-11"), lead("2", "2026-11-10"), lead("3", "2026-11-05"), lead("4", "2026-11-04"), lead("5", "2026-10-29")] });
  const ids = async (range) => { const d = (await call(deps, "GET", `/data?range=${range}`)).body; return [d.leads.map((l) => l.id).sort().join(""), d.from, d.previous && d.previous.booked]; };
  assert.deepEqual(await ids("1"), ["1", "2026-11-11", 1]); // today only; the day before is the previous period
  assert.deepEqual(await ids("7"), ["123", "2026-11-05", 2]); // Nov 5 to 11; Oct 29 to Nov 4 before it
  assert.deepEqual((await ids("all")).slice(0, 2), ["12345", ""]);
});

test("the daily email counts your own tasks that are due", async () => {
  const { deps } = setup({ Tasks: [
    { ROWID: "1", title: "Send the invoice", due_at: "2026-11-09", done_at: "" },
    { ROWID: "2", title: "Finished already", due_at: "2026-11-09", done_at: "2026-11-10" },
    { ROWID: "3", title: "Next week", due_at: "2026-11-18", done_at: "" },
  ] });
  const d = (await call(deps, "POST", "/digest?preview=1")).body;
  assert.equal(d.urgent, 1);
  assert.match(d.text, /Your tasks due \(1\)\n {2}• Send the invoice \(due Nov 9\)/);
  assert.doesNotMatch(d.text, /Finished already|Next week/);
});

test("sign-in attempts are counted per visitor, kept in the store, and cleared by a good sign-in", async () => {
  const { deps, store } = setup({ LoginAttempts: [] });
  const A = "a".repeat(32), B = "b".repeat(32);
  const hit = async (scope, event) => (await call(deps, "POST", "/auth/throttle", { scope, event })).body;
  for (let i = 0; i < 7; i++) assert.equal((await hit(A, "fail")).blocked, false);
  assert.equal((await hit(A, "fail")).blocked, true); // the eighth
  assert.equal((await hit(A, "check")).blocked, true);
  assert.equal((await hit(B, "check")).blocked, false); // someone else is not locked out by A's guesses
  assert.equal((await store.list("LoginAttempts")).length, 8); // survives a restart: it is in the store
  assert.equal((await hit(B, "fail")).blocked, false);
  await hit(B, "ok");
  assert.equal((await store.list("LoginAttempts")).some((r) => r.scope === B), false);
  // Old attempts fall away.
  const later = { ...deps, now: () => new Date(NOW().getTime() + 16 * 60_000) };
  assert.equal((await call(later, "POST", "/auth/throttle", { scope: A, event: "check" })).body.blocked, false);
  // Without the table the site is told to keep its own count.
  const bare = setup();
  bare.store.list = async (t) => { if (t === "LoginAttempts") throw new Error("no such table"); return []; };
  assert.deepEqual((await call(bare.deps, "POST", "/auth/throttle", { scope: A, event: "check" })).body, { persistent: false });
  assert.equal((await call(deps, "POST", "/auth/throttle", { scope: "1.2.3.4", event: "check" })).status, 400); // a raw address is refused
});

test("small validation holes: tiny hours and a done flag sent as text", async () => {
  const { deps } = setup({ Leads: [{ ROWID: "1", name: "A" }], Tasks: [{ ROWID: "2", title: "T", due_at: "", done_at: "" }] });
  assert.equal((await call(deps, "POST", "/time", { lead_id: "1", hours: 0.001 })).status, 400);
  assert.equal((await call(deps, "POST", "/time", { lead_id: "1", hours: 0.25 })).status, 201);
  assert.equal((await call(deps, "PATCH", "/tasks/2", { done: "false" })).status, 400);
  assert.equal((await call(deps, "GET", "/data")).body.tasks[0].done_at, "");
});

test("money kinds: transfers out are their own kind, and old withdrawals wait for a category", async () => {
  const { deps } = setup({ Leads: [{ ROWID: "1", name: "A" }], Transactions: [
    { ROWID: "5", tx_date: "2026-11-01", amount_cents: 30000, kind: "withdrawal", label: "Old entry" },
    { ROWID: "6", tx_date: "2026-11-01", amount_cents: 50000, kind: "deposit", label: "Old deposit" },
    { ROWID: "7", tx_date: "2026-11-01", amount_cents: 49500, kind: "earning", label: "Old income" },
  ] });
  assert.equal((await call(deps, "POST", "/transactions", { kind: "transfer_out", amount: 200, label: "Paid myself" })).status, 201);
  assert.equal((await call(deps, "POST", "/transactions", { kind: "expense", amount: 5, label: "x", lead_id: "1" })).status, 400); // only income links to a client
  assert.equal((await call(deps, "POST", "/transactions", { kind: "income", amount: 5, label: "x", lead_id: "404" })).status, 404);
  const kinds = async () => Object.fromEntries((await call(deps, "GET", "/data")).body.transactions.map((t) => [t.label, t.kind]));
  assert.deepEqual(await kinds(), { "Old entry": "out", "Old deposit": "transfer_in", "Old income": "income", "Paid myself": "transfer_out" });
  assert.equal((await call(deps, "PATCH", "/transactions/5", { kind: "expense" })).status, 200);
  assert.equal((await kinds())["Old entry"], "expense");
  assert.equal((await call(deps, "PATCH", "/transactions/5", { kind: "withdrawal" })).status, 400);
});

test("your next move: promises first, then people waiting, then calls, then today, then idle proposals", async () => {
  const lead = (ROWID, name, extra) => ({ ROWID, name, status: "held", booked_at: "2026-10-20", value_cents: 0, ...extra });
  const { deps } = setup({
    Leads: [
      lead("1", "Big Idle", { status: "proposal", value_cents: 900000 }), // worth the most, promised nothing
      lead("2", "Ben", { status: "proposal", value_cents: 150000, follow_up_at: "2026-11-08", follow_up_note: "Check on the proposal" }),
      lead("3", "Today", { follow_up_at: "2026-11-11" }),
      lead("4", "Ryan", { status: "booked", call_at: "2026-11-09" }),
      lead("5", "Older", { follow_up_at: "2026-11-02" }),
    ],
    Tasks: [{ ROWID: "8", title: "Send the invoice", due_at: "2026-11-10", done_at: "" }, { ROWID: "9", title: "Done one", due_at: "2026-11-01", done_at: "2026-11-02" }],
    Inquiries: [{ ROWID: "7", name: "Ivy", company: "Ivy Lane", status: "new", created_at: "2026-11-10T09:00:00Z", source: "Instagram", message: "Can you help?" }],
    Messages: [{ ROWID: "6", lead_id: "2", direction: "in", channel: "email", body: "I'll review it with my partner.", status: "received", created_at: "2026-11-06T10:00:00Z" }],
  });
  const next = (await call(deps, "GET", "/data?range=1")).body.next; // the range never changes it
  assert.deepEqual(next.map((n) => n.key), ["followup-5", "followup-2", "task-8", "inquiry-7", "call-4", "followup-3", "proposal-1"]);
  const ben = next[1];
  assert.equal(ben.title, "Follow up with Ben");
  assert.equal(ben.reason, "The $1,500 proposal is 3 days overdue.");
  assert.deepEqual(ben.evidence, [
    { label: "Follow-up set for 2026-11-08", text: "Check on the proposal" },
    { label: "Their last message, 2026-11-06", text: "I'll review it with my partner." },
  ]);
});

test("AI help returns its sources, drops made-up dates, and is off without a key", async () => {
  const { deps } = setup({
    Leads: [{ ROWID: "1", name: "Elena", status: "proposal", value_cents: 120000 }],
    Messages: [
      { ROWID: "2", lead_id: "1", direction: "out", channel: "call", body: "She wants the report left out. I'll send the revised scope.", status: "logged", created_at: "2026-11-09T10:00:00Z" },
      { ROWID: "3", lead_id: "1", direction: "out", channel: "email", body: "AI draft", status: "draft", created_at: "2026-11-10T10:00:00Z" },
    ],
    Inquiries: [{ ROWID: "4", name: "Sam", status: "new", created_at: "2026-11-10T09:00:00Z", message: "Same ten questions daily." }],
  });
  assert.equal((await call(deps, "POST", "/assist", { kind: "catch_up", lead_id: "1" })).status, 503);
  const asked = [];
  deps.assist = async (q) => { asked.push(q); return { text: " Summary. ", tasks: [{ title: "Send the revised scope", due_at: "2026-02-31" }, { title: "Call her", due_at: "2026-11-14" }, { title: " " }] }; };
  const tasks = (await call(deps, "POST", "/assist", { kind: "extract_tasks", lead_id: "1" })).body;
  assert.deepEqual(tasks.tasks, [{ title: "Send the revised scope", due_at: "" }, { title: "Call her", due_at: "2026-11-14" }]);
  assert.deepEqual(tasks.sources.map((s) => s.label), ["2026-11-09 · call · me"]); // the draft is not a source
  const caught = (await call(deps, "POST", "/assist", { kind: "catch_up", lead_id: "1" })).body;
  assert.equal(caught.text, "Summary.");
  assert.deepEqual(caught.tasks, []);
  assert.match(caught.sources[0].text, /Proposed value: \$1,200 \(a quote, not money received\)/);
  assert.equal((await call(deps, "POST", "/assist", { kind: "inquiry_summary", inquiry_id: "4" })).body.sources[0].text, "Same ten questions daily.");
  assert.equal((await call(deps, "POST", "/assist", { kind: "write_poem" })).status, 400);
  assert.equal((await call(deps, "GET", "/data")).body.tasks.length, 0); // suggestions are never added on their own
});
