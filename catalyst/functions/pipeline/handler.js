// HTTP routes for the hosted tracker. Only the HEURIAL website's server may call this function:
// every request must carry the shared secret in X-Heurial-Key (PIPELINE_KEY here, PIPELINE_FUNCTION_KEY on the site).

const crypto = require("node:crypto");
const core = require("./core");
const adapters = require("./adapters");
const { cleanSubscription, short } = require("./push");

const MAX_BODY = 32 * 1024;
const MAX_EMAIL = 4 * 1024 * 1024; // provider posts can include HTML and attachments; only the text is kept
const TABLES = { leads: "Leads", time: "TimeEntries", inquiries: "Inquiries", messages: "Messages", push: "PushSubscriptions", tx: "Transactions", tasks: "Tasks", attempts: "LoginAttempts" };

// One request at a time per record. Two approvals of the same draft, or two conversions of the same inquiry,
// arriving together are run one after the other, so the second sees what the first did and stops.
// shortcut: this holds inside one running copy of the function; two copies could still overlap for a moment.
// The Data Store has no compare-and-set, so closing that needs a unique column or a lock table.
const queues = new Map();
async function alone(key, fn) {
  const before = queues.get(key) || Promise.resolve();
  let release;
  const mine = before.then(() => new Promise((r) => { release = r; }));
  queues.set(key, mine);
  await before;
  try { return await fn(); } finally { release(); if (queues.get(key) === mine) queues.delete(key); }
}

function keyMatches(given, expected) {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size <= limit) chunks.push(c); });
    req.on("end", () => {
      if (size > limit) return reject(new core.Bad("Request too large.", 413));
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

async function readJson(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new core.Bad("Invalid JSON."); }
}

/** JSON or an HTML form post (Twilio, Mailgun and SendGrid send forms), as a flat object of strings. */
async function readFields(req, limit) {
  const type = String(req.headers["content-type"] || "");
  if (type.includes("json")) return readJson(req, limit);
  if (type.includes("multipart/form-data")) {
    const raw = await readBody(req, limit);
    const boundary = (type.match(/boundary="?([^";]+)"?/) || [])[1];
    const out = {};
    if (!boundary) return out;
    for (const part of raw.split(`--${boundary}`)) {
      const m = part.match(/^\r?\nContent-Disposition: form-data; name="([^"]+)"(?:; filename="[^"]*")?\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n$/i);
      if (m && !/filename=/i.test(part.slice(0, 200))) out[m[1]] = m[2];
    }
    return out;
  }
  return Object.fromEntries(new URLSearchParams(await readBody(req, limit)));
}

/**
 * @param deps {
 *   expectedKey: string,
 *   store: { list(table), get(table, id), insert(table, row), update(table, row), remove(table, id) },
 *   sendMail?: (msg: { to, subject, text, html }) => Promise<void>,
 *   digestTo?: string, trackerUrl?: string, timeZone?: string, now?: () => Date,
 *   sendMessage?: { email?: (msg: { to, subject, body, lead }) => Promise<void>, sms?: (msg: { to, body, lead }) => Promise<void> },
 *   inboundKey?: string,   // lets an outside service post incoming messages to /inbound and /inbound/email
 *   twilio?: { authToken: string, webhookUrl: string },   // checks the signature on texts posted to /twilio/sms
 *   draft?: ({ lead, thread, channel, instructions }) => Promise<{ subject, body }>,   // AI reply drafts
 *   assist?: ({ kind, sources }) => Promise<{ text, tasks }>,   // AI summaries and task suggestions
 *   push?: { publicKey: string, send(subscription, payload): Promise<"sent" | "gone"> },   // notifications
 * }
 */
async function handle(req, res, deps) {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  try {
    const url = new URL(req.url || "/", "http://local");
    const path = url.pathname.replace(/^\/+|\/+$/g, "").replace(/^server\/pipeline\/?/, "");
    const method = req.method || "GET";
    const now = deps.now ? deps.now() : new Date();
    const today = core.todayIn(deps.timeZone || "America/Chicago", now);
    const { store } = deps;
    let m;

    // Notifications to every subscribed device. Never fails the request that triggered it.
    const notify = async (payload) => {
      if (!deps.push) return 0;
      let subs;
      try { subs = await store.list(TABLES.push); } catch { return 0; } // table not created yet
      let sent = 0;
      await Promise.all(subs.map(async (sub) => {
        try {
          const result = await deps.push.send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          if (result === "gone") await store.remove(TABLES.push, String(sub.ROWID));
          else sent++;
        } catch (err) { console.error("pipeline: notification failed", err && (err.statusCode || err.message)); }
      }));
      return sent;
    };

    // Incoming messages from outside services. These are the only routes that don't use the site's key:
    // each provider gets its own secret, so it can only add a received message and never read anything.
    const saveInbound = async (fields) => {
      const row = core.cleanInbound(fields, now.toISOString());
      const lead = core.matchLead(await store.list(TABLES.leads), row.channel, row.sender);
      if (lead) row.lead_id = String(lead.ROWID);
      const saved = await store.insert(TABLES.messages, row);
      const kind = row.channel === "sms" ? "Text" : "Email";
      await notify({
        title: `${kind} from ${lead ? lead.name || row.sender : row.sender}`,
        body: short(row.subject ? `${row.subject}: ${row.body}` : row.body, 140),
        url: lead ? `/admin#lead=${lead.ROWID}&tab=messages` : "/admin#view=messages",
        tag: `msg-${saved.ROWID}`,
      });
      return Boolean(lead);
    };
    if (path === "inbound" && method === "POST") {
      if (!deps.inboundKey || !keyMatches(req.headers["x-heurial-inbound-key"], deps.inboundKey)) return send(401, { error: "Unauthorized" });
      return send(201, { ok: true, matched: await saveInbound(await readJson(req)) });
    }
    // Email providers (Postmark, Mailgun, SendGrid) can't add headers, so the key goes in the webhook URL.
    if (path === "inbound/email" && method === "POST") {
      const given = req.headers["x-heurial-inbound-key"] || url.searchParams.get("key");
      if (!deps.inboundKey || !keyMatches(given, deps.inboundKey)) return send(401, { error: "Unauthorized" });
      const fields = adapters.emailInbound(await readFields(req, MAX_EMAIL));
      return send(201, { ok: true, matched: await saveInbound(fields) });
    }
    // Texts from Twilio. The signature proves the request came from Twilio for this exact webhook URL.
    if (path === "twilio/sms" && method === "POST") {
      const tw = deps.twilio;
      const params = await readFields(req, MAX_BODY);
      if (!tw || !adapters.twilioValid(tw.authToken, tw.webhookUrl, params, req.headers["x-twilio-signature"])) return send(401, { error: "Unauthorized" });
      await saveInbound(adapters.twilioInbound(params));
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end("<Response></Response>"); // no automatic reply
    }

    if (!keyMatches(req.headers["x-heurial-key"], deps.expectedKey)) return send(401, { error: "Unauthorized" });

    // The Messages table is newer than the others. Until it exists, the rest of the tracker keeps working.
    const listMessages = async () => { try { return await store.list(TABLES.messages); } catch { return null; } };
    // Transactions and Tasks are newer still, and treated the same way: without the table, that part is simply off.
    const listOptional = async (table) => { try { return await store.list(table); } catch { return null; } };
    const loadAll = async () => {
      const [leadRows, timeRows, inquiryRows, messageRows] = await Promise.all([
        store.list(TABLES.leads), store.list(TABLES.time), store.list(TABLES.inquiries), listMessages(),
      ]);
      return { leadRows, timeRows, inquiryRows, messageRows: messageRows || [], messagesReady: messageRows !== null };
    };
    // What is actually connected, so the tracker never has to guess.
    const services = (messagesReady) => ({
      messages: messagesReady,
      digest: Boolean(deps.sendMail && deps.digestTo),
      email: Boolean(deps.sendMessage && deps.sendMessage.email),
      sms: Boolean(deps.sendMessage && deps.sendMessage.sms),
      inbound: Boolean(deps.inboundKey),
      twilio: Boolean(deps.twilio && deps.twilio.authToken && deps.twilio.webhookUrl),
      ai: Boolean(deps.draft),
      assist: Boolean(deps.assist),
      push: Boolean(deps.push),
    });
    // Whether an email or text can go out at all. Throws before anything is saved or sent.
    const sendable = (row, lead) => {
      if (row.direction !== "out" || (row.channel !== "email" && row.channel !== "sms")) throw new core.Bad("Only your own emails and texts can be sent.");
      const service = deps.sendMessage && deps.sendMessage[row.channel];
      if (!service) throw new core.Bad(row.channel === "email" ? "Email sending isn't connected yet." : "Text sending isn't connected yet.", 503);
      const to = row.channel === "email" ? lead.email : lead.phone;
      if (!to) throw new core.Bad(row.channel === "email" ? "This lead has no email address." : "This lead has no phone number.");
      return { service, to };
    };
    // Send a message whose row is already saved as "sending", then write down how it went. The record comes
    // first, so there is always a trace: "failed" can be retried, and a row left on "sending" means the outcome
    // is unknown and must be checked by a person before anything is sent again.
    const deliverSaved = async (id, row, lead) => {
      const { service, to } = sendable(row, lead);
      try {
        await service({ to, subject: row.subject, body: row.body, lead: { id: String(lead.ROWID), name: lead.name || "" } });
      } catch (err) {
        console.error("pipeline: sending failed", err && err.message);
        try { await store.update(TABLES.messages, { ROWID: id, status: "failed" }); } catch (e) { console.error("pipeline: failure not recorded", e && e.message); }
        throw new core.Bad("The message wasn't sent. It's kept as failed, so you can retry it or discard it.", 502);
      }
      try {
        await store.update(TABLES.messages, { ROWID: id, status: "sent", created_at: now.toISOString() });
        return { status: "sent" };
      } catch (err) {
        console.error("pipeline: sent, but the record wasn't updated", err && err.message);
        return { status: "sent", recorded: false }; // it went out; the row still says "sending"
      }
    };
    const getLead = async (id) => {
      const row = await store.get(TABLES.leads, id);
      if (!row) throw new core.Bad("Not found.", 404);
      return row;
    };
    // The paid date is saved in a write of its own. A Leads table made before the paid_at column existed rejects
    // it, and the lead itself must still save; the reply then says the date was left out.
    const savePaidDate = async (id, paid_at) => {
      if (paid_at === undefined) return {};
      try {
        await store.update(TABLES.leads, { ROWID: id, paid_at });
        return {};
      } catch (err) {
        console.error("pipeline: paid date not saved", err && err.message);
        return { paid_at_saved: false };
      }
    };

    // Write the payment for a paid lead, once. `date` is the paid date just saved (or tried). Returns
    // { payment_saved: false } when the Transactions table can't take it, so the tracker can say so.
    const recordPayment = (id, date) => alone(`pay:${id}`, async () => {
      const [lead, txRows] = await Promise.all([store.get(TABLES.leads, id), listOptional(TABLES.tx)]);
      if (!lead || lead.status !== "paid" || !(Number(lead.value_cents) > 0)) return {};
      if (txRows === null) return { payment_saved: false };
      const day = lead.paid_at || date;
      if (!core.needsPayment(lead, id, day, txRows)) return {};
      try {
        await store.insert(TABLES.tx, core.paymentFromLead(lead, id, day));
        return { payment_saved: true };
      } catch (err) {
        console.error("pipeline: payment not recorded", err && err.message);
        return { payment_saved: false };
      }
    });

    // Sign-in attempts, counted for the website. See core.loginThrottle.
    if (path === "auth/throttle" && method === "POST") {
      const b = await readJson(req);
      if (typeof b.scope !== "string" || !/^[a-f0-9]{16,64}$/.test(b.scope) || !["check", "fail", "ok"].includes(b.event)) throw new core.Bad("Invalid request.");
      let rows;
      try { rows = await store.list(TABLES.attempts); } catch { return send(200, { persistent: false }); } // table not created yet
      if (b.event === "fail") rows.push(await store.insert(TABLES.attempts, { scope: b.scope, failed_at: now.toISOString() }));
      const state = core.loginThrottle(rows, b.scope, now.getTime());
      const done = b.event === "ok" ? rows.filter((r) => r.scope === b.scope) : [];
      for (const r of [...state.stale, ...done].slice(0, 100)) await store.remove(TABLES.attempts, String(r.ROWID)).catch(() => {});
      return send(200, { persistent: true, blocked: state.blocked, retry_after_s: state.retry_after_s });
    }

    if (method === "GET" && path === "data") {
      const range = url.searchParams.get("range") || "30";
      const [{ messagesReady, ...rows }, txRows, taskRows] = await Promise.all([loadAll(), listOptional(TABLES.tx), listOptional(TABLES.tasks)]);
      return send(200, {
        ...core.summarize({ ...rows, taskRows: taskRows || [], range, today }),
        transactions: (txRows || []).map(core.transactionFromRow),
        tasks: core.tasksFromRows(taskRows || []),
        services: { ...services(messagesReady), money: txRows !== null, tasks: taskRows !== null },
      });
    }

    // Money entries typed in by hand, and your own tasks.
    if (path === "transactions" && method === "POST") {
      const row = core.cleanTransaction(await readJson(req), today);
      if (row.lead_id) await getLead(row.lead_id);
      const saved = await store.insert(TABLES.tx, row);
      return send(201, { id: String(saved.ROWID) });
    }
    if ((m = path.match(/^transactions\/(\d{1,20})$/)) && method === "PATCH") {
      const existing = await store.get(TABLES.tx, m[1]);
      if (!existing) throw new core.Bad("That entry no longer exists.", 404);
      const { kind } = core.cleanTransactionKind(await readJson(req));
      if (existing.lead_id && kind !== "income") throw new core.Bad("A client's payment stays income. Delete it if it was entered by mistake.");
      await store.update(TABLES.tx, { ROWID: m[1], kind });
      return send(200, { ok: true });
    }
    if ((m = path.match(/^transactions\/(\d{1,20})$/)) && method === "DELETE") {
      await store.remove(TABLES.tx, m[1]);
      return send(200, { ok: true });
    }
    // Paid leads from before payments were kept as their own records: write the missing ones. Only leads with a
    // real paid date get one. A lead with no paid date is left alone and counted, never given a made-up day.
    if (path === "payments/backfill" && method === "POST") {
      const leads = await store.list(TABLES.leads);
      let created = 0, undated = 0, failed = 0;
      for (const lead of leads) {
        if (lead.status !== "paid" || !(Number(lead.value_cents) > 0)) continue;
        if (!core.isDate(lead.paid_at || "")) { undated++; continue; }
        const r = await recordPayment(String(lead.ROWID), lead.paid_at);
        if (r.payment_saved === true) created++; else if (r.payment_saved === false) failed++;
      }
      return send(200, { created, undated, failed });
    }
    if (path === "tasks" && method === "POST") {
      const saved = await store.insert(TABLES.tasks, core.cleanTask(await readJson(req), today));
      return send(201, { id: String(saved.ROWID) });
    }
    if ((m = path.match(/^tasks\/(\d{1,20})$/)) && (method === "PATCH" || method === "DELETE")) {
      if (method === "DELETE") { await store.remove(TABLES.tasks, m[1]); return send(200, { ok: true }); }
      if (!(await store.get(TABLES.tasks, m[1]))) throw new core.Bad("That task no longer exists.", 404);
      await store.update(TABLES.tasks, { ...core.cleanTask(await readJson(req), today, true), ROWID: m[1] });
      return send(200, { ok: true });
    }

    if (path === "leads" && method === "POST") {
      const { paid_at, ...lead } = core.withPaidDate(core.cleanLead(await readJson(req), false, today), null, today);
      if (!lead.phone) delete lead.phone; // a Leads table made before the phone column existed still accepts this row
      const row = await store.insert(TABLES.leads, { ...lead, inquiry_id: "" });
      const dated = await savePaidDate(String(row.ROWID), paid_at);
      return send(201, { id: String(row.ROWID), ...dated, ...(await recordPayment(String(row.ROWID), paid_at)) });
    }
    if ((m = path.match(/^leads\/(\d{1,20})$/))) {
      const id = m[1];
      if (method === "GET") {
        const [row, timeRows] = await Promise.all([getLead(id), store.list(TABLES.time)]);
        const hours = timeRows.filter((t) => String(t.lead_id) === id).reduce((s, t) => s + (Number(t.hours) || 0), 0);
        return send(200, core.leadFromRow(row, { [id]: hours }));
      }
      if (method === "PATCH") {
        const existing = await getLead(id);
        const { paid_at, ...changes } = core.withPaidDate(core.cleanLead(await readJson(req), true, today), existing, today);
        if (changes.phone === "" && !existing.phone) delete changes.phone; // same reason as above
        if (Object.keys(changes).length) await store.update(TABLES.leads, { ...changes, ROWID: id });
        const dated = await savePaidDate(id, paid_at);
        // A lead that is paid gets its payment written once. After that the payment is its own record: changing
        // the lead's value or moving it back a stage leaves what was received exactly as it was.
        return send(200, { ok: true, ...dated, ...(await recordPayment(id, paid_at || existing.paid_at)) });
      }
      if (method === "DELETE") {
        await getLead(id);
        const entries = (await store.list(TABLES.time)).filter((t) => String(t.lead_id) === id);
        for (const t of entries) await store.remove(TABLES.time, String(t.ROWID));
        const thread = ((await listMessages()) || []).filter((x) => String(x.lead_id) === id);
        for (const x of thread) await store.remove(TABLES.messages, String(x.ROWID));
        await store.remove(TABLES.leads, id); // its payments stay on Money: the money was still received
        return send(200, { ok: true });
      }
    }
    if ((m = path.match(/^leads\/(\d{1,20})\/time$/)) && method === "GET") {
      const id = m[1];
      const rows = (await store.list(TABLES.time)).filter((t) => String(t.lead_id) === id)
        .map((t) => ({ id: String(t.ROWID), lead_id: String(t.lead_id), entry_date: t.entry_date, hours: Number(t.hours) || 0, note: t.note || "" }))
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      return send(200, rows);
    }
    if (path === "time" && method === "POST") {
      const entry = core.cleanTime(await readJson(req), today);
      await getLead(entry.lead_id);
      await store.insert(TABLES.time, entry);
      return send(201, { ok: true });
    }
    if ((m = path.match(/^time\/(\d{1,20})$/)) && method === "DELETE") {
      await store.remove(TABLES.time, m[1]);
      return send(200, { ok: true });
    }

    // Messages: a lead's thread, oldest first.
    if ((m = path.match(/^leads\/(\d{1,20})\/messages$/)) && method === "GET") {
      const rows = ((await listMessages()) || []).filter((x) => String(x.lead_id) === m[1])
        .map((x) => core.messageFromRow(x))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      return send(200, rows);
    }
    // Add to a thread. With send: true the message is saved as "sending" first, then sent, then marked "sent" or
    // "failed". The log never claims a send that didn't happen, and never loses one that did.
    if (path === "messages" && method === "POST") {
      const body = await readJson(req);
      const row = core.cleanMessage(body, now.toISOString());
      const lead = await getLead(row.lead_id);
      if ((await listMessages()) === null) throw new core.Bad("Messages aren't set up yet. Create the Messages table first.", 503);
      if (body.send !== true) {
        const saved = await store.insert(TABLES.messages, row);
        return send(201, { id: String(saved.ROWID), status: row.status });
      }
      sendable(row, lead);
      const saved = await store.insert(TABLES.messages, { ...row, status: "sending" });
      return send(201, { id: String(saved.ROWID), ...(await deliverSaved(String(saved.ROWID), row, lead)) });
    }
    // AI draft: Claude writes the next email or text and it's saved with status "draft". It is never sent
    // until you approve it below.
    if ((m = path.match(/^leads\/(\d{1,20})\/draft$/)) && method === "POST") {
      const body = await readJson(req);
      const channel = body.channel === "sms" ? "sms" : "email";
      const lead = await getLead(m[1]);
      if (!deps.draft) throw new core.Bad("AI drafts aren't connected yet (ANTHROPIC_API_KEY).", 503);
      const all = await listMessages();
      if (all === null) throw new core.Bad("Messages aren't set up yet. Create the Messages table first.", 503);
      const thread = all.filter((x) => String(x.lead_id) === m[1] && x.status !== "draft").map((x) => core.messageFromRow(x))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      const instructions = String(body.instructions ?? "").trim().slice(0, 1000);
      let out;
      try {
        out = await deps.draft({ lead: core.leadFromRow(lead), thread, channel, instructions });
      } catch (err) {
        if (err && err.status) throw new core.Bad(err.message, err.status);
        console.error("pipeline: draft failed", err && err.message);
        throw new core.Bad("The draft couldn't be written. Try again.", 502);
      }
      const row = { ...core.cleanMessage({ lead_id: m[1], channel, subject: out.subject, body: out.body }, now.toISOString()), status: "draft" };
      const saved = await store.insert(TABLES.messages, row);
      return send(201, core.messageFromRow(saved));
    }
    // Approve a draft, with any edits, or retry a message that failed. send: true delivers it; otherwise it's
    // kept as logged (for when you sent it yourself). A message can only be approved once: the row is moved to
    // "sending" before anything goes out, and a second request finds it there and stops.
    if ((m = path.match(/^messages\/(\d{1,20})\/approve$/)) && method === "POST") {
      const body = await readJson(req), id = m[1];
      return send(200, await alone(`msg:${id}`, async () => {
        const existing = await store.get(TABLES.messages, id);
        if (!existing) throw new core.Bad("Not found.", 404);
        const wantsSend = body.send === true;
        if (existing.status === "sending" && wantsSend) throw new core.Bad("This message is already being sent. Check whether it arrived before sending again.", 409);
        if (!["draft", "failed", "sending"].includes(existing.status)) throw new core.Bad("This message was already handled.", 409);
        const row = core.cleanMessage({
          lead_id: existing.lead_id, channel: existing.channel,
          subject: body.subject ?? existing.subject, body: body.body ?? existing.body,
        }, existing.created_at || now.toISOString());
        const lead = await getLead(row.lead_id);
        if (!wantsSend) {
          await store.update(TABLES.messages, { ROWID: id, subject: row.subject, body: row.body, status: "logged", created_at: now.toISOString() });
          return { ok: true, status: "logged" };
        }
        sendable(row, lead);
        await store.update(TABLES.messages, { ROWID: id, subject: row.subject, body: row.body, status: "sending" });
        return { ok: true, ...(await deliverSaved(id, row, lead)) };
      }));
    }
    if ((m = path.match(/^messages\/(\d{1,20})$/)) && method === "DELETE") {
      await store.remove(TABLES.messages, m[1]);
      return send(200, { ok: true });
    }

    // Inbox: website inquiries waiting for a person to decide. One inquiry becomes one lead, however many times
    // the button is pressed: requests for the same inquiry run one at a time, a lead that already carries the
    // inquiry's id is reused, and if two copies of this function both add one, the later lead is taken out again.
    if ((m = path.match(/^inbox\/(\d{1,20})\/(convert|dismiss)$/)) && method === "POST") {
      const id = m[1], action = m[2];
      return send(200, await alone(`inq:${id}`, async () => {
        const inquiry = await store.get(TABLES.inquiries, id);
        if (!inquiry) throw new core.Bad("Not found.", 404);
        if ((inquiry.status || "new") !== "new") throw new core.Bad("This inquiry was already handled.", 409);
        if (action === "dismiss") {
          await store.update(TABLES.inquiries, { ROWID: id, status: "dismissed" });
          return { ok: true };
        }
        const ref = String(inquiry.inquiry_id || "");
        const same = async () => (ref ? (await store.list(TABLES.leads)).filter((l) => String(l.inquiry_id || "") === ref) : []);
        const first = (rows) => rows.map((l) => String(l.ROWID)).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))[0];
        let leadId = first(await same()); // an earlier attempt added the lead and stopped before marking the inquiry
        if (!leadId) {
          const mine = String((await store.insert(TABLES.leads, core.leadFromInquiry(inquiry, today))).ROWID);
          leadId = first(await same()) || mine;
          if (leadId !== mine) await store.remove(TABLES.leads, mine);
        }
        await store.update(TABLES.inquiries, { ROWID: id, status: "converted" });
        return { ok: true, leadId };
      }));
    }

    // AI help inside the work: a summary of an inquiry, a catch-up on a client, or tasks suggested from call notes.
    // The reply always carries the records it was written from, and nothing is saved or sent: suggested tasks are
    // only added when the owner adds them.
    if (path === "assist" && method === "POST") {
      const body = await readJson(req);
      if (!["inquiry_summary", "catch_up", "extract_tasks"].includes(body.kind)) throw new core.Bad("Unknown request.");
      if (!deps.assist) throw new core.Bad("AI help isn't connected yet (ANTHROPIC_API_KEY).", 503);
      const sources = await core.assistSources(body, {
        inquiry: (id) => store.get(TABLES.inquiries, id), lead: getLead, messages: async () => (await listMessages()) || [],
      });
      let out;
      try {
        out = await deps.assist({ kind: body.kind, sources });
      } catch (err) {
        if (err && err.status) throw new core.Bad(err.message, err.status);
        console.error("pipeline: assist failed", err && err.message);
        throw new core.Bad("The AI couldn't do that just now. Try again.", 502);
      }
      return send(200, core.cleanAssist(body.kind, out, sources));
    }

    // Notifications: the browser's public key, subscribing a device, a test, and alerts from the website.
    if (path === "push/key" && method === "GET") {
      if (!deps.push) throw new core.Bad("Notifications aren't connected yet (VAPID keys).", 503);
      return send(200, { publicKey: deps.push.publicKey });
    }
    if (path === "push/subscribe" && method === "POST") {
      if (!deps.push) throw new core.Bad("Notifications aren't connected yet (VAPID keys).", 503);
      const sub = cleanSubscription(await readJson(req));
      if (!sub) throw new core.Bad("That browser subscription can't be used.");
      let rows;
      try { rows = await store.list(TABLES.push); } catch { throw new core.Bad("Notifications aren't set up yet. Create the PushSubscriptions table first.", 503); }
      const existing = rows.find((r) => r.endpoint === sub.endpoint);
      if (existing) await store.update(TABLES.push, { ROWID: String(existing.ROWID), p256dh: sub.p256dh, auth: sub.auth, device: sub.device });
      else await store.insert(TABLES.push, { ...sub, created_at: now.toISOString() });
      return send(200, { ok: true });
    }
    if (path === "push/unsubscribe" && method === "POST") {
      const endpoint = String((await readJson(req)).endpoint || "");
      let rows = [];
      try { rows = await store.list(TABLES.push); } catch { /* nothing stored */ }
      for (const r of rows.filter((x) => x.endpoint === endpoint)) await store.remove(TABLES.push, String(r.ROWID));
      return send(200, { ok: true });
    }
    if (path === "push/test" && method === "POST") {
      if (!deps.push) throw new core.Bad("Notifications aren't connected yet (VAPID keys).", 503);
      const sent = await notify({ title: "Notifications are on", body: "New inquiries and replies will show up here.", url: "/admin", tag: "test" });
      if (!sent) throw new core.Bad("No device received it. Turn notifications off and on again.", 502);
      return send(200, { ok: true, sent });
    }
    // The website calls this after it saves a new inquiry.
    if (path === "notify/inquiry" && method === "POST") {
      const b = await readJson(req);
      const name = short(b.name, 80) || "Someone";
      await notify({
        title: `New inquiry: ${name}`,
        body: short([b.company, b.message].filter(Boolean).join(" · "), 140) || "Open the tracker to review it.",
        url: "/admin#view=overview",
        tag: "inquiry",
      });
      return send(200, { ok: true });
    }

    // Daily email. ?preview=1 returns it without sending.
    if (path === "digest" && method === "POST") {
      const [{ messagesReady: _ready, ...rows }, taskRows] = await Promise.all([loadAll(), listOptional(TABLES.tasks)]);
      const data = core.summarize({ ...rows, taskRows: taskRows || [], range: "7", today });
      const digest = core.buildDigest(data, { trackerUrl: deps.trackerUrl, tasks: core.tasksFromRows(taskRows || []) });
      if (url.searchParams.get("preview") === "1") return send(200, { ...digest, sent: false });
      if (!deps.sendMail || !deps.digestTo) throw new core.Bad("Daily email isn't configured (DIGEST_TO and DIGEST_FROM).", 503);
      await deps.sendMail({ to: deps.digestTo, subject: digest.subject, text: digest.text, html: digest.html });
      return send(200, { sent: true, subject: digest.subject, urgent: digest.urgent });
    }

    return send(404, { error: "Not found" });
  } catch (err) {
    if (err instanceof core.Bad) return send(err.status, { error: err.message });
    console.error("pipeline: request failed", err && err.message);
    return send(500, { error: "Something went wrong." });
  }
}

module.exports = { handle, keyMatches, TABLES };
