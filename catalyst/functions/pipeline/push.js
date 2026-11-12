// Phone and desktop notifications (Web Push) for the installed tracker.
// The browser gives us a subscription (an https endpoint plus two keys); we send it an encrypted message
// signed with our VAPID keys. Nothing here can read the tracker; it only delivers short alerts.

const webpush = require("web-push");

/** Returns { publicKey, send(subscription, payload) }, or undefined when the VAPID keys aren't set. */
function makePusher({ publicKey, privateKey, subject, lib = webpush } = {}) {
  if (!publicKey || !privateKey) return undefined;
  const vapidDetails = { subject: subject || "mailto:hello@heurial.studio", publicKey, privateKey };
  return {
    publicKey,
    /** "sent", or "gone" when the browser has dropped the subscription and it should be deleted. */
    async send(subscription, payload) {
      try {
        await lib.sendNotification(subscription, JSON.stringify(payload), { vapidDetails, TTL: 60 * 60 * 24, timeout: 5000, urgency: "high" });
        return "sent";
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) return "gone";
        throw err;
      }
    },
  };
}

/** A subscription posted by the browser, checked before it is stored. */
function cleanSubscription(body) {
  const s = body && typeof body === "object" ? body.subscription || body : {};
  const endpoint = String(s.endpoint || "");
  const keys = s.keys || {};
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  // Push services are public https hosts. Refuse anything else, so this can't be pointed at an internal address.
  if (url.protocol !== "https:" || /^(\d+\.){3}\d+$|^\[|^localhost$/i.test(url.hostname) || endpoint.length > 1000) return null;
  const p256dh = String(keys.p256dh || ""), auth = String(keys.auth || "");
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,64}$/.test(auth)) return null;
  return { endpoint, p256dh, auth, device: String(body.device || "").slice(0, 120) };
}

const short = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

module.exports = { makePusher, cleanSubscription, short };
