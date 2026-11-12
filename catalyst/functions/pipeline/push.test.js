// Notifications. Run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const webpush = require("web-push");
const { handle } = require("./handler");
const { memoryStore } = require("./store");
const { makePusher, cleanSubscription } = require("./push");

const KEY = "test-pipeline-key-0123456789";
const INBOUND = "inbound-key-0123456789";
function call(deps, method, url, body, headers = { "x-heurial-key": KEY }) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  Object.assign(req, { method, url, headers });
  return new Promise((resolve) => {
    const res = { writeHead(s) { this.status = s; }, end(p) { resolve({ status: this.status, body: p ? JSON.parse(p) : null }); } };
    handle(req, res, deps);
  });
}
// A real browser-style subscription: an EC P-256 public key and a 16-byte auth secret.
function browserSub(host = "fcm.googleapis.com") {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  return { endpoint: `https://${host}/fcm/send/${crypto.randomBytes(12).toString("hex")}`,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };
}

test("subscribe, notify on incoming messages and inquiries, drop dead subscriptions", async () => {
  const store = memoryStore({ PushSubscriptions: [] });
  const sent = [];
  let gone = "";
  const deps = {
    expectedKey: KEY, store, inboundKey: INBOUND, now: () => new Date("2026-11-11T15:00:00Z"),
    push: { publicKey: "PUBLIC", send: async (sub, payload) => { if (sub.endpoint === gone) return "gone"; sent.push([sub.endpoint, payload]); return "sent"; } },
  };
  assert.deepEqual((await call(deps, "GET", "/push/key")).body, { publicKey: "PUBLIC" });
  assert.equal((await call(deps, "GET", "/push/key", undefined, {})).status, 401);

  const phone = browserSub(), laptop = browserSub("web.push.apple.com");
  assert.equal((await call(deps, "POST", "/push/subscribe", { subscription: { ...phone, endpoint: "http://10.0.0.1/x" } })).status, 400);
  assert.equal((await call(deps, "POST", "/push/subscribe", { subscription: phone, device: "iPhone" })).status, 200);
  await call(deps, "POST", "/push/subscribe", { subscription: phone }); // same device again: no duplicate
  await call(deps, "POST", "/push/subscribe", { subscription: laptop });
  assert.equal((await store.list("PushSubscriptions")).length, 2);

  const { body: { id } } = await call(deps, "POST", "/leads", { name: "Pat Reed", email: "pat@reed.example" });
  await call(deps, "POST", "/inbound", { channel: "email", from: "pat@reed.example", subject: "Re: plan", body: "Sounds good, Tuesday works." }, { "x-heurial-inbound-key": INBOUND });
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0][1], { title: "Email from Pat Reed", body: "Re: plan: Sounds good, Tuesday works.", url: `/admin#lead=${id}&tab=messages`, tag: sent[0][1].tag });

  sent.length = 0;
  gone = laptop.endpoint; // that browser unsubscribed on its side
  await call(deps, "POST", "/notify/inquiry", { name: "Ivy Romero", company: "Ivy Lane Salon", message: "Booking requests come in through DMs." });
  assert.deepEqual(sent.map(([, p]) => p.title), ["New inquiry: Ivy Romero"]);
  assert.equal((await store.list("PushSubscriptions")).length, 1);
  assert.equal((await call(deps, "POST", "/notify/inquiry", {}, {})).status, 401); // only the website can call it

  assert.equal((await call(deps, "POST", "/push/test")).body.sent, 1);
  await call(deps, "POST", "/push/unsubscribe", { endpoint: phone.endpoint });
  assert.equal((await call(deps, "POST", "/push/test")).status, 502);
  assert.equal((await call(deps, "GET", "/data")).body.services.push, true);
});

test("without keys or the table, nothing breaks", async () => {
  const deps = { expectedKey: KEY, store: memoryStore(), inboundKey: INBOUND };
  assert.equal((await call(deps, "GET", "/push/key")).status, 503);
  assert.equal((await call(deps, "POST", "/notify/inquiry", { name: "x" })).status, 200);
  deps.push = { publicKey: "P", send: async () => "sent" };
  const failing = { ...deps, store: { ...memoryStore(), list: async (t) => { if (t === "PushSubscriptions") throw new Error("no table"); return []; } } };
  assert.equal((await call(failing, "POST", "/push/subscribe", { subscription: browserSub() })).status, 503);
  assert.equal((await call(deps, "POST", "/inbound", { from: "a@b.example", body: "hi" }, { "x-heurial-inbound-key": INBOUND })).status, 201);
});

test("pusher: real encryption and VAPID headers, and gone subscriptions", async () => {
  const keys = webpush.generateVAPIDKeys();
  assert.equal(makePusher({}), undefined);
  const sub = browserSub();
  const details = webpush.generateRequestDetails(sub, JSON.stringify({ title: "x" }), { vapidDetails: { subject: "mailto:a@b.example", ...keys } });
  assert.match(details.headers.Authorization, /^vapid t=/);
  assert.equal(details.headers["Content-Encoding"], "aes128gcm");

  const calls = [];
  const ok = makePusher({ ...keys, lib: { sendNotification: async (s, body, opts) => { calls.push([s, body, opts]); } } });
  assert.equal(await ok.send(sub, { title: "Hi" }), "sent");
  assert.equal(calls[0][1], '{"title":"Hi"}');
  assert.equal(calls[0][2].vapidDetails.publicKey, keys.publicKey);
  const dead = makePusher({ ...keys, lib: { sendNotification: async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); } } });
  assert.equal(await dead.send(sub, {}), "gone");
  const down = makePusher({ ...keys, lib: { sendNotification: async () => { throw Object.assign(new Error("down"), { statusCode: 500 }); } } });
  await assert.rejects(down.send(sub, {}));

  assert.equal(cleanSubscription({ subscription: { endpoint: "https://localhost/x", keys: sub.keys } }), null);
  assert.equal(cleanSubscription({ subscription: { endpoint: sub.endpoint, keys: { p256dh: "short", auth: "x" } } }), null);
  assert.equal(cleanSubscription({ subscription: sub, device: "Mac" }).device, "Mac");
});
