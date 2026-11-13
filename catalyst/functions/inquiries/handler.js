// Zoho Catalyst Advanced I/O function: saves website inquiries into the Data Store table "Inquiries".
//
// Only the HEURIAL website may call it: every request must carry the secret in the X-Heurial-Key header,
// set as INQUIRY_KEY in this function's environment variables and as INQUIRY_FUNCTION_KEY on the website.
// The website already validates every field; this repeats the checks so the function is safe on its own.
//
// The core logic is exported separately from the Catalyst wiring (index.js) so it can be tested locally.

const crypto = require("node:crypto");

const MAX_BODY = 16 * 1024;
const LIMITS = {
  inquiry_id: [36, 36], created_at: [20, 30], name: [2, 100], email: [3, 254], company: [0, 120],
  message: [10, 1200], source: [1, 60], source_detail: [0, 200], heard: [0, 20], attribution: [0, 1500], status: [1, 20],
};

function keyMatches(given, expected) {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY) chunks.push(chunk); // past the limit, keep reading but drop it, then answer 413
    });
    req.on("end", () => {
      if (size > MAX_BODY) reject(Object.assign(new Error("too large"), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function toRow(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = {};
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = data[field] ?? "";
    if (typeof value !== "string" || value.length < min || value.length > max) return null;
    row[field] = value;
  }
  if (!/^[0-9a-f-]{36}$/.test(row.inquiry_id) || Number.isNaN(Date.parse(row.created_at))) return null;
  return row;
}

const ALERT_TIMEOUT_MS = 5000; // the website waits 10 s in total, so the alert must not hold the reply for long
const oneLine = (s) => String(s || "").replace(/[\r\n\t]+/g, " ").trim();

/** The email the owner gets for each new inquiry. Plain text; replying goes straight to the visitor. */
function buildAlert(row, { trackerUrl = "https://www.heurial.studio/admin" } = {}) {
  const who = oneLine(row.name) + (row.company ? ` (${oneLine(row.company)})` : "");
  const lines = [
    `New inquiry from ${who}`,
    "",
    `Email: ${row.email}`,
    `Business: ${row.company || "not given"}`,
    `Came from: ${row.source}${row.source_detail ? ` (${row.source_detail})` : ""}`,
    row.heard ? `Said they heard about you via: ${row.heard}` : "",
    `Sent: ${row.created_at}`,
    "",
    "Message:",
    row.message,
    "",
    `Reply to this email to answer ${oneLine(row.name)} directly, or open the tracker: ${trackerUrl}`,
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "");
  return { subject: `New inquiry: ${who}`.slice(0, 150), text: lines.join("\n"), replyTo: row.email };
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms); })])
    .finally(() => clearTimeout(timer));
}

/**
 * @param req  Node request
 * @param res  Node response
 * @param deps { expectedKey: string, insert: (row) => Promise<{ ROWID?: string }>,
 *               notify?: (alert: { subject, text, replyTo }) => Promise<void>, trackerUrl?: string, alertTimeoutMs?: number }
 */
async function handle(req, res, deps) {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });
    if (!keyMatches(req.headers["x-heurial-key"], deps.expectedKey)) return send(401, { error: "Unauthorized" });
    let data;
    try { data = JSON.parse(await readBody(req)); } catch (err) {
      return send(err.status === 413 ? 413 : 400, { error: err.status === 413 ? "Too large" : "Invalid JSON" });
    }
    const row = toRow(data);
    if (!row) return send(400, { error: "Invalid inquiry" });
    const saved = await deps.insert(row);
    // The inquiry is saved. Tell the owner, but a failed or slow email never fails the visitor's submission.
    let alerted = false;
    if (deps.notify) {
      try {
        await withTimeout(deps.notify(buildAlert(row, { trackerUrl: deps.trackerUrl })), deps.alertTimeoutMs || ALERT_TIMEOUT_MS);
        alerted = true;
      } catch (err) {
        console.error("inquiries: owner alert failed", row.inquiry_id, err && err.message);
      }
    }
    return send(201, { ok: true, rowId: saved && saved.ROWID ? String(saved.ROWID) : undefined, alerted });
  } catch (err) {
    console.error("inquiries: save failed", err && err.message);
    return send(500, { error: "Could not save the inquiry" });
  }
}

module.exports = { handle, toRow, keyMatches, buildAlert };
