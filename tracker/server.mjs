// HEURIAL pipeline tracker: a small private app for booked calls, paid jobs, hours and lead sources.
// No dependencies. Needs Node 22.13+ (built-in SQLite). Run: node server.mjs   (or --demo for sample data)
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seedDemo } from "./seed.mjs";

const demo = process.argv.includes("--demo");
const PORT = Number(process.env.PORT) || (demo ? 4311 : 4310);
const HOST = "127.0.0.1"; // private: never exposed to the network
const root = dirname(fileURLToPath(import.meta.url));

// Data lives outside this folder (and outside iCloud-synced Documents) so a sync can't corrupt it.
const dataDir = process.env.TRACKER_DIR || join(homedir(), ".heurial-tracker");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(dataDir, demo ? "demo.db" : "tracker.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    business TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'Other',
    status TEXT NOT NULL DEFAULT 'booked',
    booked_at TEXT NOT NULL,
    call_at TEXT NOT NULL DEFAULT '',
    value_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    hours REAL NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_time_lead ON time_entries(lead_id);
`);
// Older databases (made before follow-ups existed) get the new columns added in place.
const cols = db.prepare("PRAGMA table_info(leads)").all().map((c) => c.name);
if (!cols.includes("follow_up_at")) db.exec("ALTER TABLE leads ADD COLUMN follow_up_at TEXT NOT NULL DEFAULT ''");
if (!cols.includes("follow_up_note")) db.exec("ALTER TABLE leads ADD COLUMN follow_up_note TEXT NOT NULL DEFAULT ''");
if (demo && db.prepare("SELECT COUNT(*) n FROM leads").get().n === 0) seedDemo(db);

const STATUSES = ["booked", "held", "proposal", "paid", "lost", "no_show"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const mondayOf = (s) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

class Bad extends Error {}
const text = (v, max) => String(v ?? "").trim().slice(0, max);

function cleanLead(body, partial = false) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("name")) { out.name = text(body.name, 120); if (!out.name) throw new Bad("Name is required."); }
  if (!partial || has("business")) out.business = text(body.business, 120);
  if (!partial || has("email")) out.email = text(body.email, 254);
  if (!partial || has("source")) out.source = text(body.source, 60) || "Other";
  if (!partial || has("status")) {
    out.status = body.status ?? "booked";
    if (!STATUSES.includes(out.status)) throw new Bad("Unknown status.");
  }
  if (!partial || has("booked_at")) {
    out.booked_at = body.booked_at || ymd(new Date());
    if (!DATE.test(out.booked_at)) throw new Bad("Booked date must be YYYY-MM-DD.");
  }
  if (!partial || has("call_at")) {
    out.call_at = body.call_at || "";
    if (out.call_at && !DATE.test(out.call_at)) throw new Bad("Call date must be YYYY-MM-DD.");
  }
  if (!partial || has("follow_up_at")) {
    out.follow_up_at = body.follow_up_at || "";
    if (out.follow_up_at && !DATE.test(out.follow_up_at)) throw new Bad("Follow-up date must be YYYY-MM-DD.");
  }
  if (!partial || has("follow_up_note")) out.follow_up_note = text(body.follow_up_note, 300);
  if (!partial || has("value")) {
    const dollars = Number(body.value ?? 0);
    if (!Number.isFinite(dollars) || dollars < 0 || dollars > 10_000_000) throw new Bad("Value must be a positive number.");
    out.value_cents = Math.round(dollars * 100);
  }
  if (!partial || has("notes")) out.notes = text(body.notes, 4000);
  return out;
}

function summarize(range) {
  const cutoff = range === "all" ? "0000-00-00" : daysAgo(Number(range));
  const leads = db.prepare(`
    SELECT l.*, COALESCE(SUM(t.hours), 0) AS hours
    FROM leads l LEFT JOIN time_entries t ON t.lead_id = l.id
    WHERE l.booked_at >= ? GROUP BY l.id ORDER BY l.booked_at DESC, l.id DESC
  `).all(cutoff);

  const held = (l) => l.status !== "booked" && l.status !== "no_show";
  const agg = (rows) => {
    const paid = rows.filter((l) => l.status === "paid");
    const revenue = paid.reduce((s, l) => s + l.value_cents, 0);
    const hours = rows.reduce((s, l) => s + l.hours, 0);
    return {
      booked: rows.length,
      held: rows.filter(held).length,
      paid: paid.length,
      revenue_cents: revenue,
      hours,
    };
  };

  const summary = agg(leads);
  const bySource = {};
  for (const l of leads) (bySource[l.source] ||= []).push(l);
  const sources = Object.entries(bySource)
    .map(([source, rows]) => ({ source, ...agg(rows) }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents || b.booked - a.booked);

  // The same-length period just before this one, for "up/down vs before" on the summary cards.
  let previous = null;
  if (range !== "all") {
    const prevRows = db.prepare(`
      SELECT l.*, COALESCE(SUM(t.hours), 0) AS hours
      FROM leads l LEFT JOIN time_entries t ON t.lead_id = l.id
      WHERE l.booked_at >= ? AND l.booked_at < ? GROUP BY l.id
    `).all(daysAgo(Number(range) * 2), cutoff);
    previous = agg(prevRows);
  }

  // Last 12 weeks, independent of the chosen range, for the trend charts.
  const weekStart = mondayOf(daysAgo(77));
  const weeks = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(`${weekStart}T12:00:00`); d.setDate(d.getDate() + i * 7);
    weeks[ymd(d)] = { week: ymd(d), booked: 0, paid: 0, revenue_cents: 0 };
  }
  for (const l of db.prepare("SELECT booked_at, status, value_cents FROM leads WHERE booked_at >= ?").all(weekStart)) {
    const w = weeks[mondayOf(l.booked_at)];
    if (!w) continue;
    w.booked++;
    if (l.status === "paid") { w.paid++; w.revenue_cents += l.value_cents; }
  }
  // Reminders ignore the date range: an overdue follow-up matters no matter when the call was booked.
  const today = ymd(new Date());
  const followups = db.prepare(
    "SELECT id, name, business, status, follow_up_at, follow_up_note FROM leads WHERE follow_up_at != '' ORDER BY follow_up_at, id",
  ).all();
  const stale = db.prepare(
    "SELECT id, name, business, call_at, follow_up_at FROM leads WHERE status = 'booked' AND call_at != '' AND call_at < ? ORDER BY call_at",
  ).all(today);
  return { leads, summary, previous, sources, weekly: Object.values(weeks), followups, stale, today };
}

function csvEscape(v) {
  const s = String(v ?? "");
  // Leading = + - @ can run as formulas when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function exportCsv() {
  const rows = db.prepare(`
    SELECT l.*, COALESCE(SUM(t.hours), 0) AS hours FROM leads l
    LEFT JOIN time_entries t ON t.lead_id = l.id GROUP BY l.id ORDER BY l.booked_at DESC
  `).all();
  const head = ["name", "business", "email", "source", "status", "booked_at", "call_at", "follow_up_at", "follow_up_note", "value_usd", "hours", "notes"];
  return [head.join(","), ...rows.map((l) => [
    l.name, l.business, l.email, l.source, l.status, l.booked_at, l.call_at, l.follow_up_at, l.follow_up_note, (l.value_cents / 100).toFixed(2), l.hours, l.notes,
  ].map(csvEscape).join(","))].join("\n");
}

async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Bad("Request too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { throw new Bad("Invalid JSON."); }
}

// Read on each visit (it's small) so edits to the page show up without restarting.
const page = () => readFileSync(join(root, "public", "index.html"));
const send = (res, status, body, type = "application/json", extra = {}) => {
  res.writeHead(status, {
    "Content-Type": `${type}; charset=utf-8`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    ...extra,
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  try {
    // Block DNS-rebinding and cross-site requests: this app holds private client data.
    const host = (req.headers.host || "").split(":")[0];
    if (host !== "127.0.0.1" && host !== "localhost") return send(res, 403, { error: "Forbidden" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const write = req.method !== "GET" && req.method !== "HEAD";
    if (write) {
      const origin = req.headers.origin;
      if (!origin || new URL(origin).host !== req.headers.host) return send(res, 403, { error: "Forbidden" });
    }
    const path = url.pathname;
    let m;

    if (req.method === "GET" && path === "/") return send(res, 200, page(), "text/html");
    if (req.method === "GET" && path === "/api/data") {
      const range = url.searchParams.get("range") || "30";
      if (!["7", "30", "90", "365", "all"].includes(range)) throw new Bad("Bad range.");
      return send(res, 200, { ...summarize(range), demo });
    }
    if (req.method === "GET" && path === "/api/export.csv") {
      return send(res, 200, exportCsv(), "text/csv", { "Content-Disposition": 'attachment; filename="heurial-pipeline.csv"' });
    }
    if (req.method === "POST" && path === "/api/leads") {
      const l = cleanLead(await readJson(req));
      const r = db.prepare(`INSERT INTO leads (name,business,email,source,status,booked_at,call_at,follow_up_at,follow_up_note,value_cents,notes)
        VALUES (:name,:business,:email,:source,:status,:booked_at,:call_at,:follow_up_at,:follow_up_note,:value_cents,:notes)`).run(l);
      return send(res, 201, { id: Number(r.lastInsertRowid) });
    }
    if ((m = path.match(/^\/api\/leads\/(\d+)$/))) {
      const id = Number(m[1]);
      if (req.method === "GET") {
        const lead = db.prepare(`SELECT l.*, COALESCE(SUM(t.hours), 0) AS hours FROM leads l
          LEFT JOIN time_entries t ON t.lead_id = l.id WHERE l.id = ? GROUP BY l.id`).get(id);
        return lead ? send(res, 200, lead) : send(res, 404, { error: "Not found" });
      }
      if (req.method === "PATCH") {
        const l = cleanLead(await readJson(req), true);
        const keys = Object.keys(l);
        if (keys.length) db.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = :${k}`).join(", ")} WHERE id = :id`).run({ ...l, id });
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") { db.prepare("DELETE FROM leads WHERE id = ?").run(id); return send(res, 200, { ok: true }); }
    }
    if ((m = path.match(/^\/api\/leads\/(\d+)\/time$/)) && req.method === "GET") {
      return send(res, 200, db.prepare("SELECT * FROM time_entries WHERE lead_id = ? ORDER BY entry_date DESC, id DESC").all(Number(m[1])));
    }
    if (req.method === "POST" && path === "/api/time") {
      const b = await readJson(req);
      const hours = Number(b.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Bad("Hours must be between 0 and 24.");
      const date = b.entry_date || ymd(new Date());
      if (!DATE.test(date)) throw new Bad("Date must be YYYY-MM-DD.");
      const lead = Number(b.lead_id);
      if (!db.prepare("SELECT 1 FROM leads WHERE id = ?").get(lead)) throw new Bad("Unknown lead.");
      db.prepare("INSERT INTO time_entries (lead_id, entry_date, hours, note) VALUES (?,?,?,?)").run(lead, date, hours, text(b.note, 300));
      return send(res, 201, { ok: true });
    }
    if ((m = path.match(/^\/api\/time\/(\d+)$/)) && req.method === "DELETE") {
      db.prepare("DELETE FROM time_entries WHERE id = ?").run(Number(m[1]));
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    if (err instanceof Bad) return send(res, 400, { error: err.message });
    console.error(err);
    send(res, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`HEURIAL tracker${demo ? " (demo data)" : ""}: http://${HOST}:${PORT}`);
  console.log(`Data file: ${join(dataDir, demo ? "demo.db" : "tracker.db")}`);
});
