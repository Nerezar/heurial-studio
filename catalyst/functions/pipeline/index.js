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
//                        (header X-Heurial-Inbound-Key; body { channel, from, subject, body }), and an email
//                        provider (Postmark, Mailgun, SendGrid) post to .../server/pipeline/inbound/email?key=…
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   send texts through Twilio (takes the place of the webhook)
//   TWILIO_WEBHOOK_URL   the exact URL set as the number's incoming-message webhook in Twilio, ending in
//                        /server/pipeline/twilio/sms. Needed to check Twilio's signature on incoming texts.
//   ANTHROPIC_API_KEY    turns on "Draft with AI". Drafts are saved for you to approve; nothing is sent on its own.

const { zcAuth } = require("@zcatalyst/auth");
const { Datastore } = require("@zcatalyst/datastore");
const { Mail } = require("@zcatalyst/mail");
const { handle } = require("./handler");
const { catalystStore } = require("./store");
const { twilioSender } = require("./adapters");
const { makeDrafter } = require("./draft");

const env = (name) => (process.env[name] || "").trim();
const drafter = makeDrafter({ apiKey: env("ANTHROPIC_API_KEY") }); // one client for the life of the instance

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
    twilio: env("TWILIO_AUTH_TOKEN") && env("TWILIO_WEBHOOK_URL").startsWith("https://")
      ? { authToken: env("TWILIO_AUTH_TOKEN"), webhookUrl: env("TWILIO_WEBHOOK_URL") }
      : undefined,
    draft: drafter,
    sendMessage: {
      email: process.env.MESSAGES_FROM
        ? async ({ to, subject, body }) => {
          await ready();
          await new Mail().sendMail({ from_email: process.env.MESSAGES_FROM, to_email: [to], subject: subject || "(no subject)", content: body, html_mode: false });
        }
        : undefined,
      sms: twilioSender({ accountSid: env("TWILIO_ACCOUNT_SID"), authToken: env("TWILIO_AUTH_TOKEN"), from: env("TWILIO_FROM") }) || (hook.startsWith("https://")
        ? async ({ to, body, lead }) => {
          const res = await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(process.env.MESSAGE_WEBHOOK_KEY ? { "X-Heurial-Key": process.env.MESSAGE_WEBHOOK_KEY } : {}) },
            body: JSON.stringify({ channel: "sms", to, body, lead }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(`message service answered ${res.status}`);
        }
        : undefined),
    },
  });
};
