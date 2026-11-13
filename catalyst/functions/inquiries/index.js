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
//   ACK_REPLY     optional: set to "on" to send the visitor an automatic "I got your message" email. Off by default.
//   ACK_REPLY_TO  optional: where the visitor's reply to that email goes. Default hello@heurial.studio.
//   ACK_SIGNATURE optional: the name that signs it. Default Uriyah Moore.
//   BOOKING_URL   optional: the "pick a time" link in that email. Default is the Zoho Bookings page; "off" leaves it out.

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
    ownerEmail: env("ACK_REPLY_TO", "hello@heurial.studio"),
    signature: env("ACK_SIGNATURE", "Uriyah Moore"),
    bookingUrl: env("BOOKING_URL", "https://heurial.zohobookings.com/4948260000000038065"),
    acknowledge: env("ACK_REPLY", "off").toLowerCase() !== "on" ? undefined : async ({ to, subject, text, replyTo }) => {
      await new Mail().sendMail({
        from_email: env("ALERT_FROM", "hello@heurial.studio"),
        to_email: [to],
        reply_to: [replyTo],
        subject,
        content: text,
        html_mode: false,
      });
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
