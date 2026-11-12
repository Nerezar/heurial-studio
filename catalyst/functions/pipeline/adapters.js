// Adapters for outside services: Twilio for texts, and inbound email from a mail provider's webhook.
// Each turns the provider's format into the shape cleanInbound() expects: { channel, from, subject, body }.

const crypto = require("node:crypto");

// ---------- Twilio ----------

/**
 * Twilio signs each webhook: HMAC-SHA1 (key: the auth token) of the exact webhook URL followed by every
 * POST parameter, sorted by name, as name+value. Base64. Sent as X-Twilio-Signature.
 */
function twilioSignature(authToken, url, params) {
  const data = Object.keys(params).sort().reduce((s, k) => s + k + params[k], url);
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

function twilioValid(authToken, url, params, given) {
  if (!authToken || !url || typeof given !== "string") return false;
  const a = Buffer.from(twilioSignature(authToken, url, params));
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** A US number written any common way becomes +1XXXXXXXXXX. Numbers that already start with + keep their country code. */
function e164(phone) {
  const raw = String(phone || "").trim();
  const d = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

function twilioInbound(params) {
  return { channel: "sms", from: params.From || "", subject: "", body: params.Body || "" };
}

/** Returns a sender for texts through Twilio's Messages API, or undefined when not configured. */
function twilioSender({ accountSid, authToken, from, fetchImpl = fetch }) {
  if (!accountSid || !authToken || !from) return undefined;
  const sender = e164(from);
  return async ({ to, body }) => {
    const target = e164(to);
    if (!target) throw new Error("phone number can't be read");
    const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: sender, To: target, Body: body }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Twilio answered ${res.status}`);
  };
}

// ---------- Inbound email ----------

/** Drop the quoted earlier conversation from a reply, so the thread shows only what's new. */
function stripQuoted(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^_{5,}\s*$/.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && out.some((l) => l.trim())) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Inbound email from Postmark (JSON), or Mailgun / SendGrid (form fields). Uses the stripped reply when
 * the provider gives one, otherwise the plain-text body with quoted lines removed.
 */
function emailInbound(p) {
  const from = (p.FromFull && p.FromFull.Email) || p.From || p.from || p.sender || "";
  const subject = p.Subject || p.subject || "";
  const stripped = p.StrippedTextReply || p["stripped-text"] || "";
  const plain = p.TextBody || p["body-plain"] || p.text || "";
  const body = stripped.trim() || stripQuoted(plain) || String(plain).trim();
  return { channel: "email", from, subject, body };
}

module.exports = { twilioSignature, twilioValid, twilioInbound, twilioSender, e164, emailInbound, stripQuoted };
