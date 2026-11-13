// Run with: node --test   (from this folder). No Catalyst access needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { handle, buildAlert } = require("./handler");

const KEY = "test-inquiry-key-0123456789";
const ROW = {
  inquiry_id: "aaaaaaaa-0000-4000-8000-000000000001", created_at: "2026-11-13T01:38:16.382Z", name: "Ivy Romero", email: "ivy@example.com",
  company: "Ivy Lane Salon", message: "Booking requests come in through DMs and I miss half of them.", source: "Instagram",
  source_detail: "utm_source=instagram", heard: "", attribution: "{}", status: "new",
};

function post(deps, body, key = KEY) {
  const raw = JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]);
  Object.assign(req, { method: "POST", headers: key ? { "x-heurial-key": key } : {} });
  return new Promise((resolve) => {
    const res = { writeHead(s) { this.status = s; }, end(p) { resolve({ status: this.status, body: JSON.parse(p) }); } };
    handle(req, res, deps);
  });
}
const quiet = (fn) => async () => { const e = console.error; console.error = () => {}; try { await fn(); } finally { console.error = e; } };

test("saves, then emails the owner with a reply-to of the visitor", async () => {
  const saved = [], sent = [];
  const r = await post({ expectedKey: KEY, insert: async (row) => { saved.push(row); return { ROWID: "1" }; }, notify: async (m) => { sent.push(m); } }, ROW);
  assert.deepEqual([r.status, r.body.ok, r.body.alerted], [201, true, true]);
  assert.equal(saved.length, 1);
  assert.equal(sent[0].subject, "New inquiry: Ivy Romero (Ivy Lane Salon)");
  assert.equal(sent[0].replyTo, "ivy@example.com");
  assert.match(sent[0].text, /Came from: Instagram \(utm_source=instagram\)/);
  assert.match(sent[0].text, /Booking requests come in through DMs/);
  assert.match(sent[0].text, /https:\/\/www\.heurial\.studio\/admin/);
});

test("a failed email never fails the visitor's submission", quiet(async () => {
  const r = await post({ expectedKey: KEY, insert: async () => ({ ROWID: "1" }), notify: async () => { throw new Error("mail down"); } }, ROW);
  assert.deepEqual([r.status, r.body.ok, r.body.alerted], [201, true, false]);
}));

test("a slow email is cut off so the website still gets its answer in time", quiet(async () => {
  const started = Date.now();
  const r = await post({ expectedKey: KEY, insert: async () => ({}), notify: () => new Promise(() => {}), alertTimeoutMs: 50 }, ROW);
  assert.deepEqual([r.status, r.body.alerted], [201, false]);
  assert.ok(Date.now() - started < 1000);
}));

test("no alert when it's switched off, when the input is bad, or when saving fails", quiet(async () => {
  const sent = [];
  const notify = async (m) => { sent.push(m); };
  assert.equal((await post({ expectedKey: KEY, insert: async () => ({}) }, ROW)).body.alerted, false);
  assert.equal((await post({ expectedKey: KEY, insert: async () => ({}), notify }, { ...ROW, email: "" })).status, 400);
  assert.equal((await post({ expectedKey: KEY, insert: async () => ({}), notify }, ROW, "wrong")).status, 401);
  assert.equal((await post({ expectedKey: KEY, insert: async () => { throw new Error("db down"); }, notify }, ROW)).status, 500);
  assert.equal(sent.length, 0);
}));

test("the subject can't carry line breaks, and empty optional fields read plainly", () => {
  const a = buildAlert({ ...ROW, name: "Pat\r\nBcc: x@example.com", company: "", source_detail: "", heard: "Search" });
  assert.equal(a.subject, "New inquiry: Pat Bcc: x@example.com");
  assert.match(a.text, /Business: not given/);
  assert.match(a.text, /Came from: Instagram\n/);
  assert.match(a.text, /heard about you via: Search/);
});
