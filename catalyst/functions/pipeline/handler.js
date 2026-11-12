// HTTP routes for the hosted tracker. Only the HEURIAL website's server may call this function:
// every request must carry the shared secret in X-Heurial-Key (PIPELINE_KEY here, PIPELINE_FUNCTION_KEY on the site).

const crypto = require("node:crypto");
const core = require("./core");

const MAX_BODY = 32 * 1024;
const TABLES = { leads: "Leads", time: "TimeEntries", inquiries: "Inquiries", messages: "Messages" };

function keyMatches(given, expected) {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
    req.on("end", () => {
      if (size > MAX_BODY) return reject(new core.Bad("Request too large.", 413));
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new core.Bad("Invalid JSON.")); }
    });
    req.on("error", reject);
  });
}

/**
 * @param deps {
 *   expectedKey: string,
 *   store: { list(table), get(table, id), insert(table, row), update(table, row), remove(table, id) },
 *   sendMail?: (msg: { to, subject, text, html }) => Promise<void>,
 *   digestTo?: string, trackerUrl?: string, timeZone?: string, now?: () => Date,
 *   sendMessage?: { email?: (msg: { to, subject, body, lead }) => Promise<void>, sms?: (msg: { to, body, lead }) => Promise<void> },
 *   inboundKey?: string,   // lets an outside service post incoming messages to /inbound
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

    // Incoming messages from an outside service (an email or text provider). This is the only route that
    // doesn't use the site's key: the provider gets its own, so it can never read or change anything else.
    if (path === "inbound" && method === "POST") {
      if (!deps.inboundKey || !keyMatches(req.headers["x-heurial-inbound-key"], deps.inboundKey)) return send(401, { error: "Unauthorized" });
      const row = core.cleanInbound(await readJson(req), now.toISOString());
      const lead = core.matchLead(await store.list(TABLES.leads), row.channel, row.sender);
      if (lead) row.lead_id = String(lead.ROWID);
      await store.insert(TABLES.messages, row);
      return send(201, { ok: true, matched: Boolean(lead) });
    }

    if (!keyMatches(req.headers["x-heurial-key"], deps.expectedKey)) return send(401, { error: "Unauthorized" });

    // The Messages table is newer than the others. Until it exists, the rest of the tracker keeps working.
    const listMessages = async () => { try { return await store.list(TABLES.messages); } catch { return null; } };
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
    });
    const getLead = async (id) => {
      const row = await store.get(TABLES.leads, id);
      if (!row) throw new core.Bad("Not found.", 404);
      return row;
    };

    if (method === "GET" && path === "data") {
      const range = url.searchParams.get("range") || "30";
      const { messagesReady, ...rows } = await loadAll();
      return send(200, { ...core.summarize({ ...rows, range, today }), services: services(messagesReady) });
    }

    if (path === "leads" && method === "POST") {
      const lead = core.cleanLead(await readJson(req), false, today);
      if (!lead.phone) delete lead.phone; // a Leads table made before the phone column existed still accepts this row
      const row = await store.insert(TABLES.leads, { ...lead, inquiry_id: "" });
      return send(201, { id: String(row.ROWID) });
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
        const changes = core.cleanLead(await readJson(req), true, today);
        if (changes.phone === "" && !existing.phone) delete changes.phone; // same reason as above
        if (Object.keys(changes).length) await store.update(TABLES.leads, { ...changes, ROWID: id });
        return send(200, { ok: true });
      }
      if (method === "DELETE") {
        await getLead(id);
        const entries = (await store.list(TABLES.time)).filter((t) => String(t.lead_id) === id);
        for (const t of entries) await store.remove(TABLES.time, String(t.ROWID));
        const thread = ((await listMessages()) || []).filter((x) => String(x.lead_id) === id);
        for (const x of thread) await store.remove(TABLES.messages, String(x.ROWID));
        await store.remove(TABLES.leads, id);
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
    // Add to a thread. With send: true, an email or text goes out through the connected service first;
    // if that fails nothing is saved, so the log never claims something was sent when it wasn't.
    if (path === "messages" && method === "POST") {
      const body = await readJson(req);
      const row = core.cleanMessage(body, now.toISOString());
      const lead = await getLead(row.lead_id);
      if ((await listMessages()) === null) throw new core.Bad("Messages aren't set up yet. Create the Messages table first.", 503);
      if (body.send === true) {
        if (row.direction !== "out" || (row.channel !== "email" && row.channel !== "sms")) throw new core.Bad("Only your own emails and texts can be sent.");
        const deliver = deps.sendMessage && deps.sendMessage[row.channel];
        if (!deliver) throw new core.Bad(row.channel === "email" ? "Email sending isn't connected yet." : "Text sending isn't connected yet.", 503);
        const to = row.channel === "email" ? lead.email : lead.phone;
        if (!to) throw new core.Bad(row.channel === "email" ? "This lead has no email address." : "This lead has no phone number.");
        try {
          await deliver({ to, subject: row.subject, body: row.body, lead: { id: String(lead.ROWID), name: lead.name || "" } });
        } catch (err) {
          console.error("pipeline: sending failed", err && err.message);
          throw new core.Bad("The message couldn't be sent. Nothing was saved, so you can try again.", 502);
        }
        row.status = "sent";
      }
      const saved = await store.insert(TABLES.messages, row);
      return send(201, { id: String(saved.ROWID), status: row.status });
    }
    if ((m = path.match(/^messages\/(\d{1,20})$/)) && method === "DELETE") {
      await store.remove(TABLES.messages, m[1]);
      return send(200, { ok: true });
    }

    // Inbox: website inquiries waiting for a person to decide.
    if ((m = path.match(/^inbox\/(\d{1,20})\/(convert|dismiss)$/)) && method === "POST") {
      const inquiry = await store.get(TABLES.inquiries, m[1]);
      if (!inquiry) throw new core.Bad("Not found.", 404);
      if ((inquiry.status || "new") !== "new") throw new core.Bad("This inquiry was already handled.", 409);
      let leadId;
      if (m[2] === "convert") {
        const row = await store.insert(TABLES.leads, core.leadFromInquiry(inquiry, today));
        leadId = String(row.ROWID);
      }
      await store.update(TABLES.inquiries, { ROWID: m[1], status: m[2] === "convert" ? "converted" : "dismissed" });
      return send(200, { ok: true, leadId });
    }

    // Daily email. ?preview=1 returns it without sending.
    if (path === "digest" && method === "POST") {
      const data = core.summarize({ ...(await loadAll()), range: "7", today });
      const digest = core.buildDigest(data, { trackerUrl: deps.trackerUrl });
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
