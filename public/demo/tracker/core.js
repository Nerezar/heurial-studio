// Copy of catalyst/functions/pipeline/core.js (on the tracker-cloud branch), wrapped so it runs in the browser.
// The demo page uses the same lead, summary and email logic as the real tracker, on sample data only.
;(function (module) {
// Pipeline logic with no Catalyst dependencies, so it can be unit-tested locally.
// Ported from tracker/server.mjs. Row IDs are strings: Catalyst ROWIDs exceed JavaScript's safe integer range.

const STATUSES = ["booked", "held", "proposal", "paid", "lost", "no_show"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,20}$/;

class Bad extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const mondayOf = (s) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const text = (v, max) => String(v ?? "").trim().slice(0, max);

/** Today's date in the business's time zone (Catalyst functions run in UTC). */
function todayIn(timeZone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return ymd(now);
  }
}

function cleanLead(body, partial = false, today) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Bad("Invalid request.");
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
  for (const [key, label, fallback] of [["booked_at", "Booked date", today], ["call_at", "Call date", ""], ["follow_up_at", "Follow-up date", ""]]) {
    if (!partial || has(key)) {
      const v = body[key] || fallback;
      if (v && !DATE.test(v)) throw new Bad(`${label} must be YYYY-MM-DD.`);
      out[key] = v;
    }
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

function cleanTime(body, today) {
  if (!body || typeof body !== "object") throw new Bad("Invalid request.");
  const hours = Number(body.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Bad("Hours must be between 0 and 24.");
  const entry_date = body.entry_date || today;
  if (!DATE.test(entry_date)) throw new Bad("Date must be YYYY-MM-DD.");
  const lead_id = String(body.lead_id ?? "");
  if (!ID.test(lead_id)) throw new Bad("Unknown lead.");
  return { lead_id, entry_date, hours: Math.round(hours * 100) / 100, note: text(body.note, 300) };
}

/** Normalise a Data Store row into the shape the tracker page uses. */
function leadFromRow(row, hoursByLead = {}) {
  return {
    id: String(row.ROWID),
    name: row.name || "",
    business: row.business || "",
    email: row.email || "",
    source: row.source || "Other",
    status: STATUSES.includes(row.status) ? row.status : "booked",
    booked_at: row.booked_at || "",
    call_at: row.call_at || "",
    follow_up_at: row.follow_up_at || "",
    follow_up_note: row.follow_up_note || "",
    value_cents: Number(row.value_cents) || 0,
    notes: row.notes || "",
    inquiry_id: row.inquiry_id || "",
    hours: Math.round((hoursByLead[String(row.ROWID)] || 0) * 100) / 100,
  };
}

function hoursByLead(timeRows) {
  const out = {};
  for (const t of timeRows) out[String(t.lead_id)] = (out[String(t.lead_id)] || 0) + (Number(t.hours) || 0);
  return out;
}

function agg(rows) {
  const paid = rows.filter((l) => l.status === "paid");
  return {
    booked: rows.length,
    held: rows.filter((l) => l.status !== "booked" && l.status !== "no_show").length,
    paid: paid.length,
    revenue_cents: paid.reduce((s, l) => s + l.value_cents, 0),
    hours: Math.round(rows.reduce((s, l) => s + l.hours, 0) * 100) / 100,
  };
}

/** Everything the dashboard needs, computed from all leads, time entries and inquiries. */
function summarize({ leadRows, timeRows, inquiryRows = [], range, today }) {
  if (!["7", "30", "90", "365", "all"].includes(String(range))) throw new Bad("Bad range.");
  const hours = hoursByLead(timeRows);
  const all = leadRows.map((r) => leadFromRow(r, hours));
  const cutoff = range === "all" ? "0000-00-00" : addDays(today, -Number(range));
  const byNewest = (a, b) => (b.booked_at.localeCompare(a.booked_at) || (b.id.length - a.id.length) || b.id.localeCompare(a.id));
  const leads = all.filter((l) => l.booked_at >= cutoff).sort(byNewest);

  let previous = null;
  if (range !== "all") {
    const prevCutoff = addDays(today, -Number(range) * 2);
    previous = agg(all.filter((l) => l.booked_at >= prevCutoff && l.booked_at < cutoff));
  }

  const bySource = {};
  for (const l of leads) (bySource[l.source] ||= []).push(l);
  const sources = Object.entries(bySource)
    .map(([source, rows]) => ({ source, ...agg(rows) }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents || b.booked - a.booked);

  const weekStart = mondayOf(addDays(today, -77));
  const weeks = {};
  for (let i = 0; i < 12; i++) {
    const w = addDays(weekStart, i * 7);
    weeks[w] = { week: w, booked: 0, paid: 0, revenue_cents: 0 };
  }
  for (const l of all) {
    if (!l.booked_at || l.booked_at < weekStart) continue;
    const w = weeks[mondayOf(l.booked_at)];
    if (!w) continue;
    w.booked++;
    if (l.status === "paid") { w.paid++; w.revenue_cents += l.value_cents; }
  }

  const followups = all.filter((l) => l.follow_up_at)
    .sort((a, b) => a.follow_up_at.localeCompare(b.follow_up_at))
    .map(({ id, name, business, status, follow_up_at, follow_up_note }) => ({ id, name, business, status, follow_up_at, follow_up_note }));
  const stale = all.filter((l) => l.status === "booked" && l.call_at && l.call_at < today)
    .sort((a, b) => a.call_at.localeCompare(b.call_at))
    .map(({ id, name, business, call_at, follow_up_at }) => ({ id, name, business, call_at, follow_up_at }));
  const inbox = inboxFromRows(inquiryRows);

  // Every time entry, newest first, with the lead's name so the Time page can list them without extra requests.
  const byId = Object.fromEntries(all.map((l) => [l.id, l]));
  const time = timeRows.map((t) => {
    const lead = byId[String(t.lead_id)];
    return {
      id: String(t.ROWID), lead_id: String(t.lead_id), lead_name: lead ? lead.name : "", lead_business: lead ? lead.business : "",
      entry_date: t.entry_date || "", hours: Number(t.hours) || 0, note: t.note || "",
    };
  }).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id.localeCompare(a.id)).slice(0, 1000);

  return { leads, summary: agg(leads), previous, sources, weekly: Object.values(weeks), followups, stale, inbox, time, today };
}

/** Website inquiries still waiting for a decision, oldest first. */
function inboxFromRows(inquiryRows) {
  return inquiryRows
    .filter((r) => (r.status || "new") === "new")
    .map((r) => ({
      id: String(r.ROWID),
      inquiry_id: r.inquiry_id || "",
      created_at: r.created_at || "",
      name: r.name || "",
      email: r.email || "",
      company: r.company || "",
      message: r.message || "",
      source: r.source || "Direct",
      source_detail: r.source_detail || "",
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Lead row created when an inquiry is added to the pipeline. */
function leadFromInquiry(inquiry, today) {
  const detail = inquiry.source_detail ? ` (${inquiry.source_detail})` : "";
  return {
    name: text(inquiry.name, 120) || "Website inquiry",
    business: text(inquiry.company, 120),
    email: text(inquiry.email, 254),
    source: text(inquiry.source, 60) || "Website",
    status: "booked",
    booked_at: today,
    call_at: "",
    follow_up_at: today,
    follow_up_note: "Reply to schedule the call",
    value_cents: 0,
    notes: text(`From the website form${detail}:\n${inquiry.message || ""}`, 4000),
    inquiry_id: text(inquiry.inquiry_id, 36),
  };
}

// ---------- Daily email ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const nice = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/**
 * The morning summary. Returns { subject, text, html, urgent }.
 * Includes: inquiries waiting, calls needing a status, overdue and today's follow-ups, the week ahead, last 7 days.
 */
function buildDigest(data, { trackerUrl = "" } = {}) {
  const t = data.today;
  const overdue = data.followups.filter((f) => f.follow_up_at < t);
  const dueToday = data.followups.filter((f) => f.follow_up_at === t);
  const week = data.followups.filter((f) => f.follow_up_at > t && f.follow_up_at <= addDays(t, 7));
  const urgent = data.inbox.length + data.stale.length + overdue.length + dueToday.length;
  const s = data.summary;

  const sections = [];
  const add = (title, items) => { if (items.length) sections.push({ title, items }); };
  add(`New inquiries waiting (${data.inbox.length})`, data.inbox.map((i) =>
    `${i.name}${i.company ? ` · ${i.company}` : ""} — ${i.source}, ${nice(i.created_at.slice(0, 10))}`));
  add(`Did these calls happen? (${data.stale.length})`, data.stale.map((x) =>
    `${x.name}${x.business ? ` · ${x.business}` : ""} — call was ${nice(x.call_at)}, still marked booked`));
  add(`Overdue follow-ups (${overdue.length})`, overdue.map((f) =>
    `${f.name} — ${f.follow_up_note || "Follow up"} (due ${nice(f.follow_up_at)})`));
  add(`Due today (${dueToday.length})`, dueToday.map((f) => `${f.name} — ${f.follow_up_note || "Follow up"}`));
  add(`Coming up this week (${week.length})`, week.map((f) => `${nice(f.follow_up_at)}: ${f.name} — ${f.follow_up_note || "Follow up"}`));

  const numbers = `Last 7 days: ${s.booked} call${s.booked === 1 ? "" : "s"} booked, ${s.paid} paid, ${money(s.revenue_cents)} revenue.`;
  const subject = urgent
    ? `HEURIAL: ${urgent} thing${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} you today`
    : "HEURIAL: nothing urgent today";

  const textBody = [
    urgent ? `${urgent} item${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} your attention.` : "You're all caught up. Nothing is overdue.",
    "",
    ...sections.flatMap((sec) => [sec.title, ...sec.items.map((i) => `  • ${i}`), ""]),
    numbers,
    trackerUrl ? `\nOpen the tracker: ${trackerUrl}` : "",
  ].join("\n").trim();

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f2ec;font:15px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#13161b">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3dfd4;border-radius:14px;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;font-weight:700">HEURIAL</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:500">${urgent ? `${urgent} thing${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} you today` : "You're all caught up"}</h1>
${sections.map((sec) => `<h2 style="margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#5d6570">${esc(sec.title)}</h2>
<ul style="margin:0;padding-left:18px">${sec.items.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join("")}</ul>`).join("\n")}
<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e3dfd4;color:#5d6570">${esc(numbers)}</p>
${trackerUrl ? `<p style="margin:16px 0 0"><a href="${esc(trackerUrl)}" style="display:inline-block;background:#2f6fe0;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600">Open the tracker</a></p>` : ""}
</div></body></html>`;

  return { subject, text: textBody, html, urgent };
}

module.exports = {
  Bad, STATUSES, cleanLead, cleanTime, leadFromRow, summarize, inboxFromRows, leadFromInquiry, buildDigest, todayIn, addDays, ID,
};

})(window.__core = { exports: {} });
