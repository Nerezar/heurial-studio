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
/** A real calendar day. 2026-02-31 has the right shape and is not one. */
function isDate(s) {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 864e5);

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
  if (!partial || has("phone")) out.phone = text(body.phone, 40);
  if (!partial || has("source")) out.source = text(body.source, 60) || "Other";
  if (!partial || has("status")) {
    out.status = body.status ?? "booked";
    if (!STATUSES.includes(out.status)) throw new Bad("Unknown status.");
  }
  for (const [key, label, fallback] of [["booked_at", "Booked date", today], ["call_at", "Call date", ""], ["follow_up_at", "Follow-up date", ""], ["paid_at", "Paid date", ""]]) {
    if (!partial || has(key)) {
      const v = body[key] || fallback;
      if (v && !isDate(v)) throw new Bad(`${label} must be a real date (YYYY-MM-DD).`);
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

/**
 * The paid date follows the stage. Becoming paid stamps today unless a date is given; while paid, the date can be
 * changed or emptied; leaving paid clears it, so a stored date always belongs to a paid lead.
 * `existing` is the stored row, or null for a new lead. paid_at stays in the result only when it has to be written,
 * so a Leads table without that column is never asked to store one it doesn't need.
 */
function withPaidDate(changes, existing, today) {
  const was = Boolean(existing) && existing.status === "paid";
  const had = (existing && existing.paid_at) || "";
  const paid = (changes.status ?? (existing ? existing.status : "booked")) === "paid";
  const next = !paid ? "" : changes.paid_at || (!was ? today : changes.paid_at === undefined ? had : "");
  const out = { ...changes };
  if (next === had) delete out.paid_at; else out.paid_at = next;
  return out;
}

function cleanTime(body, today) {
  if (!body || typeof body !== "object") throw new Bad("Invalid request.");
  // Rounded first, so an amount too small to keep (0.001) is refused instead of being saved as 0.
  const hours = Math.round(Number(body.hours) * 100) / 100;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Bad("Hours must be between 0.01 and 24.");
  const entry_date = body.entry_date || today;
  if (!isDate(entry_date)) throw new Bad("Date must be a real date (YYYY-MM-DD).");
  const lead_id = String(body.lead_id ?? "");
  if (!ID.test(lead_id)) throw new Bad("Unknown lead.");
  return { lead_id, entry_date, hours, note: text(body.note, 300) };
}

// Money entries. Each kind says what the money was, so earnings never mix with money that was only moved:
//   income        a customer paid. Raises the balance and counts as earned.
//   expense       the business spent it. Lowers the balance and counts against profit.
//   transfer_in   money put in. Raises the balance, is not earned.
//   transfer_out  money taken out for yourself. Lowers the balance, is not an expense.
const TX_KINDS = ["income", "expense", "transfer_in", "transfer_out"];
// Rows saved before the kinds were split. An old "withdrawal" never said whether it was an expense or a
// transfer out, so it is read as "out": money that left, waiting for a person to say which.
const OLD_KINDS = { earning: "income", deposit: "transfer_in", withdrawal: "out" };

/** A money entry typed in by hand. An income entry can name the lead that paid it. */
function cleanTransaction(body, today) {
  if (!body || typeof body !== "object") throw new Bad("Invalid request.");
  const cents = Math.round(Number(body.amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 1e11) throw new Bad("Amount must be more than 0.");
  if (!TX_KINDS.includes(body.kind)) throw new Bad("Choose income, expense, transfer in or transfer out.");
  const tx_date = body.date || today;
  if (!isDate(tx_date)) throw new Bad("Date must be a real date (YYYY-MM-DD).");
  const label = text(body.label, 120);
  if (!label) throw new Bad("Add a short description.");
  const out = { tx_date, amount_cents: cents, kind: body.kind, label };
  // lead_id is only written when there is one, so a Transactions table without that column still takes plain entries.
  if (body.lead_id) {
    if (body.kind !== "income") throw new Bad("Only income can be linked to a client.");
    if (!ID.test(String(body.lead_id))) throw new Bad("Unknown lead.");
    out.lead_id = String(body.lead_id);
  }
  return out;
}
/** A change of category for an existing entry: the one edit a saved entry allows. */
function cleanTransactionKind(body) {
  if (!body || typeof body !== "object" || !TX_KINDS.includes(body.kind)) throw new Bad("Choose income, expense, transfer in or transfer out.");
  return { kind: body.kind };
}
const transactionFromRow = (row) => ({
  id: String(row.ROWID), date: row.tx_date || "", amount_cents: Number(row.amount_cents) || 0,
  kind: TX_KINDS.includes(row.kind) ? row.kind : OLD_KINDS[row.kind] || "out", label: row.label || "",
  lead_id: row.lead_id ? String(row.lead_id) : "",
});
/**
 * The payment written when a lead is paid. It is its own row, so changing the lead afterwards (its value, its
 * stage, its name) can't rewrite what was received or when.
 */
function paymentFromLead(lead, id, date) {
  return { tx_date: date, amount_cents: Number(lead.value_cents) || 0, kind: "income", label: text(`Payment from ${lead.name || "a client"}`, 120), lead_id: String(id) };
}
/** Whether a paid lead still needs its payment written: paid, worth something, dated, and with no payment yet. */
function needsPayment(lead, id, date, txRows) {
  return lead.status === "paid" && Number(lead.value_cents) > 0 && isDate(date || "")
    && !txRows.some((t) => String(t.lead_id || "") === String(id) && (t.kind === "income" || t.kind === "earning"));
}

/** A task of your own, with an optional due date. `partial` is for a change to an existing one. */
function cleanTask(body, today, partial = false) {
  if (!body || typeof body !== "object") throw new Bad("Invalid request.");
  const out = {};
  if (!partial || "title" in body) {
    out.title = text(body.title, 200);
    if (!out.title) throw new Bad("Say what the task is.");
  }
  if (!partial || "due_at" in body) {
    out.due_at = body.due_at || "";
    if (out.due_at && !isDate(out.due_at)) throw new Bad("Date must be a real date (YYYY-MM-DD).");
  }
  // Only true or false: the text "false" is not a way to finish a task.
  if ("done" in body) {
    if (typeof body.done !== "boolean") throw new Bad("done must be true or false.");
    out.done_at = body.done ? today : "";
  }
  else if (!partial) out.done_at = "";
  return out;
}
const taskFromRow = (row) => ({ id: String(row.ROWID), title: row.title || "", due_at: row.due_at || "", done_at: row.done_at || "" });
/** Open tasks first, soonest due at the top and undated last; then finished ones, most recent first. */
function tasksFromRows(rows) {
  const late = (t) => t.due_at || "9999-99-99";
  return rows.map(taskFromRow).sort((a, b) => (Boolean(a.done_at) - Boolean(b.done_at))
    || (a.done_at ? b.done_at.localeCompare(a.done_at) : late(a).localeCompare(late(b))) || a.id.localeCompare(b.id)).slice(0, 500);
}

/** Normalise a Data Store row into the shape the tracker page uses. */
function leadFromRow(row, hoursByLead = {}) {
  return {
    id: String(row.ROWID),
    name: row.name || "",
    business: row.business || "",
    email: row.email || "",
    phone: row.phone || "",
    source: row.source || "Other",
    status: STATUSES.includes(row.status) ? row.status : "booked",
    booked_at: row.booked_at || "",
    call_at: row.call_at || "",
    paid_at: row.paid_at || "",
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
function summarize({ leadRows, timeRows, inquiryRows = [], messageRows = [], taskRows = [], range, today }) {
  if (!["1", "7", "30", "90", "365", "all"].includes(String(range))) throw new Bad("Bad range.");
  const hours = hoursByLead(timeRows);
  const all = leadRows.map((r) => leadFromRow(r, hours));
  const cutoff = rangeStart(range, today);
  const byNewest = (a, b) => (b.booked_at.localeCompare(a.booked_at) || (b.id.length - a.id.length) || b.id.localeCompare(a.id));
  const leads = all.filter((l) => l.booked_at >= cutoff).sort(byNewest);

  let previous = null;
  if (range !== "all") {
    const prevCutoff = addDays(cutoff, -Number(range));
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

  // Recent messages, newest first. Long ones are shortened here; a lead's own thread has them in full.
  const messages = messageRows.map((r) => messageFromRow(r, byId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, 300)
    .map((x) => (x.body.length > 600 ? { ...x, body: `${x.body.slice(0, 600)}…` } : x));

  const next = nextMoves({ all, followups, stale, inbox, tasks: tasksFromRows(taskRows), messageRows, today });
  return { leads, summary: agg(leads), previous, sources, weekly: Object.values(weeks), followups, stale, inbox, time, messages, next, today, from: range === "all" ? "" : cutoff };
}

/**
 * The first day of a range. A range of N days is the last N calendar days with today as the last one, so "1" is
 * today alone and "7" is today and the six days before it. Every screen and the money chart use this one rule.
 */
function rangeStart(range, today) {
  return range === "all" ? "0000-00-00" : addDays(today, -(Number(range) - 1));
}

// ---------- Your next move ----------
// Plain rules, no AI: the same records always give the same order. Promises come first (something overdue that
// was said would happen), then people waiting on a first reply, then calls with no outcome, then what is due
// today, then open proposals with nothing scheduled. A lead's value only breaks ties inside one group.

const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const daysWord = (n) => `${n} day${n === 1 ? "" : "s"}`;

function nextMoves({ all, followups, stale, inbox, tasks, messageRows = [], today }) {
  const byId = Object.fromEntries(all.map((l) => [l.id, l]));
  // The latest thing each lead wrote, as evidence beside a follow-up.
  const lastIn = {};
  for (const m of messageRows) {
    const id = m.lead_id ? String(m.lead_id) : "";
    if (!id || m.direction !== "in") continue;
    if (!lastIn[id] || String(m.created_at || "") > String(lastIn[id].created_at || "")) lastIn[id] = m;
  }
  const hasDraft = new Set(messageRows.filter((m) => m.status === "draft" && m.lead_id).map((m) => String(m.lead_id)));
  const quote = (id) => (lastIn[id] ? [{ label: `Their last message, ${String(lastIn[id].created_at || "").slice(0, 10)}`, text: text(lastIn[id].body, 200) }] : []);
  const items = [];
  const followUp = (f, tier) => {
    const lead = byId[f.id] || f, late = dayDiff(today, f.follow_up_at), worth = lead.value_cents > 0 && lead.status === "proposal";
    items.push({
      key: `followup-${f.id}`, kind: "followup", tier, lead_id: f.id, date: f.follow_up_at, value_cents: lead.value_cents || 0, has_draft: hasDraft.has(f.id),
      title: `Follow up with ${f.name}`,
      // The date belongs to the follow-up, so the follow-up is what is late. The proposal is context, said apart.
      reason: `${late > 0 ? `Your follow-up is ${daysWord(late)} overdue.` : "Your follow-up is due today."}${worth ? ` The ${dollars(lead.value_cents)} proposal is still open.` : ""}`,
      evidence: [{ label: `Follow-up set for ${f.follow_up_at}`, text: f.follow_up_note || "Follow up" }, ...quote(f.id)],
    });
  };
  const task = (t, tier) => {
    const late = dayDiff(today, t.due_at);
    items.push({
      key: `task-${t.id}`, kind: "task", tier, task_id: t.id, date: t.due_at, value_cents: 0, title: t.title,
      reason: late > 0 ? `Your task is ${daysWord(late)} overdue.` : "Your task is due today.",
      evidence: [{ label: `Due ${t.due_at}`, text: "From your own task list" }],
    });
  };
  const open = tasks.filter((t) => !t.done_at && t.due_at);
  for (const f of followups) if (f.follow_up_at < today) followUp(f, 1);
  for (const t of open) if (t.due_at < today) task(t, 1);
  for (const i of inbox) {
    items.push({
      key: `inquiry-${i.id}`, kind: "inquiry", tier: 2, inquiry_id: i.id, date: String(i.created_at), value_cents: 0, // the full time: the one waiting longest leads
      title: `Reply to ${i.name || "a new inquiry"}`,
      reason: `${i.company ? `${i.company} wrote` : "They wrote"} through the website and nobody has replied yet.`,
      evidence: [{ label: `Inquiry received ${String(i.created_at).slice(0, 10)} · ${i.source}`, text: text(i.message, 200) }],
    });
  }
  for (const s of stale) {
    items.push({
      key: `call-${s.id}`, kind: "call", tier: 3, lead_id: s.id, date: s.call_at, value_cents: 0,
      title: `Record the call with ${s.name}`,
      reason: `The call was ${daysWord(dayDiff(today, s.call_at))} ago and the lead is still marked as booked.`,
      evidence: [{ label: `Call date ${s.call_at}`, text: "Stage: call booked" }],
    });
  }
  for (const f of followups) if (f.follow_up_at === today) followUp(f, 4);
  for (const t of open) if (t.due_at === today) task(t, 4);
  for (const l of all) {
    if (l.status !== "proposal" || l.follow_up_at) continue;
    items.push({
      key: `proposal-${l.id}`, kind: "proposal", tier: 5, lead_id: l.id, date: l.booked_at, value_cents: l.value_cents,
      title: `Set a next step for ${l.name}`,
      reason: `${l.value_cents ? `The ${dollars(l.value_cents)} proposal` : "The proposal"} is out and nothing is scheduled.`,
      evidence: [{ label: "Stage: proposal sent", text: "No follow-up date" }, ...quote(l.id)],
    });
  }
  // Oldest first inside a group: the longest-waiting promise leads. Value, then id, settle the rest.
  return items.sort((a, b) => a.tier - b.tier || String(a.date).localeCompare(String(b.date)) || b.value_cents - a.value_cents || a.key.localeCompare(b.key));
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

// ---------- Sign-in attempts ----------
// Wrong passwords are counted per visitor (a hash of their address, never the address itself) and kept in the
// Data Store, so the count survives restarts and is shared by every copy of the site. One visitor guessing can't
// lock the owner out; a ceiling across all visitors still slows a spread-out attack.
const ATTEMPT_WINDOW_MS = 15 * 60_000, ATTEMPTS_EACH = 8, ATTEMPTS_ALL = 60;
function loginThrottle(rows, scope, nowMs) {
  const live = rows.filter((r) => nowMs - Date.parse(r.failed_at) < ATTEMPT_WINDOW_MS);
  const mine = live.filter((r) => r.scope === scope);
  const blocked = mine.length >= ATTEMPTS_EACH || live.length >= ATTEMPTS_ALL;
  const oldest = Math.min(...(mine.length >= ATTEMPTS_EACH ? mine : live).map((r) => Date.parse(r.failed_at)));
  return { blocked, retry_after_s: blocked ? Math.max(1, Math.ceil((oldest + ATTEMPT_WINDOW_MS - nowMs) / 1000)) : 0, stale: rows.filter((r) => !live.includes(r)) };
}

// ---------- Messages ----------
// One log per lead for notes, calls, emails and texts. A message is either written here ("out") or received ("in").
// "logged" means it was recorded but not sent from the tracker; "sent" means a connected service delivered it.

const CHANNELS = ["note", "email", "sms", "call"];

function cleanMessage(body, nowIso) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Bad("Invalid request.");
  const channel = body.channel ?? "note";
  if (!CHANNELS.includes(channel)) throw new Bad("Unknown message type.");
  const lead_id = String(body.lead_id ?? "");
  if (!ID.test(lead_id)) throw new Bad("Unknown lead.");
  const content = text(body.body, 4000);
  if (!content) throw new Bad("Write the message first.");
  // A note is always your own. Calls, emails and texts can be logged in either direction.
  const direction = channel !== "note" && body.direction === "in" ? "in" : "out";
  return {
    lead_id, direction, channel, subject: channel === "email" ? text(body.subject, 200) : "", body: content,
    status: direction === "in" ? "received" : "logged", sender: "", created_at: nowIso,
  };
}

/** A message posted by an outside service (an email or text provider). The handler matches it to a lead. */
function cleanInbound(body, nowIso) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Bad("Invalid request.");
  const channel = body.channel === "sms" ? "sms" : "email";
  const sender = text(body.from, 254);
  const content = text(body.body, 4000);
  if (!sender) throw new Bad("from is required.");
  if (!content) throw new Bad("body is required.");
  return {
    lead_id: "", direction: "in", channel, subject: channel === "email" ? text(body.subject, 200) : "", body: content,
    status: "received", sender, created_at: nowIso,
  };
}

const digits = (s) => String(s || "").replace(/\D/g, "");

/** Find the lead a message came from: by email address, or by the last 10 digits of a phone number. */
function matchLead(leadRows, channel, sender) {
  if (channel === "sms") {
    const want = digits(sender).slice(-10);
    if (want.length < 7) return null;
    return leadRows.find((l) => digits(l.phone).slice(-10) === want) || null;
  }
  const raw = String(sender).trim().toLowerCase();
  const inBrackets = raw.match(/<([^>]+)>/); // "Name <address@example.com>"
  const address = (inBrackets ? inBrackets[1] : raw).trim();
  return leadRows.find((l) => String(l.email || "").trim().toLowerCase() === address) || null;
}

function messageFromRow(row, leadsById = {}) {
  const lead = row.lead_id ? leadsById[String(row.lead_id)] : null;
  return {
    id: String(row.ROWID),
    lead_id: row.lead_id ? String(row.lead_id) : "",
    lead_name: lead ? lead.name : "",
    lead_business: lead ? lead.business : "",
    direction: row.direction === "in" ? "in" : "out",
    channel: CHANNELS.includes(row.channel) ? row.channel : "note",
    subject: row.subject || "",
    body: row.body || "",
    status: row.status || "logged",
    sender: row.sender || "",
    created_at: row.created_at || "",
  };
}

// ---------- AI help ----------
// The AI only ever sees the records gathered here, and the same list goes back to the tracker with the answer, so
// the owner can see exactly what a summary was written from.

/** `get` is { inquiry(id), lead(id), messages() }. Returns [{ label, text }]. */
async function assistSources(body, get) {
  if (body.kind === "inquiry_summary") {
    if (!ID.test(String(body.inquiry_id ?? ""))) throw new Bad("Unknown inquiry.");
    const q = await get.inquiry(String(body.inquiry_id));
    if (!q) throw new Bad("Not found.", 404);
    return [{ label: `Inquiry from ${q.name || "someone"}${q.company ? ` · ${q.company}` : ""}, ${String(q.created_at || "").slice(0, 10)} · ${q.source || "Direct"}`, text: text(q.message, 4000) || "(no message)" }];
  }
  if (!ID.test(String(body.lead_id ?? ""))) throw new Bad("Unknown lead.");
  const row = await get.lead(String(body.lead_id)), lead = leadFromRow(row);
  const thread = (await get.messages()).filter((m) => String(m.lead_id) === lead.id && m.status !== "draft").map((m) => messageFromRow(m))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const piece = (m) => ({
    label: `${m.created_at.slice(0, 10)} · ${m.channel} · ${m.channel === "note" ? "my note" : m.direction === "in" ? lead.name || "them" : "me"}`,
    text: `${m.subject ? `${m.subject}\n` : ""}${m.body}`,
  });
  if (body.kind === "extract_tasks") {
    const notes = thread.filter((m) => m.channel === "call" || m.channel === "note");
    if (!notes.length) throw new Bad("There are no call notes or notes on this client yet.");
    return notes.slice(-10).map(piece);
  }
  const record = [
    `Name: ${lead.name}`, lead.business && `Business: ${lead.business}`, `Stage: ${lead.status}`,
    lead.value_cents ? `Proposed value: ${dollars(lead.value_cents)} (a quote, not money received)` : "",
    lead.follow_up_at ? `Next action: ${lead.follow_up_note || "Follow up"} on ${lead.follow_up_at}` : "Next action: none set",
    lead.notes && `My notes: ${lead.notes}`,
  ].filter(Boolean).join("\n");
  return [{ label: "Client record", text: record }, ...thread.slice(-20).map(piece)];
}
/** What comes back from the AI, trimmed and checked. A suggested task keeps a date only if it is a real one. */
function cleanAssist(kind, out, sources) {
  const summary = text(out && out.text, 2000);
  const tasks = kind !== "extract_tasks" ? [] : (Array.isArray(out && out.tasks) ? out.tasks : []).slice(0, 10)
    .map((t) => ({ title: text(t && t.title, 200), due_at: t && isDate(t.due_at) ? t.due_at : "" })).filter((t) => t.title);
  if (kind !== "extract_tasks" && !summary) throw new Bad("The AI came back empty. Try again.", 502);
  return { kind, text: summary, tasks, sources };
}

/**
 * The stand-in draft for pages with no AI behind them (the sample-data page, the local stand-in). It says what it
 * is, and it only refers to what the lead's record and thread show: no day, time or promise is made up.
 */
function sampleDraft({ lead, thread = [], channel }) {
  const first = text(lead.name, 120).split(" ")[0] || "there", proposal = lead.status === "proposal";
  if (channel === "sms") {
    return { subject: "", body: `Hi ${first}, sample draft. ${proposal ? "Checking in on the proposal I sent. Any questions I can answer?" : "Following up on our last conversation. Is there anything you need from me?"}` };
  }
  const lastMail = [...thread].reverse().find((m) => m.channel === "email" && m.subject);
  return {
    subject: lastMail ? `Re: ${lastMail.subject.replace(/^(re:\s*)+/i, "")}` : "Following up",
    body: `Hi ${first},\n\n${proposal
      ? "I'm checking in on the proposal I sent. Have you had a chance to look it over? I'm happy to answer questions or walk through it."
      : "I'm following up on our last conversation. Is there anything you need from me to move forward?"}\n\n(Sample draft, not written by AI. On the real tracker, Claude writes this from the thread.)`,
  };
}

// ---------- Daily email ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const nice = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/**
 * The morning summary. Returns { subject, text, html, urgent }.
 * Includes: inquiries waiting, calls needing a status, overdue and today's follow-ups, your own tasks that are
 * due, the week ahead, last 7 days.
 */
function buildDigest(data, { trackerUrl = "", tasks = [] } = {}) {
  const t = data.today;
  const mine = tasks.filter((x) => !x.done_at && x.due_at && x.due_at <= t);
  const overdue = data.followups.filter((f) => f.follow_up_at < t);
  const dueToday = data.followups.filter((f) => f.follow_up_at === t);
  const week = data.followups.filter((f) => f.follow_up_at > t && f.follow_up_at <= addDays(t, 7));
  const urgent = data.inbox.length + data.stale.length + overdue.length + dueToday.length + mine.length;
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
  add(`Your tasks due (${mine.length})`, mine.map((x) => `${x.title}${x.due_at < t ? ` (due ${nice(x.due_at)})` : ""}`));
  add(`Coming up this week (${week.length})`, week.map((f) => `${nice(f.follow_up_at)}: ${f.name} — ${f.follow_up_note || "Follow up"}`));

  const numbers = `Last 7 days: ${s.booked} call${s.booked === 1 ? "" : "s"} booked, ${s.paid} of them paid, worth ${money(s.revenue_cents)}.`;
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
  Bad, STATUSES, CHANNELS, TX_KINDS, isDate, rangeStart, nextMoves, loginThrottle, assistSources, cleanAssist, sampleDraft, cleanTransaction, cleanTransactionKind, transactionFromRow, paymentFromLead, needsPayment, cleanTask, taskFromRow, tasksFromRows, cleanLead, withPaidDate, cleanTime, cleanMessage, cleanInbound, matchLead, messageFromRow, leadFromRow, summarize,
  inboxFromRows, leadFromInquiry, buildDigest, todayIn, addDays, ID,
};
