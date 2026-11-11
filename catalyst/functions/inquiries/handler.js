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

/**
 * @param req  Node request
 * @param res  Node response
 * @param deps { expectedKey: string, insert: (row) => Promise<{ ROWID?: string }> }
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
    return send(201, { ok: true, rowId: saved && saved.ROWID ? String(saved.ROWID) : undefined });
  } catch (err) {
    console.error("inquiries: save failed", err && err.message);
    return send(500, { error: "Could not save the inquiry" });
  }
}

module.exports = { handle, toRow, keyMatches };
