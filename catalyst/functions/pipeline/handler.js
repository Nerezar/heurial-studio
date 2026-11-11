// HTTP routes for the hosted tracker. Only the HEURIAL website's server may call this function:
// every request must carry the shared secret in X-Heurial-Key (PIPELINE_KEY here, PIPELINE_FUNCTION_KEY on the site).

const crypto = require("node:crypto");
const core = require("./core");

const MAX_BODY = 32 * 1024;
const TABLES = { leads: "Leads", time: "TimeEntries", inquiries: "Inquiries" };

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
 * }
 */
async function handle(req, res, deps) {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  try {
    if (!keyMatches(req.headers["x-heurial-key"], deps.expectedKey)) return send(401, { error: "Unauthorized" });
    const url = new URL(req.url || "/", "http://local");
    const path = url.pathname.replace(/^\/+|\/+$/g, "").replace(/^server\/pipeline\/?/, "");
    const method = req.method || "GET";
    const today = core.todayIn(deps.timeZone || "America/Chicago", deps.now ? deps.now() : new Date());
    const { store } = deps;
    let m;

    const loadAll = async () => {
      const [leadRows, timeRows, inquiryRows] = await Promise.all([
        store.list(TABLES.leads), store.list(TABLES.time), store.list(TABLES.inquiries),
      ]);
      return { leadRows, timeRows, inquiryRows };
    };
    const getLead = async (id) => {
      const row = await store.get(TABLES.leads, id);
      if (!row) throw new core.Bad("Not found.", 404);
      return row;
    };

    if (method === "GET" && path === "data") {
      const range = url.searchParams.get("range") || "30";
      return send(200, core.summarize({ ...(await loadAll()), range, today }));
    }

    if (path === "leads" && method === "POST") {
      const row = await store.insert(TABLES.leads, { ...core.cleanLead(await readJson(req), false, today), inquiry_id: "" });
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
        await getLead(id);
        const changes = core.cleanLead(await readJson(req), true, today);
        if (Object.keys(changes).length) await store.update(TABLES.leads, { ...changes, ROWID: id });
        return send(200, { ok: true });
      }
      if (method === "DELETE") {
        await getLead(id);
        const entries = (await store.list(TABLES.time)).filter((t) => String(t.lead_id) === id);
        for (const t of entries) await store.remove(TABLES.time, String(t.ROWID));
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
