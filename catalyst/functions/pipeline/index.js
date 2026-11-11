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

const { zcAuth } = require("@zcatalyst/auth");
const { Datastore } = require("@zcatalyst/datastore");
const { Mail } = require("@zcatalyst/mail");
const { handle } = require("./handler");
const { catalystStore } = require("./store");

module.exports = async (req, res) => {
  let store;
  const lazyStore = new Proxy({}, {
    get: (_, method) => async (...args) => {
      if (!store) { await zcAuth.init(req); store = catalystStore(Datastore); }
      return store[method](...args);
    },
  });
  await handle(req, res, {
    expectedKey: process.env.PIPELINE_KEY,
    store: lazyStore,
    digestTo: process.env.DIGEST_TO,
    trackerUrl: process.env.TRACKER_URL,
    timeZone: process.env.TIME_ZONE || "America/Chicago",
    sendMail: process.env.DIGEST_FROM
      ? async ({ to, subject, html }) => {
        if (!store) { await zcAuth.init(req); store = catalystStore(Datastore); }
        await new Mail().sendMail({ from_email: process.env.DIGEST_FROM, to_email: [to], subject, content: html, html_mode: true });
      }
      : undefined,
  });
};
