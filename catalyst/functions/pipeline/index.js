// Catalyst entry point (Advanced I/O, Node.js), same shape as the template `catalyst functions:add` generates.
// SDK classes verified against @zcatalyst/datastore@1.0.0 and @zcatalyst/mail@1.0.0 type definitions:
//   Datastore().table(name).getPagedRows / getRow / insertRow / updateRow / deleteRow
//   new Mail().sendMail({ from_email, to_email, subject, content, html_mode })
//
// Environment variables (set in the Catalyst console, never in code):
//   PIPELINE_KEY   shared secret; the website sends it as X-Heurial-Key
//   DIGEST_FROM    sender address verified in Catalyst Mail (needed only for the daily email)
//   DIGEST_TO      where the daily email goes, e.g. hello@heurial.studio
//   TRACKER_URL    link in the email, e.g. https://www.heurial.studio/admin
//   TIME_ZONE      for "today" and "overdue", default America/Chicago
// Optional, for messages. Each one switches on a connection; without them the tracker only keeps a log.
//   MESSAGES_FROM        sender address verified in Catalyst Mail: lets the tracker email a lead
//   MESSAGE_WEBHOOK_URL  https address of a service that sends a text (for example a Twilio function or an
//                        automation hook). It receives { channel: "sms", to, body, lead: { id, name } }
//   MESSAGE_WEBHOOK_KEY  sent to that service as X-Heurial-Key, so it can check the request is yours
//   INBOUND_KEY          lets an email or text provider post replies to .../server/pipeline/inbound
//                        (header X-Heurial-Inbound-Key; body { channel, from, subject, body })

const { zcAuth } = require("@zcatalyst/auth");
const { Datastore } = require("@zcatalyst/datastore");
const { Mail } = require("@zcatalyst/mail");
const { handle } = require("./handler");
const { catalystStore } = require("./store");

module.exports = async (req, res) => {
  let store;
  const ready = async () => { if (!store) { await zcAuth.init(req); store = catalystStore(Datastore); } };
  const lazyStore = new Proxy({}, {
    get: (_, method) => async (...args) => {
      await ready();
      return store[method](...args);
    },
  });
  const hook = process.env.MESSAGE_WEBHOOK_URL || "";
  await handle(req, res, {
    expectedKey: process.env.PIPELINE_KEY,
    store: lazyStore,
    digestTo: process.env.DIGEST_TO,
    trackerUrl: process.env.TRACKER_URL,
    timeZone: process.env.TIME_ZONE || "America/Chicago",
    sendMail: process.env.DIGEST_FROM
      ? async ({ to, subject, html }) => {
        await ready();
        await new Mail().sendMail({ from_email: process.env.DIGEST_FROM, to_email: [to], subject, content: html, html_mode: true });
      }
      : undefined,
    inboundKey: process.env.INBOUND_KEY,
    sendMessage: {
      email: process.env.MESSAGES_FROM
        ? async ({ to, subject, body }) => {
          await ready();
          await new Mail().sendMail({ from_email: process.env.MESSAGES_FROM, to_email: [to], subject: subject || "(no subject)", content: body, html_mode: false });
        }
        : undefined,
      sms: hook.startsWith("https://")
        ? async ({ to, body, lead }) => {
          const res = await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(process.env.MESSAGE_WEBHOOK_KEY ? { "X-Heurial-Key": process.env.MESSAGE_WEBHOOK_KEY } : {}) },
            body: JSON.stringify({ channel: "sms", to, body, lead }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(`message service answered ${res.status}`);
        }
        : undefined,
    },
  });
};
