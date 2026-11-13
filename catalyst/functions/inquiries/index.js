// Catalyst entry point (Advanced I/O, Node.js). Wires the tested handler to Catalyst's SDK.
// Package names and calls follow Catalyst's JavaScript SDK docs:
//   https://docs.catalyst.zoho.com/en/sdk/javascript/v1/auth-config/node-consideration/
//   https://docs.catalyst.zoho.com/en/sdk/javascript/v1/cloudscale/datastore/insert-rows/
// Mail fields verified against @zcatalyst/mail@1.0.0 types: from_email, to_email, subject, content, reply_to, html_mode.
//
// Environment variables (Catalyst console):
//   INQUIRY_KEY   shared secret; the website sends it as X-Heurial-Key
//   ALERT_TO      optional: where the new-inquiry email goes. Default hello@heurial.studio. Set to "off" to stop it.
//   ALERT_FROM    optional: a sender verified in Catalyst Mail. Default hello@heurial.studio (verified 2026-11-11).
//   TRACKER_URL   optional: link in the email. Default https://www.heurial.studio/admin

const { zcAuth } = require("@zcatalyst/auth");
const { Datastore } = require("@zcatalyst/datastore");
const { Mail } = require("@zcatalyst/mail");
const { handle } = require("./handler");

const env = (name, fallback) => (process.env[name] || "").trim() || fallback;

module.exports = async (req, res) => {
  const alertTo = env("ALERT_TO", "hello@heurial.studio");
  await handle(req, res, {
    expectedKey: process.env.INQUIRY_KEY,
    trackerUrl: env("TRACKER_URL", "https://www.heurial.studio/admin"),
    insert: async (row) => {
      await zcAuth.init(req); // runs inside your Catalyst project with its own access; no stored passwords
      return new Datastore().table("Inquiries").insertRow(row);
    },
    notify: alertTo.toLowerCase() === "off" ? undefined : async ({ subject, text, replyTo }) => {
      await new Mail().sendMail({
        from_email: env("ALERT_FROM", "hello@heurial.studio"),
        to_email: [alertTo],
        reply_to: [replyTo],
        subject,
        content: text,
        html_mode: false,
      });
    },
  });
};
